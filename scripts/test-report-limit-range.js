#!/usr/bin/env node
/**
 * test-report-limit-range.js — report-limit window selection.
 *   default    every 5h window of the last 7 days, rate-limited or not
 *   --blocked  only rate-limited windows, across all cached data
 *   once       every row lands in exactly one window, even when a window starts mid-hour
 *   early      a limit reset early: the first window ends where the next one starts
 * Three windows: A (2 days ago, not limited), B (1 day ago, limited), C (20 days ago, limited).
 * Expected: default = {A, B}; --blocked = {B, C}.
 * Second HOME: a reset puts the 5h window at B+10min; one row at B+5min, one at B+20min.
 * Expected: the requests of all windows add up to 2.
 *
 * Runs report-limit.js --dry-run against a temp HOME. No gist, no browser, no real cache touched.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPTS = __dirname;
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'report-limit-range-'));
const now = Math.floor(Date.now() / 1000);
const hourFloor = (t) => Math.floor(t / 3600) * 3600;
const A = hourFloor(now - 2 * 86400), B = hourFloor(now - 86400), C = hourFloor(now - 20 * 86400);

const header = 'ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt,line,req';
const row = (ts, rl, n) => [ts + 60, 'claude-opus-5', 10, 0, 0, 0, 1000, 50, 0.01, ts, rl, '', n, 'req_' + n].join(',');
const dir = path.join(home, '.claude', 'super-token-saver-data', '-Users-me-proj', '11111111-2222-4333-8444-555555555555');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'timeline.csv'), [header, row(C, 'limit_hit_5h', 1), row(A, '', 2), row(B, 'limit_hit_5h', 3)].join('\n') + '\n');

// Mid-hour window: the timeline's win column holds B for the row before the reset window and
// B+600 for the row inside it — the two keys an hour-granular grouping turned into two windows.
const home2 = fs.mkdtempSync(path.join(os.tmpdir(), 'report-limit-once-'));
const dir2 = path.join(home2, '.claude', 'super-token-saver-data', '-Users-me-proj', '11111111-2222-4333-8444-666666666666');
fs.mkdirSync(dir2, { recursive: true });
const rowAt = (ts, win, n) => [ts, 'claude-opus-5', 10, 0, 0, 0, 1000, 50, 0.01, win, '', '', n, 'req_' + n].join(',');
fs.writeFileSync(path.join(dir2, 'timeline.csv'), [header, rowAt(B + 300, B, 1), rowAt(B + 1200, B + 600, 2)].join('\n') + '\n');
fs.writeFileSync(path.join(dir2, 'ratelimit.csv'), 'ts,5h,5h_reset,7d,7d_reset,alert,version\n' + `${B + 1200},3,${B + 600 + 5 * 3600},1,,,` + '\n');

function run(extra, h = home) {
  const out = execFileSync(process.execPath, [path.join(SCRIPTS, 'report-limit.js'), '--plan', 'max200', '--dry-run', ...extra],
    { env: { ...process.env, HOME: h }, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  const j = JSON.parse(out);
  if (j.discussionOpened || j.gistUrl) throw new Error('dry-run uploaded or opened something');
  if (j.reportDir) fs.rmSync(j.reportDir, { recursive: true, force: true });
  return j;
}
const starts = (extra) => run(extra).windows.map((w) => w.date).sort();

// Early reset: windows start at B and B+4.5h (the limit reset before B+5h). Requests at B+1h,
// B+4.75h, B+6h. The first window ends where the second starts: 1 request, then 2.
const home3 = fs.mkdtempSync(path.join(os.tmpdir(), 'report-limit-early-'));
const dir3 = path.join(home3, '.claude', 'super-token-saver-data', '-Users-me-proj', '11111111-2222-4333-8444-777777777777');
fs.mkdirSync(dir3, { recursive: true });
const H = 3600;
fs.writeFileSync(path.join(dir3, 'timeline.csv'), [header, rowAt(B + H, B, 1), rowAt(B + 4.75 * H, B, 2), rowAt(B + 6 * H, B, 3)].join('\n') + '\n');
fs.writeFileSync(path.join(dir3, 'ratelimit.csv'), 'ts,5h,5h_reset,7d,7d_reset,alert,version\n'
  + `${B + H},40,${B + 5 * H},1,,,\n${B + 4.75 * H},2,${B + 9.5 * H},1,,,\n`);
const day = (t) => new Date(t * 1000).toLocaleDateString('en-CA');

let failed = false;
const fail = (m) => { console.error('FAIL: ' + m); failed = true; };
try {
  const def = starts([]);
  const blocked = starts(['--blocked']);
  if (JSON.stringify(def) !== JSON.stringify([day(A), day(B)].sort())) fail(`default windows ${JSON.stringify(def)}, expected A and B`);
  if (JSON.stringify(blocked) !== JSON.stringify([day(C), day(B)].sort())) fail(`--blocked windows ${JSON.stringify(blocked)}, expected B and C`);
  const once = run([], home2).windows.reduce((s, w) => s + w.requests, 0);
  if (once !== 2) fail(`requests across windows ${once}, expected 2 (a row was counted in two windows)`);
  const early = run([], home3).windows.map((w) => w.requests);
  if (JSON.stringify(early) !== '[1,2]') fail(`early-reset windows hold ${JSON.stringify(early)} requests, expected [1,2] (one merged window over 5h?)`);
  if (!failed) console.log('PASS: default = last 7 days (limited or not); --blocked = limited windows only; each row in one window; an early reset splits windows');
} catch (e) {
  fail('report-limit.js did not run: ' + ((e.stderr && e.stderr.toString().slice(-400)) || e.message));
} finally {
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(home2, { recursive: true, force: true });
  fs.rmSync(home3, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
