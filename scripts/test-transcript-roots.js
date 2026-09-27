#!/usr/bin/env node
/**
 * test-transcript-roots.js — analyze-usage must read every Claude Code config dir,
 * not only ~/.claude. One person's usage is split across per-account config dirs
 * (CLAUDE_CONFIG_DIR, launcher account dirs); missing one undercounts the weekly limit.
 *
 * Checks:
 *   - sessions under ~/.claude, a launcher account dir, and $CLAUDE_CONFIG_DIR are all analyzed
 *   - a config dir whose own path contains `/projects/` still yields the right project name
 *   - a subagent's meta.json is read from its own root
 *   - the same root reached twice (symlink in SUPER_TOKEN_SAVER_CONFIG_DIRS) is read once
 *
 * Runs analyze-usage.js against a temp HOME. No network, no real cache touched.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPTS = __dirname;
const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'transcript-roots-')));
const S = ['11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000003'];

function session(file, sid, req) {
  const lines = [
    { type: 'user', timestamp: '2026-09-20T00:00:00.000Z', message: { role: 'user', content: 'hi' } },
    { type: 'assistant', timestamp: '2026-09-20T00:00:05.000Z', requestId: req, message: { id: 'msg_' + req, model: 'claude-opus-5', role: 'assistant', content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } },
  ];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.map((l) => JSON.stringify({ sessionId: sid, ...l })).join('\n') + '\n');
}

const defaultDir = path.join(home, '.claude');
const accountDir = path.join(home, 'Library', 'Application Support', 'ai.ww-w.vmux', 'accounts', 'acc-1');
const configDir = path.join(home, 'work', 'projects', 'acct2'); // own path contains /projects/
session(path.join(defaultDir, 'projects', '-p-one', `${S[0]}.jsonl`), S[0], 'req_1');
session(path.join(accountDir, 'projects', '-p-one', `${S[1]}.jsonl`), S[1], 'req_2');
session(path.join(accountDir, 'projects', '-p-one', S[1], 'subagents', 'agent-a1.jsonl'), S[1], 'req_2a');
fs.writeFileSync(path.join(accountDir, 'projects', '-p-one', S[1], 'subagents', 'agent-a1.meta.json'), JSON.stringify({ agentType: 'Explore' }));
session(path.join(configDir, 'projects', '-p-two', `${S[2]}.jsonl`), S[2], 'req_3');
const alias = path.join(home, 'alias-claude');
fs.symlinkSync(defaultDir, alias);

let failed = false;
const fail = (msg) => { console.error('FAIL: ' + msg); failed = true; };
try {
  const env = { ...process.env, HOME: home, CLAUDE_CONFIG_DIR: configDir, SUPER_TOKEN_SAVER_CONFIG_DIRS: alias };
  // Roots depend on os.homedir(), so resolve them in a child that sees the temp HOME.
  const childRoots = JSON.parse(execFileSync(process.execPath, ['-e', "console.log(JSON.stringify(require(process.argv[1]).claudeProjectRoots()))", path.join(SCRIPTS, 'lib', 'transcript-roots.js')], { env }).toString());
  if (childRoots.length !== 3) fail(`expected 3 roots (default, account, CLAUDE_CONFIG_DIR; alias deduped), got ${JSON.stringify(childRoots)}`);

  execFileSync(process.execPath, [path.join(SCRIPTS, 'analyze-usage.js'), '--days', 'all', '--force'], { env, stdio: ['ignore', 'ignore', 'pipe'] });
  const data = path.join(home, '.claude', 'super-token-saver-data');
  const want = [['-p-one', S[0]], ['-p-one', S[1]], ['-p-two', S[2]]];
  for (const [p, sid] of want) if (!fs.existsSync(path.join(data, p, sid, 'summary.json'))) fail(`no cache for ${p}/${sid}`);
  if (fs.existsSync(path.join(data, 'acct2'))) fail('project name taken from the config dir path, not the transcript root');
  const agent = path.join(data, '-p-one', S[1], 'subagents', 'a1', 'summary.json');
  if (!fs.existsSync(agent)) fail('subagent in the account root was not analyzed');
  else if (JSON.parse(fs.readFileSync(agent, 'utf8')).agentType !== 'Explore') fail('subagent meta.json not read from its own root');
  if (!failed) console.log('PASS: default, launcher-account and CLAUDE_CONFIG_DIR roots analyzed; symlinked root read once; meta read from own root');
} catch (e) {
  fail('run failed: ' + ((e.stderr && e.stderr.toString().slice(-400)) || e.message));
} finally {
  fs.rmSync(home, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
