#!/usr/bin/env node
/**
 * test-list-sessions-nonint.js — non-interactive (`claude -p` / `codex exec`)
 * sessions are excluded from listing, but the session actually running now
 * never is, even if it happens to be one.
 *
 * Signal: every JSONL row of a `claude -p` session carries
 * `entrypoint: "sdk-cli"`; a human-opened session carries `entrypoint: "cli"`.
 * It rides on an early non-"user" row (an "attachment" row in real
 * transcripts), so detection must not be gated on `type === "user"`.
 * Codex: `session_meta.payload.source === "exec"` marks `codex exec` / SDK
 * runs; "cli" or "vscode" marks a human-opened session.
 *
 * Usage: node test-list-sessions-nonint.js
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

let failures = 0;
function check(name, actual, expected) {
  let value;
  try { value = typeof actual === "function" ? actual() : actual; } catch (e) { value = `threw: ${e.message}`; }
  const ok = JSON.stringify(value) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${ok ? "" : `\n       expected ${JSON.stringify(expected)}\n       actual   ${JSON.stringify(value)}`}`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "list-sessions-nonint-test-"));

function row(obj) { return JSON.stringify(obj); }
function userRow(text, ts, sessionId) {
  return row({ type: "user", message: { role: "user", content: text }, timestamp: ts, sessionId });
}
function entrypointRow(entrypoint, ts, sessionId) {
  // Real transcripts carry `entrypoint` on an early "attachment" row, not on
  // the "user" row itself — the fixture mirrors that shape deliberately.
  return row({ type: "attachment", entrypoint, timestamp: ts, sessionId });
}

const now = Date.now();
const old = (mins) => new Date(now - mins * 60 * 1000).toISOString();

// A: human-opened session (entrypoint "cli") — must be kept.
const idA = "aaaaaaaa-0000-4000-8000-000000000001";
fs.writeFileSync(path.join(tmp, `${idA}.jsonl`), [
  entrypointRow("cli", old(120), idA),
  userRow("hello from an interactive session", old(120), idA),
].join("\n") + "\n");

// B: `claude -p` one-shot (entrypoint "sdk-cli"), not the running session —
// must be excluded.
const idB = "bbbbbbbb-0000-4000-8000-000000000002";
fs.writeFileSync(path.join(tmp, `${idB}.jsonl`), [
  entrypointRow("sdk-cli", old(60), idB),
  userRow('Stage "film" and render the intro', old(60), idB),
].join("\n") + "\n");

// C: `claude -p` one-shot that IS the running session (most recent activity)
// — must be kept despite entrypoint "sdk-cli".
const idC = "cccccccc-0000-4000-8000-000000000003";
fs.writeFileSync(path.join(tmp, `${idC}.jsonl`), [
  entrypointRow("sdk-cli", old(0), idC),
  userRow("this is the session running right now", old(0), idC),
].join("\n") + "\n");

const out = execFileSync(
  "node",
  [path.join(__dirname, "list-sessions.js"), tmp, "--source", "claude", "--current-source", "claude", "--limit", "10"],
  { encoding: "utf8" },
);
const sessions = JSON.parse(out);
const byId = Object.fromEntries(sessions.map((s) => [s.id, s]));

check("cli session kept", !!byId[idA], true);
check("cli session not flagged non-interactive", byId[idA] && byId[idA].nonInteractive, false);
check("sdk-cli session excluded", !!byId[idB], false);
check("current session kept even though it is sdk-cli", !!byId[idC], true);
check("current session flagged both current and non-interactive", byId[idC] && [byId[idC].isCurrent, byId[idC].nonInteractive], [true, true]);
check("exactly A and C are listed", sessions.map((s) => s.id).sort(), [idA, idC].sort());

// Codex: the same rule keyed on session_meta.payload.source — "cli"/"vscode"
// for a human-opened session, "exec" for `codex exec` / SDK runs. HOME and
// CODEX_HOME are isolated so the normalizer's cache stays inside tmp.
const codexHome = path.join(tmp, "codex");
const codexEnv = { ...process.env, HOME: tmp, CODEX_HOME: codexHome };
const codexProject = "/fixture/list-sessions-nonint";
function codexRollout(id, source, ts, text) {
  const dir = path.join(codexHome, "sessions");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `rollout-${id}.jsonl`);
  fs.writeFileSync(file, [
    { type: "session_meta", payload: { id, cwd: codexProject, timestamp: ts, source }, timestamp: ts },
    { type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text }] }, timestamp: ts },
  ].map(JSON.stringify).join("\n") + "\n");
}

const cxA = "dddddddd-0000-4000-8000-000000000004";
const cxB = "eeeeeeee-0000-4000-8000-000000000005";
const cxC = "ffffffff-0000-4000-8000-000000000006";
codexRollout(cxA, "cli", old(120), "hello from an interactive codex session");
codexRollout(cxB, "exec", old(60), "codex exec one-shot render pass");
codexRollout(cxC, "exec", old(0), "this codex exec run is the running session");

const emptyClaudeDir = path.join(tmp, "empty-claude");
fs.mkdirSync(emptyClaudeDir);
const codexOut = execFileSync(
  "node",
  [path.join(__dirname, "list-sessions.js"), emptyClaudeDir, "--source", "codex", "--cwd", codexProject, "--current-source", "codex", "--limit", "10"],
  { encoding: "utf8", env: codexEnv },
);
const codexSessions = JSON.parse(codexOut);
const cxById = Object.fromEntries(codexSessions.map((s) => [s.id, s]));

check("codex cli session kept", !!cxById[cxA], true);
check("codex cli session not flagged non-interactive", cxById[cxA] && cxById[cxA].nonInteractive, false);
check("codex exec session excluded", !!cxById[cxB], false);
check("codex current session kept even though it is exec", cxById[cxC] && [cxById[cxC].isCurrent, cxById[cxC].nonInteractive], [true, true]);
check("exactly codex A and C are listed", codexSessions.map((s) => s.id).sort(), [cxA, cxC].sort());

fs.rmSync(tmp, { recursive: true, force: true });

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
