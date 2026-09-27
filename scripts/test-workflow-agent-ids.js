#!/usr/bin/env node
/**
 * test-workflow-agent-ids.js — Workflow agents get their own cache id.
 * Workflow agents live at subagents/workflows/<wf>/agent-<id>.jsonl, and their ids can
 * repeat a direct subagent's id in the same session. Both must be analyzed and reported.
 *   a1   direct agent-a1 and Workflow wf_x/agent-a1 → caches a1 and wf_x-a1, both in the report
 *   b2   Workflow agent with a cache left under its bare id → moved to wf_x-b2, bare dir removed
 *
 * Runs analyze-usage.js and build-report.js against a temp HOME. No real cache touched.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPTS = __dirname;
const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-agent-ids-')));
const SID = '22222222-0000-4000-8000-000000000001';
const proj = path.join(home, '.claude', 'projects', '-p-wf');
const sub = path.join(proj, SID, 'subagents');
const wf = path.join(sub, 'workflows', 'wf_x');

function transcript(file, req, minute) {
  const ts = `2026-09-20T00:${String(minute).padStart(2, '0')}:05.000Z`;
  const lines = [
    { type: 'user', timestamp: ts, message: { role: 'user', content: 'hi' } },
    { type: 'assistant', timestamp: ts, requestId: req, message: { id: 'msg_' + req, model: 'claude-opus-5', role: 'assistant', content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1000000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } },
  ];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.map((l) => JSON.stringify({ sessionId: SID, ...l })).join('\n') + '\n');
}
transcript(path.join(proj, `${SID}.jsonl`), 'req_main', 0);
transcript(path.join(sub, 'agent-a1.jsonl'), 'req_direct', 1);
transcript(path.join(wf, 'agent-a1.jsonl'), 'req_wf_a1', 2);
transcript(path.join(wf, 'agent-b2.jsonl'), 'req_wf_b2', 3);
fs.writeFileSync(path.join(wf, 'agent-a1.meta.json'), JSON.stringify({ agentType: 'workflow-worker' }));
const data = path.join(home, '.claude', 'super-token-saver-data', '-p-wf', SID, 'subagents');
fs.mkdirSync(path.join(data, 'b2'), { recursive: true });
fs.writeFileSync(path.join(data, 'b2', 'summary.json'), JSON.stringify({ filePath: path.join(wf, 'agent-b2.jsonl') }));

let failed = false;
const fail = (m) => { console.error('FAIL: ' + m); failed = true; };
const rawFile = path.join(home, 'raw.json');
const repFile = path.join(home, 'rep.json');
try {
  const env = { ...process.env, HOME: home };
  fs.writeFileSync(rawFile, execFileSync(process.execPath, [path.join(SCRIPTS, 'analyze-usage.js'), '--days', 'all', '--force'], { env, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 }));
  const ids = JSON.parse(fs.readFileSync(rawFile, 'utf8')).sessions.map((s) => s.sessionId).sort();
  const want = [SID, 'agent-a1', 'agent-wf_x-a1', 'agent-wf_x-b2'].sort();
  if (JSON.stringify(ids) !== JSON.stringify(want)) fail(`sessions ${JSON.stringify(ids)}, expected ${JSON.stringify(want)}`);
  for (const d of ['a1', 'wf_x-a1', 'wf_x-b2']) if (!fs.existsSync(path.join(data, d, 'timeline.csv'))) fail(`no cache ${d}`);
  if (fs.existsSync(path.join(data, 'b2'))) fail('legacy cache b2 left in place');
  const meta = path.join(data, 'wf_x-a1', 'summary.json');
  if (fs.existsSync(meta) && JSON.parse(fs.readFileSync(meta, 'utf8')).agentType !== 'workflow-worker') fail('workflow agent meta.json not read');
  execFileSync(process.execPath, [path.join(SCRIPTS, 'build-report.js'), '--data', rawFile, '--export-data', repFile, '--output', path.join(home, 'rep.html'), '--plan', 'max200'], { env, stdio: ['ignore', 'ignore', 'pipe'] });
  const cost = JSON.parse(fs.readFileSync(repFile, 'utf8')).summary.totalCost;
  const each = JSON.parse(fs.readFileSync(path.join(SCRIPTS, 'model-pricing.json'), 'utf8')).models['claude-opus-5'].input;
  if (Math.abs(cost - 4 * each) > 0.01) fail(`report cost ${cost}, expected ${4 * each} (4 requests of 1M input)`);
  if (!failed) console.log('PASS: direct and Workflow agents with one id both counted; legacy cache moved');
} catch (e) {
  fail('run failed: ' + ((e.stderr && e.stderr.toString().slice(-400)) || e.message));
} finally {
  fs.rmSync(home, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
