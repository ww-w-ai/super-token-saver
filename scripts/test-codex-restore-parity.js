#!/usr/bin/env node
// Integration fixtures use isolated homes. No real transcript or model call is needed.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sts-restore-parity-'));
const env = { ...process.env, HOME: tmp, CODEX_HOME: path.join(tmp, 'codex') };
const cwd = '/fixture/restore-parity';
const hash = '-fixture-restore-parity';
let failures = 0;
function check(name, value) {
  console.log(`${value ? 'PASS' : 'FAIL'} ${name}`);
  if (!value) failures++;
}
function id(n) { return `${String(n).padStart(8, '0')}-1111-2222-3333-444444444444`; }
function row(type, payload, timestamp = '2026-09-02T00:00:01Z') { return { type, payload, timestamp }; }
function message(role, text) { return row('response_item', { type: 'message', role, content: [{ type: 'input_text', text }] }); }
function tool(name, args) { return row('response_item', { type: 'function_call', name, arguments: JSON.stringify(args) }); }
function fixture(n, { start = '2026-09-01T00:00:00Z', end = '2026-09-01T01:00:00Z', project = cwd, subagent = false, archived = false, rows = [] } = {}) {
  const dir = path.join(env.CODEX_HOME, archived ? 'archived_sessions' : 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `rollout-${id(n)}.jsonl`);
  fs.writeFileSync(file, [row('session_meta', { id: id(n), cwd: project, timestamp: start, ...(subagent ? { thread_source: 'subagent' } : {}) }, start), ...rows].map(JSON.stringify).join('\n') + '\n');
  const stamp = new Date(end);
  fs.utimesSync(file, stamp, stamp);
  return file;
}
function run(script, args) {
  return spawnSync(process.execPath, [path.join(__dirname, script), ...args], { env, encoding: 'utf8' });
}
function restore(file, args = ['--append']) { return run('restore-ledger.js', [file, ...args]); }
function cache(n) { return path.join(tmp, '.claude', 'super-token-saver-data', 'codex', hash, id(n)); }
try {
  fixture(1, { archived: true, rows: [message('user', 'ARCHIVED_PREDECESSOR')] });
  fixture(2, { end: '2026-09-03T00:00:00Z', rows: [message('user', 'EARLIER_STARTED_OVERLAP')] });
  fixture(3, { start: '2026-09-03T00:00:00Z', rows: [message('user', 'LATER_SESSION')] });
  fixture(4, { project: '/another/project', rows: [message('user', 'OTHER_PROJECT')] });
  fixture(5, { subagent: true, rows: [message('user', 'SUBAGENT_SESSION')] });
  const file = fixture(10, { start: '2026-09-02T00:00:00Z', end: '2026-09-02T01:00:00Z', rows: [
    message('user', 'CURRENT_HUMAN'), message('assistant', 'LONG_REPLY_' + 'x'.repeat(900)),
    tool('spawn_agent', { task_name: 'worker-one', message: 'DISPATCH_BODY' }),
    tool('send_message', { target: 'worker-one', message: 'OUTBOUND_BODY' }),
    tool('collaboration.followup_task', { target: 'worker-one', message: 'FOLLOWUP_BODY' }),
    message('developer', 'Message Type: MESSAGE\nSender: worker-one\nPayload:\nINBOUND_BODY'),
    message('developer', 'Message Type: FINAL_ANSWER\nSender: worker-one\nPayload:\nCOMPLETION_BODY'),
    message('developer', 'Message Type: NEW_TASK\nSender: root\nPayload:\nNEW_TASK_BODY'),
    message('developer', 'Ordinary instruction quoting Message Type: MESSAGE GENERIC_INJECTION'),
    tool('exec_command', { cmd: 'GENERIC_TOOL' }),
  ] });
  const handoff = path.join(tmp, '.claude', 'super-token-saver-data', hash, 'handoff.md');
  fs.mkdirSync(path.dirname(handoff), { recursive: true });
  fs.writeFileSync(handoff, 'SHARED_HANDOFF');
  let r = restore(file);
  check('automatic restore succeeds', r.status === 0);
  for (const marker of ['CURRENT_HUMAN', 'DISPATCH_BODY', 'OUTBOUND_BODY', 'FOLLOWUP_BODY', 'INBOUND_BODY', 'COMPLETION_BODY', 'NEW_TASK_BODY', 'SHARED_HANDOFF', 'ARCHIVED_PREDECESSOR']) check(`keeps ${marker}`, r.stdout.includes(marker));
  check('outgoing recipient identity survives', r.stdout.includes('send_message → worker-one'));
  check('spawn task identity survives', r.stdout.includes('spawn_agent → worker-one'));
  for (const marker of ['EARLIER_STARTED_OVERLAP', 'LATER_SESSION', 'OTHER_PROJECT', 'SUBAGENT_SESSION', 'GENERIC_INJECTION', 'GENERIC_TOOL']) check(`excludes ${marker}`, !r.stdout.includes(marker));
  check('full newest reply survives', r.stdout.includes('x'.repeat(900)));
  check('original communication line marker survives', /L5\] Assistant:/.test(r.stdout));
  check('injected predecessor names original rollout', r.stdout.includes(`rollout-${id(1)}.jsonl`));
  const ledger = path.join(cache(10), 'restore-ledger.md');
  const before = fs.readFileSync(ledger, 'utf8');
  restore(file);
  check('repeated append is idempotent', fs.readFileSync(ledger, 'utf8') === before);
  const normalized = path.join(tmp, '.claude', 'super-token-saver-data', 'codex', '.normalized', hash, `${id(10)}.jsonl`);
  r = restore(normalized);
  check('normalized input preserves original source', fs.readFileSync(ledger, 'utf8').includes(`# transcript: ${file}`));
  check('normalized input excludes parallel siblings', !r.stdout.includes('EARLIER_STARTED_OVERLAP'));
  check('normalized input discovers original predecessor', r.stdout.includes('ARCHIVED_PREDECESSOR'));
  fs.appendFileSync(file, JSON.stringify(message('assistant', 'SECOND_COMPACTION_' + 'y'.repeat(900))) + '\n');
  r = restore(file);
  check('second Codex compaction keeps newest text verbatim', r.stdout.includes('y'.repeat(900)));
  check('second Codex compaction folds older reply', !r.stdout.includes('x'.repeat(900)));
  check('second Codex compaction keeps older human instruction', r.stdout.includes('CURRENT_HUMAN'));

  // An old cursor has already stepped over agent messages; regeneration must recover them.
  fs.writeFileSync(ledger, `# restore-ledger — session ${id(10)}\n# transcript: ${file}\n\n### ▶ segment 1 — L2..L3 — a → b\n\n[Session:00000010 2026-09-02T00:00:01Z L2] User:\nOLD_VALID_HISTORY\n`);
  fs.writeFileSync(path.join(cache(10), 'restore-cursor'), '11');
  const stamp = path.join(path.dirname(normalized), `${id(10)}.jsonl.meta.json`);
  fs.writeFileSync(stamp, JSON.stringify({ version: 3 }));
  fs.writeFileSync(normalized, fs.readFileSync(normalized, 'utf8').split('\n').map(l => l.includes('codex_agent_comm') ? '{"type":"codex_skip"}' : l).join('\n'));
  r = restore(file);
  check('stale normalization and ledger recover skipped communication', r.stdout.includes('OUTBOUND_BODY'));
  check('migration preserves original ledger backup', fs.existsSync(`${ledger}.v1.bak`) && fs.readFileSync(`${ledger}.v1.bak`, 'utf8').includes('OLD_VALID_HISTORY'));
  const migrated = fs.readFileSync(ledger, 'utf8');
  restore(file);
  check('migration is idempotent', fs.readFileSync(ledger, 'utf8') === migrated);

  const short = fixture(20, { start: '2026-09-02T00:00:00Z', rows: [message('user', 'SHORT_SOURCE')] });
  restore(short);
  const shortLedger = path.join(cache(20), 'restore-ledger.md');
  const retained = '# restore-ledger\n# transcript: ' + short + '\n\nOLD_COMPLETE_HISTORY\n';
  fs.writeFileSync(shortLedger, retained); fs.writeFileSync(path.join(cache(20), 'restore-cursor'), '999');
  restore(short);
  check('truncated source cannot replace old ledger', fs.readFileSync(shortLedger, 'utf8') === retained);

  const manual = [[], ['--level', '1'], ['--level', '2'], ['--level', '3']].map(flags => run('restore.js', [file, ...flags]));
  check('manual levels are ignored', manual.every(v => v.status === 0 && v.stdout === manual[0].stdout));
  check('manual output excludes ledger-only communication', !manual[0].stdout.includes('OUTBOUND_BODY'));
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'hooks/hooks-codex.json'), 'utf8'));
  const command = registry.hooks.SessionStart.find(e => e.matcher === 'compact').hooks[0];
  check('Codex engine does not spill self-budgeted restore', command.additionalContextLimit === 0);
  check('registry timeout exceeds child timeout', command.timeout > 30);
  const hk = spawnSync('/bin/sh', ['-c', command.command], { env: { ...env, CLAUDE_PLUGIN_ROOT: root }, input: JSON.stringify({ source: 'compact', session_id: id(10), transcript_path: file }), encoding: 'utf8' });
  const context = JSON.parse(hk.stdout).hookSpecificOutput.additionalContext;
  check('registry-selected hook delivers automatic ledger', context.startsWith('# Restored:') && context.includes('OUTBOUND_BODY'));
  const startup = spawnSync('/bin/sh', ['-c', command.command], { env: { ...env, CLAUDE_PLUGIN_ROOT: root }, input: JSON.stringify({ source: 'startup', transcript_path: file }), encoding: 'utf8' });
  check('startup does not auto-restore', startup.status === 0 && startup.stdout === '');
  const missing = spawnSync('/bin/sh', ['-c', command.command], { env: { ...env, CLAUDE_PLUGIN_ROOT: root }, input: JSON.stringify({ source: 'compact', transcript_path: path.join(tmp, 'missing file.jsonl') }), encoding: 'utf8' });
  check('failure stays on automatic path', missing.stdout.includes('restore-ledger.js') && missing.stdout.includes('--append') && !missing.stdout.includes('invoke the s-continue skill'));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`restore parity: ${failures ? `${failures} FAIL` : 'PASS'}`);
process.exitCode = failures ? 1 : 0;
