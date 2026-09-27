#!/usr/bin/env node
/**
 * test-cross-session-dedup.js — a resumed or forked session starts a new session
 * file that copies the earlier conversation, and the copied rows keep their
 * original requestId. build-report must count each requestId once across all
 * sessions, or the copied history is billed again in every resumed session.
 *
 * Session A made req_A and req_B. Session B is a resume of A: it carries copies
 * of req_A and req_B, then makes one new call, req_C. The report period starts
 * between req_A and req_B, so req_A is out of range in both files.
 * Expected total = req_B + req_C = 2 calls. Counting copies gives 3; ignoring
 * the period start gives 3 as well, so the test fails if either rule breaks.
 *
 * Runs build-report.js against a temp HOME. No network, no real cache touched.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPTS = __dirname;
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cross-session-dedup-'));
const base = path.join(home, '.claude', 'super-token-saver-data');
const proj = '-Users-me-proj';
const sidA = '11111111-2222-4333-8444-555555555555';
const sidB = '66666666-7777-4888-9999-aaaaaaaaaaaa';
const HEADER = 'ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt,line,req\n';
const row = (ts, req, line) => `${ts},claude-opus-5,10,0,0,0,1000000,100,1.5,1788498000,,,${line},${req}`;
const rowsA = [row(1788500000, 'req_A', 10), row(1788500600, 'req_B', 20)];
const rowsB = [row(1788500000, 'req_A', 5), row(1788500600, 'req_B', 6), row(1788503000, 'req_C', 30)];

// build-report recomputes totalCost from tokens × model-pricing.json, so derive
// the expectation the same way: 2 in-range calls of input 10, cacheRead 1M, output 100.
const rates = require('./model-pricing.json').models['claude-opus-5'];
const perCall = (10 * rates.input + 1000000 * rates.cacheRead + 100 * rates.output) / 1e6;
const expectedCost = Math.round(2 * perCall * 100) / 100;
const cutoff = new Date(1788500300 * 1000).toISOString(); // after req_A, before req_B

function write(rel, body) {
  const p = path.join(base, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}
function session(sid, rows, firstTs, lastTs) {
  write(`${proj}/${sid}/timeline.csv`, HEADER + rows.join('\n') + '\n');
  write(`${proj}/${sid}/summary.json`, JSON.stringify({ sessionId: sid, costUSD: rows.length * perCall }));
  return {
    sessionId: sid,
    filePath: path.join(home, '.claude', 'projects', proj, `${sid}.jsonl`),
    firstTs, lastTs, firstUserMsg: 'x', lastUserMsg: 'x', userMsgs: rows.length, asstMsgs: rows.length,
    model: 'claude-opus-5',
    tokens: { input: 10 * rows.length, cacheCreation: 0, cacheCreate5m: 0, cacheCreate1h: 0, cacheRead: 1000000 * rows.length, output: 100 * rows.length },
    costUSD: rows.length * perCall, rateLimitEvents: [], contextEvents: [], userMessageLog: [],
  };
}

const data = {
  summary: { totalTokens: 5000500, sessionCount: 2, dateRange: { from: '2026-09-04T00:00:00.000Z', to: '2026-09-04T01:00:00.000Z' }, cutoff, host: 'claude', hasCostData: true },
  sessions: [
    session(sidA, rowsA, '2026-09-04T00:00:00.000Z', '2026-09-04T00:10:00.000Z'),
    session(sidB, rowsB, '2026-09-04T00:00:00.000Z', '2026-09-04T00:50:00.000Z'),
  ],
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
    console.error(`FAIL: totalCost ${got}, expected ${expectedCost} — a copied request was counted again, or a row before the period start was counted`);
    failed = true;
  } else {
    console.log(`PASS: totalCost ${got} counts req_B once and drops req_A before the period start`);
  }
} catch (e) {
  console.error('FAIL: build-report.js did not run:', (e.stderr && e.stderr.toString().slice(-400)) || e.message);
  failed = true;
} finally {
  fs.rmSync(home, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
