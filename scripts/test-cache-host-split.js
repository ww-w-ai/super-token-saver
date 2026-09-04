#!/usr/bin/env node
/**
 * test-cache-host-split.js — the cache base is shared, the host trees are not.
 *
 *   ~/.claude/super-token-saver-data/{proj}/{sid}/…        Claude Code
 *   ~/.claude/super-token-saver-data/codex/{proj}/{sid}/…  Codex
 *
 * 1. A pre-split Codex entry sitting in the Claude tree (summary.json host=codex)
 *    is moved under codex/ once, and the old .codex-normalized dir follows it.
 * 2. The Claude listing never returns `codex`; the Codex listing never sees
 *    Claude projects; forHost() binds every getter to its own tree.
 * 3. build-report counts a session whose transcript is gone but whose
 *    summary.json + timeline.csv are cached — and does not count one from
 *    the other host's tree.
 *
 * Runs against a temp HOME; the real cache is never touched.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPTS = __dirname;
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-host-split-'));
const base = path.join(home, '.claude', 'super-token-saver-data');
let failures = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failures++;
}
function write(rel, body) {
  const p = path.join(base, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}
const HEADER = 'ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt,line,req\n';
const claudeRow = '1788500000,claude-opus-5,10,0,0,0,1000000,100,0.5,1788498000,,,10,req_A\n';
const codexRow = '1788500000,gpt-5.6-sol,10,0,0,0,1000000,100,0,1788498000,,,10,req_B\n';
const summary = (sid, host, extra) => JSON.stringify(Object.assign({
  sessionId: sid, filePath: path.join(home, '.claude', 'projects', '-p', `${sid}.jsonl`),
  firstTs: '2026-09-04T00:00:00.000Z', lastTs: '2026-09-04T00:10:00.000Z', userMsgs: 1, asstMsgs: 1,
  model: host === 'codex' ? 'gpt-5.6-sol' : 'claude-opus-5',
  tokens: { input: 10, cacheCreation: 0, cacheCreate5m: 0, cacheCreate1h: 0, cacheRead: 1000000, output: 100 },
  costUSD: host === 'codex' ? 0 : 0.5, rateLimitEvents: [], contextEvents: [], userMessageLog: [],
}, host === 'codex' ? { host: 'codex', cacheVersion: 1, cwd: '/p', filePath: path.join(home, '.codex', 'sessions', `rollout-${sid}.jsonl`) } : {}, extra || {}));

// --- fixture: pre-split layout -------------------------------------------
const C1 = 'c1c1c1c1-0000-4000-8000-000000000001'; // Claude, transcript gone, cache present
const X1 = 'x1x1x1x1-0000-4000-8000-000000000001'; // Codex, still sitting in the Claude tree
write(`-p/${C1}/summary.json`, summary(C1, 'claude'));
write(`-p/${C1}/timeline.csv`, HEADER + claudeRow);
write(`-p/${X1}/summary.json`, summary(X1, 'codex'));
write(`-p/${X1}/timeline.csv`, HEADER + codexRow);
write(`.codex-normalized/-p/${X1}.jsonl`, '{"type":"codex_skip"}\n');

// --- 1 + 2: load cache-paths under the temp HOME ---------------------------
const probe = execFileSync(process.execPath, ['-e', `
  const cp = require(${JSON.stringify(path.join(SCRIPTS, 'lib', 'cache-paths.js'))});
  const fs = require('fs');
  const out = {
    claudeProjects: cp.listProjects(),
    claudeSessions: cp.listSessions('-p'),
    codexProjects: cp.forHost('codex').listProjects(),
    codexSessions: cp.forHost('codex').listSessions('-p'),
    codexTimeline: cp.forHost('codex').getTimelinePath('-p', 'S'),
    claudeTimeline: cp.getTimelinePath('-p', 'S'),
    normalizedMoved: fs.existsSync(cp.CODEX_BASE + '/.normalized/-p/${X1}.jsonl'),
    oldNormalizedGone: !fs.existsSync(cp.CACHE_BASE + '/.codex-normalized'),
    scanTriggerGone: !fs.existsSync(cp.CACHE_BASE + '/.codex-normalized'),
  };
  process.stdout.write(JSON.stringify(out));
`], { env: { ...process.env, HOME: home }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const p = JSON.parse(probe);
check('Claude listing shows only the Claude session', p.claudeSessions, [C1]);
check('Claude listing never returns the codex sub-dir as a project', p.claudeProjects, ['-p']);
check('Codex entry was moved under codex/', p.codexSessions, [X1]);
check('Codex listing sees the project only through its own tree', p.codexProjects, ['-p']);
check('forHost(codex) binds getters to the codex/ tree', p.codexTimeline, path.join(base, 'codex', '-p', 'S', 'timeline.csv'));
check('root getters stay on the Claude tree', p.claudeTimeline, path.join(base, '-p', 'S', 'timeline.csv'));
check('.codex-normalized moved to codex/.normalized', [p.normalizedMoved, p.oldNormalizedGone], [true, true]);
check('the pre-split trigger dir is gone, so the scan does not run again', p.scanTriggerGone, true);

// --- 3: build-report counts cache-only sessions of its own host ----------
function report(host) {
  const data = { summary: { totalTokens: 0, sessionCount: 0, dateRange: { from: '2026-09-01T00:00:00.000Z', to: '2026-09-04T01:00:00.000Z' }, host, hasCostData: host === 'claude' }, sessions: [] };
  const inFile = path.join(home, `in-${host}.json`), outData = path.join(home, `out-${host}.json`);
  fs.writeFileSync(inFile, JSON.stringify(data));
  const args = [path.join(SCRIPTS, 'build-report.js'), '--data', inFile, '--export-data', outData, '--output', path.join(home, `out-${host}.html`), '--locale', 'en'];
  if (host === 'codex') args.push('--host', 'codex');
  execFileSync(process.execPath, args, { env: { ...process.env, HOME: home }, stdio: ['ignore', 'ignore', 'pipe'] });
  return JSON.parse(fs.readFileSync(outData, 'utf8'));
}
try {
  const rc = report('claude');
  check('Claude report counts the cache-only Claude session (transcript gone)', [rc.summary.sessionCount, rc.summary.totalCost], [1, 0.5]);
  const rx = report('codex');
  check('Codex report counts the migrated Codex session and nothing from the Claude tree', [rx.summary.sessionCount, rx.tokenBreakdown.cacheRead.tokens], [1, 1000000]);
  // Analyzer-listed Codex session: filePath is a rollout (no /projects/), so the
  // project must come from the cwd hash — and not from a decoy dir that sorts last.
  write(`codex/-zz/${X1}/summary.json`, '{}');
  const codexIn = path.join(home, 'in-codex2.json'), codexOut = path.join(home, 'out-codex2.json');
  const listed = JSON.parse(summary(X1, 'codex', { filePath: path.join(home, '.codex', 'sessions', `rollout-${X1}.jsonl`), cwd: '/p' }));
  fs.writeFileSync(codexIn, JSON.stringify({ summary: { totalTokens: 0, sessionCount: 1, dateRange: { from: '2026-09-01T00:00:00.000Z', to: '2026-09-04T01:00:00.000Z' }, host: 'codex', hasCostData: false }, sessions: [listed] }));
  execFileSync(process.execPath, [path.join(SCRIPTS, 'build-report.js'), '--data', codexIn, '--export-data', codexOut, '--output', path.join(home, 'out-codex2.html'), '--locale', 'en', '--host', 'codex'], { env: { ...process.env, HOME: home }, stdio: ['ignore', 'ignore', 'pipe'] });
  const rx2 = JSON.parse(fs.readFileSync(codexOut, 'utf8'));
  check('analyzer-listed Codex session resolves its cache dir from the cwd hash, not the last-sorted dir', rx2.tokenBreakdown.cacheRead.tokens, 1000000);
} catch (e) {
  check('build-report ran', (e.stderr && e.stderr.toString().slice(-300)) || e.message, 'ok');
}

fs.rmSync(home, { recursive: true, force: true });
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
