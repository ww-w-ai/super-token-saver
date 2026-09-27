#!/usr/bin/env node
/**
 * test-report-limit-exclusions.js — report-limit applies the same exclusions as /usage-view.
 *   replay    a resumed session copies req_2; it is counted once
 *   account   with two login accounts on record, each account is its own section: its own rows,
 *             its own ratelimit file, its own 5h windows. A row with no account record joins the
 *             current login (Account 1)
 *   cache     cacheWrite sums cc only; cc5m/cc1h are its split, not extra writes
 * Four sessions: S1 (account X, req_1, req_2), S2 (account X, resumed: req_2 again + req_3),
 * S3 (account Y, req_9, a reset putting Y's window at A-2h), S4 (no record, row before any
 * login: req_5). X is the latest login.
 * Expected: Account 1 (X) one window at A: 4 requests, 3 sessions, cacheWrite 400.
 * Account 2 (Y) one window at A-2h: 1 request. Y's reset does not move X's window.
 * account1-ratelimit.csv holds S1's row only; account2-ratelimit.csv holds S3's row only.
 *
 * Runs report-limit.js --dry-run against a temp HOME. No gist, no browser, no real cache touched.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { fmtTime } = require('./lib/format');

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
session(S3, [row(200, 9)], [{ ts: iso(A + 10), account: 'y' }], `${A + 210},77,${A + 3 * 3600},55,,,`);
session(S4, [row(5, 5)], []);

let failed = false;
const fail = (m) => { console.error('FAIL: ' + m); failed = true; };
let reportDir = null;
try {
  const out = execFileSync(process.execPath, [path.join(SCRIPTS, 'report-limit.js'), '--plan', 'max200', '--dry-run'],
    { env: { ...process.env, HOME: home }, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  const j = JSON.parse(out);
  reportDir = j.reportDir;
  const x = j.windows.filter(w => w.account === 1);
  const y = j.windows.filter(w => w.account === 2);
  if (j.accounts.length !== 2) fail(`accounts ${j.accounts.length}, expected 2`);
  if (x.length !== 1) fail(`account 1 windows ${x.length}, expected 1`);
  else {
    const w = x[0];
    if (w.requests !== 4) fail(`account 1 requests ${w.requests}, expected 4 (replay once, other account out, unknown kept)`);
    if (w.sessions !== 3) fail(`account 1 sessions ${w.sessions}, expected 3`);
    if (w.cacheWrite !== 400) fail(`account 1 cacheWrite ${w.cacheWrite}, expected 400 (cc only)`);
    if (w.start !== fmtTime(new Date(A * 1000))) fail(`account 1 window starts ${w.start}; the other account's reset moved it`);
  }
  if (y.length !== 1) fail(`account 2 windows ${y.length}, expected 1`);
  else {
    if (y[0].requests !== 1) fail(`account 2 requests ${y[0].requests}, expected 1`);
    if (y[0].start !== fmtTime(new Date((A - 7200) * 1000))) fail(`account 2 window starts ${y[0].start}, expected its own reset's start`);
  }
  const rl1 = fs.readFileSync(path.join(reportDir, 'account1-ratelimit.csv'), 'utf8');
  const rl2 = fs.readFileSync(path.join(reportDir, 'account2-ratelimit.csv'), 'utf8');
  if (!rl1.includes(`${A + 90},41`) || rl1.includes(`${A + 210},77`)) fail('account1-ratelimit.csv must hold account 1 rows only');
  if (!rl2.includes(`${A + 210},77`) || rl2.includes(`${A + 90},41`)) fail('account2-ratelimit.csv must hold account 2 rows only');
  if (!failed) console.log('PASS: replayed request counted once; each account its own rows, windows and ratelimit file; unknown account joins the current login; cache write not doubled');
} catch (e) {
  fail('report-limit.js did not run: ' + ((e.stderr && e.stderr.toString().slice(-400)) || e.message));
} finally {
  fs.rmSync(home, { recursive: true, force: true });
  if (reportDir) fs.rmSync(reportDir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
