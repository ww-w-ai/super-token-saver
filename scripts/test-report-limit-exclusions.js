#!/usr/bin/env node
/**
 * test-report-limit-exclusions.js — report-limit applies the same exclusions as /usage-view.
 *   replay    a resumed session copies req_2; it is counted once
 *   account   with two login accounts on record, only the current account's rows are sent
 *             (timeline rows and ratelimit.csv rows alike); a row with no account record is kept
 *   cache     cacheWrite sums cc only; cc5m/cc1h are its split, not extra writes
 * One window, four sessions: S1 (account X, req_1, req_2), S2 (account X, resumed: req_2 again + req_3),
 * S3 (account Y, req_9), S4 (no record, row before any login: req_5). X is the latest login.
 * Expected: 4 requests, 3 sessions, cacheWrite 400,
 * ratelimit.csv holds S1's row and not S3's.
 *
 * Runs report-limit.js --dry-run against a temp HOME. No gist, no browser, no real cache touched.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPTS = __dirname;
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'report-limit-excl-'));
const now = Math.floor(Date.now() / 1000);
const A = Math.floor((now - 86400) / 3600) * 3600;
const iso = (t) => new Date(t * 1000).toISOString();

const header = 'ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt,line,req';
const row = (t, n) => [A + t, 'claude-opus-5', 10, 100, 100, 0, 1000, 50, 0.01, A, '', '', n, 'req_' + n].join(',');
const proj = path.join(home, '.claude', 'super-token-saver-data', '-Users-me-proj');
function session(id, rows, changes, rl) {
  const dir = path.join(proj, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'timeline.csv'), [header, ...rows].join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify({ sessionId: id, accountChanges: changes }));
  if (rl) fs.writeFileSync(path.join(dir, 'ratelimit.csv'), 'ts,5h,5h_reset,7d,7d_reset,alert,version\n' + rl + '\n');
}
const S1 = '11111111-2222-4333-8444-000000000001';
const S2 = '11111111-2222-4333-8444-000000000002';
const S3 = '11111111-2222-4333-8444-000000000003';
const S4 = '11111111-2222-4333-8444-000000000004';
session(S1, [row(60, 1), row(120, 2)], [{ ts: iso(A + 20), account: 'x' }], `${A + 90},41,,11,,,`);
session(S2, [row(120, 2), row(300, 3)], [{ ts: iso(A + 100), account: 'x' }]);
session(S3, [row(200, 9)], [{ ts: iso(A + 10), account: 'y' }], `${A + 210},77,,55,,,`);
session(S4, [row(5, 5)], []);

let failed = false;
const fail = (m) => { console.error('FAIL: ' + m); failed = true; };
let reportDir = null;
try {
  const out = execFileSync(process.execPath, [path.join(SCRIPTS, 'report-limit.js'), '--plan', 'max200', '--dry-run'],
    { env: { ...process.env, HOME: home }, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  const j = JSON.parse(out);
  reportDir = j.reportDir;
  if (j.windows.length !== 1) fail(`windows ${j.windows.length}, expected 1`);
  else {
    const w = j.windows[0];
    if (w.requests !== 4) fail(`requests ${w.requests}, expected 4 (replay once, other account out, unknown kept)`);
    if (w.sessions !== 3) fail(`sessions ${w.sessions}, expected 3`);
    if (w.cacheWrite !== 400) fail(`cacheWrite ${w.cacheWrite}, expected 400 (cc only)`);
  }
  const rl = fs.readFileSync(path.join(reportDir, 'ratelimit.csv'), 'utf8');
  if (!rl.includes(`${A + 90},41`)) fail('ratelimit.csv lost the current account row');
  if (rl.includes(`${A + 210},77`)) fail('ratelimit.csv kept the other account row');
  if (!failed) console.log('PASS: replayed request counted once; other account excluded; unknown account kept; cache write not doubled');
} catch (e) {
  fail('report-limit.js did not run: ' + ((e.stderr && e.stderr.toString().slice(-400)) || e.message));
} finally {
  fs.rmSync(home, { recursive: true, force: true });
  if (reportDir) fs.rmSync(reportDir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
