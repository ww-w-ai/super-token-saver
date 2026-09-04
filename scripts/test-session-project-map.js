#!/usr/bin/env node
/**
 * test-session-project-map.js — build-report must find a session's timeline.csv
 * in the project dir analyze-usage.js wrote it to, even when statusline-logger.sh
 * has created {otherProject}/{sid}/ratelimit.csv under every cwd the session
 * `cd`ed into. Before the fix the directory scan was last-project-wins, so a
 * session that moved across worktrees resolved to a dir with no timeline.csv and
 * its whole cost silently dropped out of the --all report.
 *
 * Runs build-report.js against a temp HOME. No network, no real cache touched.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPTS = __dirname;
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'session-project-map-'));
const base = path.join(home, '.claude', 'super-token-saver-data');
const sid = '11111111-2222-4333-8444-555555555555';
const realProj = '-Users-me-proj';
const rows = [
  // ts, model, input, cc, cc5m, cc1h, cr, out, cost, win, rl, evt, line, req
  '1788500000,claude-opus-5,10,0,0,0,1000000,100,1.5,1788498000,,,10,req_A',
  '1788500600,,10,0,0,0,1000000,100,2.5,,,,20,req_B',
];
const timeline = 'ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt,line,req\n' + rows.join('\n') + '\n';
// build-report recomputes totalCost from tokens × model-pricing.json, not from
// the cost column, so derive the expectation the same way (2 rows × input 10,
// cacheRead 1M, output 100 on claude-opus-5).
const rates = require('./model-pricing.json').models['claude-opus-5'];
const expectedCost = Math.round(2 * (10 * rates.input + 1000000 * rates.cacheRead + 100 * rates.output) / 1e6 * 100) / 100;

function write(rel, body) {
  const p = path.join(base, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}

// The real cache dir (what analyze-usage.js wrote).
write(`${realProj}/${sid}/timeline.csv`, timeline);
write(`${realProj}/${sid}/summary.json`, JSON.stringify({ sessionId: sid, costUSD: expectedCost }));
// What statusline-logger.sh leaves behind when the session cds into worktrees:
// same session id under other project names, ratelimit.csv only. One sorts
// before the real project and one after, so the test does not depend on
// readdir order.
write(`-Users-me-a-worktree/${sid}/ratelimit.csv`, 'ts,5h,5h_reset,7d,7d_reset,alert,version\n');
write(`-Users-me-z-worktree/${sid}/ratelimit.csv`, 'ts,5h,5h_reset,7d,7d_reset,alert,version\n');

const data = {
  summary: { totalTokens: 2000200, sessionCount: 1, dateRange: { from: '2026-09-04T00:00:00.000Z', to: '2026-09-04T01:00:00.000Z' }, host: 'claude', hasCostData: true },
  sessions: [{
    sessionId: sid,
    filePath: path.join(home, '.claude', 'projects', realProj, `${sid}.jsonl`),
    firstTs: '2026-09-04T00:00:00.000Z', lastTs: '2026-09-04T00:10:00.000Z',
    firstUserMsg: 'x', lastUserMsg: 'x', userMsgs: 2, asstMsgs: 2, model: 'claude-opus-5',
    tokens: { input: 20, cacheCreation: 0, cacheCreate5m: 0, cacheCreate1h: 0, cacheRead: 2000000, output: 200 },
    costUSD: expectedCost, rateLimitEvents: [], contextEvents: [], userMessageLog: [],
  }],
};
const inFile = path.join(home, 'in.json');
const outData = path.join(home, 'out.json');
const outHtml = path.join(home, 'out.html');
fs.writeFileSync(inFile, JSON.stringify(data));

let failed = false;
try {
  execFileSync(process.execPath, [
    path.join(SCRIPTS, 'build-report.js'),
    '--data', inFile, '--export-data', outData, '--output', outHtml, '--locale', 'en',
  ], { env: { ...process.env, HOME: home }, stdio: ['ignore', 'ignore', 'pipe'] });
  const report = JSON.parse(fs.readFileSync(outData, 'utf8'));
  const got = report.summary.totalCost;
  if (Math.abs(got - expectedCost) > 0.005) {
    console.error(`FAIL: totalCost ${got}, expected ${expectedCost} — session mapped to a project dir without timeline.csv`);
    failed = true;
  } else {
    console.log(`PASS: totalCost ${got} with the session id present under 3 project dirs`);
  }
} catch (e) {
  console.error('FAIL: build-report.js did not run:', (e.stderr && e.stderr.toString().slice(-400)) || e.message);
  failed = true;
} finally {
  fs.rmSync(home, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
