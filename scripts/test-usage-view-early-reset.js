#!/usr/bin/env node
/**
 * test-usage-view-early-reset.js — /usage-view splits a window that a reset coupon cut short.
 *
 * A limit window starts at T. A reset coupon at T+2h starts the next window there. Requests at
 * T+10min (first window) and T+2h+10min, T+4h (second window).
 *   claude   ratelimit.csv states both resets. Merged, one window held all three requests over
 *            7 hours; split, the first ends at T+2h with 1 request and the second holds 2.
 *   codex    rate-limit samples state both resets of a 5h lane. Tiled back from the latest reset,
 *            the first request fell in a window starting T-3h; recorded, it is in [T, T+2h).
 *
 * Runs build-report.js against a temp HOME. No network, no real cache touched.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPTS = __dirname;
const H = 3600;
const T = 1788501600;
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-view-early-reset-'));
const iso = (t) => new Date(t * 1000).toISOString();
const HEADER = 'ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt,line,req';

function write(rel, body) {
  const p = path.join(home, '.claude', 'super-token-saver-data', rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}

function timeline(model, cost) {
  const row = (t, n) => [t, model, 10, 0, 0, 0, 1000, 10, cost, '', '', '', n, 'req_' + n].join(',');
  return HEADER + '\n' + [row(T + 600, 1), row(T + 2 * H + 600, 2), row(T + 4 * H, 3)].join('\n') + '\n';
}

function session(sid, model) {
  return {
    sessionId: sid,
    filePath: path.join(home, 'x', sid + '.jsonl'),
    firstTs: iso(T + 600), lastTs: iso(T + 4 * H),
    firstUserMsg: 'x', lastUserMsg: 'x', userMsgs: 3, asstMsgs: 3, model,
    tokens: { input: 30, cacheCreation: 0, cacheCreate5m: 0, cacheCreate1h: 0, cacheRead: 3000, output: 30 },
    costUSD: 0, rateLimitEvents: [], contextEvents: [], userMessageLog: [],
  };
}

function build(name, data, host) {
  const inFile = path.join(home, name + '-in.json');
  const outData = path.join(home, name + '-out.json');
  fs.writeFileSync(inFile, JSON.stringify(data));
  execFileSync(process.execPath, [
    path.join(SCRIPTS, 'build-report.js'), ...(host ? ['--host', host] : []),
    '--data', inFile, '--export-data', outData, '--output', path.join(home, name + '.html'), '--locale', 'en',
  ], { env: { ...process.env, HOME: home }, stdio: ['ignore', 'ignore', 'pipe'] });
  return JSON.parse(fs.readFileSync(outData, 'utf8')).windows.map(w => [w.startTs - T, w.endTs - T, w.eventCount]);
}

// Claude Code
const cSid = '11111111-2222-4333-8444-555555555555';
write('-Users-me-proj/' + cSid + '/timeline.csv', timeline('claude-opus-5', 0.5));
write('-Users-me-proj/' + cSid + '/ratelimit.csv', 'ts,5h,5h_reset,7d,7d_reset,alert,version\n'
  + (T + 60) + ',10,' + (T + 5 * H) + ',5,,,1\n' + (T + 2 * H + 60) + ',1,' + (T + 7 * H) + ',5,,,1\n');
const claudeData = {
  summary: { totalTokens: 3060, sessionCount: 1, dateRange: { from: iso(T), to: iso(T + 5 * H) }, host: 'claude', hasCostData: true },
  sessions: [session(cSid, 'claude-opus-5')],
};

// Codex: a 5h lane whose first window a coupon cut at T+2h
const xSid = '0199aaaa-0000-7000-8000-000000000001';
write('codex/-Users-me-proj/' + xSid + '/timeline.csv', timeline('gpt-5.6-sol', 0));
const sample = (t, used, reset) => ({ sessionId: xSid, line: t, ts: iso(t), plan: 'plus', limitId: 'codex', name: null, lane: 'primary', usedPercent: used, windowMinutes: 300, resetsAt: reset });
const codexData = {
  summary: { totalTokens: 3060, sessionCount: 1, dateRange: { from: iso(T), to: iso(T + 5 * H) }, host: 'codex', hasCostData: false, windowMinutes: 300 },
  sessions: [session(xSid, 'gpt-5.6-sol')],
  canonicalRateLimits: { limitId: 'codex', plan: 'plus', primary: { usedPercent: 1, windowMinutes: 300, resetsAt: T + 7 * H } },
  rateLimitWindowMinutes: 300,
  calendarWindowMinutes: 300,
  rateLimitSamples: [sample(T + 600, 50, T + 5 * H), sample(T + 2 * H + 600, 1, T + 7 * H), sample(T + 4 * H, 9, T + 7 * H + 3)],
};

let failed = false;
const expect = (label, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { console.error(`FAIL: ${label} ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`); failed = true; }
};
try {
  expect('claude windows [start, end, requests] from T', build('claude', claudeData), [[0, 2 * H, 1], [2 * H, 7 * H, 2]]);
  expect('codex windows [start, end, requests] from T', build('codex', codexData, 'codex'), [[0, 2 * H, 1], [2 * H, 7 * H, 2]]);
  if (!failed) console.log('PASS: a coupon reset ends the window where the next starts, on Claude Code and Codex');
} catch (e) {
  console.error('FAIL: build-report.js did not run:', (e.stderr && e.stderr.toString().slice(-600)) || e.message);
  failed = true;
} finally {
  fs.rmSync(home, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
