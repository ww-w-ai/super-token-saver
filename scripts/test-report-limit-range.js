#!/usr/bin/env node
/**
 * test-report-limit-range.js — report-limit window selection.
 *   default    every 5h window of the last 7 days, rate-limited or not
 *   --blocked  only rate-limited windows, across all cached data
 * Three windows: A (2 days ago, not limited), B (1 day ago, limited), C (20 days ago, limited).
 * Expected: default = {A, B}; --blocked = {B, C}.
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

function starts(extra) {
  const out = execFileSync(process.execPath, [path.join(SCRIPTS, 'report-limit.js'), '--plan', 'max200', '--dry-run', ...extra],
    { env: { ...process.env, HOME: home }, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  const j = JSON.parse(out);
  if (j.discussionOpened || j.gistUrl) throw new Error('dry-run uploaded or opened something');
  return j.windows.map((w) => w.date).sort();
}
const day = (t) => new Date(t * 1000).toLocaleDateString('en-CA');

let failed = false;
const fail = (m) => { console.error('FAIL: ' + m); failed = true; };
try {
  const def = starts([]);
  const blocked = starts(['--blocked']);
  if (JSON.stringify(def) !== JSON.stringify([day(A), day(B)].sort())) fail(`default windows ${JSON.stringify(def)}, expected A and B`);
  if (JSON.stringify(blocked) !== JSON.stringify([day(C), day(B)].sort())) fail(`--blocked windows ${JSON.stringify(blocked)}, expected B and C`);
  if (!failed) console.log('PASS: default = last 7 days (limited or not); --blocked = limited windows only');
} catch (e) {
  fail('report-limit.js did not run: ' + ((e.stderr && e.stderr.toString().slice(-400)) || e.message));
} finally {
  fs.rmSync(home, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
