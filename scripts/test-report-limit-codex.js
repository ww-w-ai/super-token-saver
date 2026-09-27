#!/usr/bin/env node
/**
 * test-report-limit-codex.js — /report-limit --host codex.
 *   jitter    samples of one window report resets a few seconds apart; still one window
 *   early     a window that resets early stops counting requests where the next one starts
 *   idle      a lane that stays at 0% (its reset keeps moving) is left out
 *   account   two login accounts: each its own section, rows and files
 *   blocked   --blocked keeps only windows that reached 100%
 *   stale     a lower used % from a concurrent session is not reported
 *   shape     window files carry the Claude Code report's columns
 *
 * Account X (current login): W1 [N-6d, N+1d) reaches 100% and resets early at N-3d+60, where W2
 * starts. Requests at N-5d, N-4d, N-3d+30 (W1) and N-3d+300, N-1d (W2). An idle lane at 0%.
 * Account Y: its own window, one request.
 * Expected default: Account 1 = W1 (3 requests, 10%→100%) + W2 (2 requests); Account 2 = 1 window.
 * Expected --blocked: W1 only.
 *
 * Runs report-limit.js --host codex --dry-run against a temp HOME. No gist, no browser.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPTS = __dirname;
const CLAUDE_WINDOW_HEADER = 'ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt,line,req,session';
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'report-limit-codex-'));
const D = 86400;
const N = Math.floor(Date.now() / 1000);
const iso = (t) => new Date(t * 1000).toISOString();
const base = path.join(home, '.claude', 'super-token-saver-data', 'codex', '-Users-me-proj');

const header = 'ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt,line,req';
const row = (t, n) => [t, 'gpt-5.6-sol', 100, 0, 0, 0, 1000, 10, 0, '', '', '', n, ''].join(',');
const sample = (t, used, reset, limitId = 'codex', lane = 'primary') =>
  ({ sessionId: 's', line: t, ts: iso(t), plan: 'pro', limitId, name: null, lane, usedPercent: used, windowMinutes: 10080, resetsAt: reset });
function session(id, rows, samples, changes) {
  const dir = path.join(base, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'timeline.csv'), [header, ...rows].join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify({ sessionId: id, host: 'codex', accountChanges: changes, rateLimitSamples: samples }));
}

const R1 = N + D;                  // W1 scheduled reset
const W2 = N - 3 * D + 60;         // W1 resets early; W2 starts here
const R2 = W2 + 7 * D;
session('0199aaaa-0000-7000-8000-000000000001',
  [row(N - 5 * D, 1), row(N - 4 * D, 2), row(N - 3 * D + 30, 3), row(N - 3 * D + 300, 4), row(N - D, 5)],
  [
    sample(N - 5 * D, 10, R1), sample(N - 4 * D, 60, R1 + 3), sample(N - 3.5 * D, 7, R1), sample(N - 3 * D, 100, R1 - 2),
    sample(W2 + 60, 5, R2), sample(N - D, 40, R2 + 1),
    sample(N - 2 * D, 0, N + 5 * D, 'codex_idle', 'secondary'), sample(N - D, 0, N + 6 * D, 'codex_idle', 'secondary'),
  ],
  [{ ts: iso(N - 6 * D), account: 'x' }]);
session('0199aaaa-0000-7000-8000-000000000002',
  [row(N - D + 10, 9)],
  [sample(N - D + 10, 50, N + 2 * D)],
  [{ ts: iso(N - 2 * D), account: 'y' }]);
session('0199aaaa-0000-7000-8000-000000000003', [], [], [{ ts: iso(N - D / 2), account: 'x' }]);

function run(extra) {
  const out = execFileSync(process.execPath, [path.join(SCRIPTS, 'report-limit.js'), '--host', 'codex', '--dry-run', ...extra],
    { env: { ...process.env, HOME: home }, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  const j = JSON.parse(out);
  if (j.discussionOpened || j.gistUrl) throw new Error('dry-run uploaded or opened something');
  return j;
}

let failed = false;
const fail = (m) => { console.error('FAIL: ' + m); failed = true; };
const cleanup = [];
try {
  const j = run([]);
  cleanup.push(j.reportDir);
  const a1 = j.windows.filter(w => w.account === 1);
  const a2 = j.windows.filter(w => w.account === 2);
  if (a1.length !== 2) fail(`account 1 windows ${a1.length}, expected 2 (jitter merged, idle lane out)`);
  else {
    const [w1, w2] = a1;
    if (w1.requests !== 3) fail(`W1 requests ${w1.requests}, expected 3 (cut at the early reset)`);
    if (w1.activeEnd !== W2) fail(`W1 active until ${w1.activeEnd}, expected the next window's start ${W2}`);
    if (w1.usedFirst !== 10 || w1.usedLast !== 100) fail(`W1 used ${w1.usedFirst}→${w1.usedLast}, expected 10→100`);
    if (w2.requests !== 2) fail(`W2 requests ${w2.requests}, expected 2`);
  }
  if (a2.length !== 1 || a2[0].requests !== 1) fail(`account 2 windows ${a2.length}, expected 1 with 1 request`);
  if (j.windows.some(w => w.limitId === 'codex_idle')) fail('an idle 0% lane was reported');
  const files = fs.readdirSync(j.reportDir);
  const rowsIn = (prefix) => files.filter(f => f.startsWith(prefix + 'window-codex-primary-'))
    .reduce((n, f) => n + fs.readFileSync(path.join(j.reportDir, f), 'utf8').trim().split('\n').length - 1, 0);
  if (rowsIn('account1-') !== 5 || rowsIn('account2-') !== 1) fail(`window files hold ${rowsIn('account1-')} and ${rowsIn('account2-')} rows, expected 5 and 1`);
  const first = files.find(f => f.startsWith('account1-window-'));
  const header = first && fs.readFileSync(path.join(j.reportDir, first), 'utf8').split('\n')[0];
  if (header !== CLAUDE_WINDOW_HEADER) fail(`window file header ${header}, expected the Claude Code report's`);
  const rl = fs.readFileSync(path.join(j.reportDir, 'account1-ratelimit.csv'), 'utf8');
  if (rl.includes(',7,pro')) fail('a stale lower used % was reported');

  const b = run(['--blocked']);
  cleanup.push(b.reportDir);
  if (b.windows.length !== 1 || b.windows[0].usedMax !== 100) fail(`--blocked windows ${b.windows.length}, expected W1 only`);

  if (!failed) console.log('PASS: jitter merged; early reset cuts the window; idle lane out; stale % dropped; accounts split; Claude Code window files; --blocked keeps 100% windows');
} catch (e) {
  fail('report-limit.js --host codex did not run: ' + ((e.stderr && e.stderr.toString().slice(-400)) || e.message));
} finally {
  fs.rmSync(home, { recursive: true, force: true });
  for (const d of cleanup) if (d) fs.rmSync(d, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
