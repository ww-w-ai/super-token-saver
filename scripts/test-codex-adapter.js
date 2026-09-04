#!/usr/bin/env node
/**
 * test-codex-adapter.js — gate for the Codex → Claude-shape normalizer.
 *
 * Builds a synthetic rollout so the test needs no real transcript, then checks
 * the properties the rest of the pipeline depends on:
 *   - one output line per input line (this is what keeps L{n} pointing at the
 *     Codex original)
 *   - user / assistant messages carried across, developer messages dropped
 *   - injected context marked isMeta so it is not counted as a typed turn
 *   - Codex compaction reported in the vocabulary CC's detector already reads
 *   - a subagent rollout identified by its own id, not its parent's
 *
 * Usage: node test-codex-adapter.js
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const codex = require("./lib/codex-transcript");

let failures = 0;
// `actual` may be a thunk, so a mutation that removes a field reports FAIL
// instead of throwing — a crash is not a verdict.
function check(name, actual, expected) {
  let value;
  try { value = typeof actual === "function" ? actual() : actual; } catch (e) { value = `threw: ${e.message}`; }
  const ok = JSON.stringify(value) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${ok ? "" : `\n       expected ${JSON.stringify(expected)}\n       actual   ${JSON.stringify(value)}`}`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-adapter-test-"));
const workCwd = path.join(tmp, "project");
fs.mkdirSync(workCwd, { recursive: true });
// Point the adapter at a throwaway Codex home so the fixtures below are the
// only sessions it can see.
const codexHome = path.join(tmp, "codex-home");
fs.mkdirSync(path.join(codexHome, "sessions"), { recursive: true });
process.env.CODEX_HOME = codexHome;

function row(obj) { return JSON.stringify(obj); }

function msg(role, text, ts) {
  return row({ timestamp: ts, type: "response_item", payload: { type: "message", role, content: [{ type: role === "assistant" ? "output_text" : "input_text", text }] } });
}

function writeRollout(name, meta, bodyLines) {
  const p = path.join(codexHome, "sessions", name);
  fs.writeFileSync(p, [row({ timestamp: meta.timestamp, type: "session_meta", payload: meta }), ...bodyLines].join("\n") + "\n");
  return p;
}

// --- main session ---------------------------------------------------------
const mainMeta = {
  session_id: "aaaa1111-0000-4000-8000-000000000001",
  id: "aaaa1111-0000-4000-8000-000000000001",
  cwd: workCwd,
  timestamp: "2026-01-01T00:00:00.000Z",
  thread_source: "user",
};
const body = [
  msg("developer", "<skills_instructions>internal</skills_instructions>", "2026-01-01T00:00:01Z"),
  msg("user", "# AGENTS.md instructions\nglobal rules", "2026-01-01T00:00:02Z"),
  msg("user", "port the reader to rust", "2026-01-01T00:00:03Z"),
  row({ timestamp: "2026-01-01T00:00:04Z", type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { input_tokens: 10, total_tokens: 10 } } } }),
  msg("assistant", "starting the port", "2026-01-01T00:00:05Z"),
  row({ timestamp: "2026-01-01T00:00:06Z", type: "compacted", payload: {} }),
  msg("user", "keep going", "2026-01-01T00:00:07Z"),
  row({ timestamp: "2026-01-01T00:00:08Z", type: "event_msg", payload: { type: "thread_rolled_back" } }),
  row({ timestamp: "2026-01-01T00:00:09Z", type: "event_msg", payload: { type: "some_other_event" } }),
  "",                                   // blank line
  "{ not json",                          // malformed line
];
const mainPath = writeRollout("rollout-main.jsonl", mainMeta, body);

const meta = codex.readSessionMeta(mainPath);
check("main session keyed by its own id", meta.sessionId, mainMeta.id);
check("main session is not a subagent", meta.isSubagent, false);
check("main session cwd", meta.cwd, workCwd);

const normalized = codex.normalizeCodexTranscript(mainPath, meta);
const srcLines = fs.readFileSync(mainPath, "utf8").replace(/\n$/, "").split("\n");
const dstLines = fs.readFileSync(normalized, "utf8").replace(/\n$/, "").split("\n");
check("one output line per input line", dstLines.length, srcLines.length);

const parsed = dstLines.map((l) => JSON.parse(l));
check("developer message dropped", parsed[1].type, "codex_skip");
check("injected AGENTS.md marked meta", [parsed[2].type, parsed[2].isMeta], ["user", true]);
check("typed user turn carried", () => parsed[3].message.content[0].text, "port the reader to rust");
check("typed user turn is not meta", parsed[3].isMeta, undefined);
check("token_count is translated, not dropped (usage-view needs it)", () => [parsed[4].type, parsed[4].totalTokenUsage.total_tokens], ["codex_token_count", 10]);
check("assistant turn carried", () => [parsed[5].type, parsed[5].message.role], ["assistant", "assistant"]);
check("compaction becomes a compact_boundary", () => [parsed[6].type, parsed[6].subtype, parsed[6].compactMetadata.trigger], ["system", "compact_boundary", "auto"]);
check("rollback becomes a manual boundary", () => [parsed[8].type, parsed[8].compactMetadata.trigger], ["system", "manual"]);
check("an unrecognized event_msg type is still dropped", parsed[9].type, "codex_skip");
check("blank line kept as placeholder", parsed[10].type, "codex_skip");
check("malformed line kept as placeholder", parsed[11].type, "codex_skip");

// --- subagent rollout -----------------------------------------------------
const subPath = writeRollout("rollout-sub.jsonl", {
  session_id: mainMeta.session_id,                    // inherited from the parent
  id: "bbbb2222-0000-4000-8000-000000000002",         // its own
  cwd: workCwd,
  timestamp: "2026-01-01T00:10:00.000Z",
  thread_source: "subagent",
  source: { subagent: { thread_spawn: { parent_thread_id: mainMeta.session_id, agent_role: "worker", agent_nickname: "Lagrange" } } },
}, [msg("user", "do the sub task", "2026-01-01T00:10:01Z")]);

const subMeta = codex.readSessionMeta(subPath);
check("subagent keyed by its own id, not the parent's", subMeta.sessionId, "bbbb2222-0000-4000-8000-000000000002");
check("subagent thread id points at the parent", subMeta.threadId, mainMeta.session_id);
check("subagent flagged", subMeta.isSubagent, true);
check("subagent role captured", () => subMeta.agent.role, "worker");
check(
  "normalized paths differ despite the shared session_id",
  codex.normalizedPathFor(workCwd, meta.sessionId) === codex.normalizedPathFor(workCwd, subMeta.sessionId),
  false,
);

// --- listing + preprocess end to end --------------------------------------
const listed = execFileSync("node", [path.join(__dirname, "list-sessions.js"), "--source", "codex", "--cwd", workCwd, "--limit", "10"], { encoding: "utf8", env: { ...process.env, CODEX_HOME: codexHome } });
const sessions = JSON.parse(listed);
check("listing returns the main session only", sessions.map((x) => x.id), [mainMeta.id]);
check("listing tags the source", () => sessions[0].source, "codex");
check("listing sees the Codex compaction", () => sessions[0].hasContextLoss, true);
check("listing counts only typed turns", () => sessions[0].userMsgCount, 2);
check("listing points at the rollout", () => sessions[0].originalPath, mainPath);

// A fresh Codex session may need a new normalized copy. If the host sandbox
// blocks that write, listing must fail instead of silently omitting the newest
// session and returning an older one as `last`.
const blockedHome = path.join(tmp, "home-is-a-file");
fs.writeFileSync(blockedHome, "not a directory");
let blockedListing = null;
try {
  execFileSync(
    "node",
    [path.join(__dirname, "list-sessions.js"), "--source", "codex", "--cwd", workCwd, "--limit", "10"],
    { encoding: "utf8", env: { ...process.env, CODEX_HOME: codexHome, HOME: blockedHome }, stdio: "pipe" },
  );
} catch (err) {
  blockedListing = String(err.stderr || err.message);
}
check("listing fails closed when normalization cache is unwritable", () => blockedListing.includes("failed to normalize Codex session"), true);

if (sessions[0]) execFileSync("node", [path.join(__dirname, "preprocess.js"), sessions[0].path, "--original", mainPath], { encoding: "utf8" });
const cachePath = path.join(os.homedir(), ".claude", "super-token-saver-data", "codex", workCwd.replace(/[^a-zA-Z0-9]/g, "-"), mainMeta.id, "compact.txt");
const compact = fs.existsSync(cachePath) ? fs.readFileSync(cachePath, "utf8") : "";
check("compact records the boundary", compact.includes("[auto-compact boundary]"), true);
check("compact keeps the typed turn", compact.includes("port the reader to rust"), true);
check("compact footer names the rollout", compact.includes(mainPath), true);

fs.rmSync(tmp, { recursive: true, force: true });
fs.rmSync(path.dirname(cachePath), { recursive: true, force: true });
fs.rmSync(codex.normalizedPathFor(workCwd, meta.sessionId), { force: true });

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
