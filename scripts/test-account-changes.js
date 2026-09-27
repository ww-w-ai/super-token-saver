#!/usr/bin/env node
/**
 * test-account-changes.js — analyze-usage must record the login account per session
 * from Claude Code's `session_context` attachment, as a hash, with one entry per
 * change (session start and each `/login` switch). The same sentence quoted in a
 * user message or a tool result must not count as a switch, and the address itself
 * must never reach the cache.
 *
 * Runs analyze-usage.js against a temp HOME. No network, no real cache touched.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const SCRIPTS = __dirname;
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'account-changes-'));
const proj = '-Users-me-proj';
const sid = '11111111-2222-4333-8444-555555555555';
const hash = (e) => crypto.createHash('sha256').update(e.toLowerCase()).digest('hex').slice(0, 12);
const ctx = (email) => `# userEmail\nThe user's email address is ${email}. Use it only to identify the user.`;

const lines = [
  { type: 'attachment', timestamp: '2026-09-20T00:00:00.000Z', attachment: { type: 'session_context', content: ctx('main@example.com') } },
  { type: 'user', timestamp: '2026-09-20T00:01:00.000Z', message: { role: 'user', content: 'hi' } },
  { type: 'assistant', timestamp: '2026-09-20T00:01:05.000Z', requestId: 'req_1', message: { id: 'msg_1', model: 'claude-opus-5', role: 'assistant', content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } },
  // Quoted in a tool result: must not register as a switch.
  { type: 'user', timestamp: '2026-09-20T00:02:00.000Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: ctx('quoted@example.com') }] } },
  // Same account again (context re-read without a change): no new entry.
  { type: 'attachment', timestamp: '2026-09-20T00:03:00.000Z', attachment: { type: 'session_context', content: ctx('main@example.com') } },
  { type: 'user', timestamp: '2026-09-20T00:04:00.000Z', message: { role: 'user', content: '<command-name>/login</command-name>' } },
  { type: 'attachment', timestamp: '2026-09-20T00:04:10.000Z', attachment: { type: 'session_context', content: 'The session context was re-read after the account changed; these values replace the earlier ones:\n' + ctx('Sub@Example.com') } },
];
const file = path.join(home, '.claude', 'projects', proj, `${sid}.jsonl`);
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, lines.map((l) => JSON.stringify({ sessionId: sid, ...l })).join('\n') + '\n');

let failed = false;
const fail = (msg) => { console.error('FAIL: ' + msg); failed = true; };
try {
  execFileSync(process.execPath, [path.join(SCRIPTS, 'analyze-usage.js'), '--days', 'all', '--project', proj, '--force'],
    { env: { ...process.env, HOME: home }, stdio: ['ignore', 'ignore', 'pipe'] });
  const summaryPath = path.join(home, '.claude', 'super-token-saver-data', proj, sid, 'summary.json');
  const raw = fs.readFileSync(summaryPath, 'utf8');
  const got = JSON.parse(raw).accountChanges || [];
  const want = [
    { ts: '2026-09-20T00:00:00.000Z', account: hash('main@example.com') },
    { ts: '2026-09-20T00:04:10.000Z', account: hash('sub@example.com') },
  ];
  if (JSON.stringify(got) !== JSON.stringify(want)) fail(`accountChanges ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
  if (/@example\.com/i.test(raw)) fail('an email address reached summary.json');
  if (!failed) console.log('PASS: 2 account changes recorded as hashes; quoted text and repeated context ignored');
} catch (e) {
  fail('analyze-usage.js did not run: ' + ((e.stderr && e.stderr.toString().slice(-400)) || e.message));
} finally {
  fs.rmSync(home, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
