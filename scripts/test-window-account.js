#!/usr/bin/env node
/**
 * test-window-account.js — 5-hour window boundaries must come from one login account.
 *
 * Two accounts' 5-hour windows overlap in time. Merged together they form one span longer
 * than five hours, which is what an account's dashboard tab showed. With a row filter,
 * each account keeps its own five-hour window.
 *
 * Runs against a temp HOME. No real cache touched.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'window-account-'));
process.env.HOME = home;
const { buildGlobalTsMapper, FIVE_HOURS_S } = require('./lib/window-utils');

const base = path.join(home, '.claude', 'super-token-saver-data', '-Users-me-proj');
const t0 = 1790000000;
const sessions = { 'sess-a': t0 + FIVE_HOURS_S, 'sess-b': t0 + 3 * 3600 + FIVE_HOURS_S }; // resets 3h apart
for (const [sid, reset] of Object.entries(sessions)) {
  fs.mkdirSync(path.join(base, sid), { recursive: true });
  const ts = reset - FIVE_HOURS_S + 600;
  fs.writeFileSync(path.join(base, sid, 'ratelimit.csv'), `ts,5h,5h_reset,7d,7d_reset,alert,version\n${ts},10,${reset},5,,,1\n`);
}

let failed = false;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed = true;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${ok ? '' : `\n       expected ${JSON.stringify(expected)}\n       actual   ${JSON.stringify(actual)}`}`);
};
const spans = (m) => m.windows.map((w) => (w.end - w.start) / 3600);
try {
  check('both accounts merged: one 8-hour span', spans(buildGlobalTsMapper()), [8]);
  check('account A only: one 5-hour window', spans(buildGlobalTsMapper((sid) => sid === 'sess-a')), [5]);
  check('account B only: one 5-hour window, starting 3h later',
    buildGlobalTsMapper((sid) => sid === 'sess-b').windows.map((w) => [w.start - t0, (w.end - w.start) / 3600]), [[3 * 3600, 5]]);
} finally {
  fs.rmSync(home, { recursive: true, force: true });
}
console.log(failed ? '\nFAILED' : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
