#!/usr/bin/env node
/**
 * test-restore-ledger.js — gate for the after-compact restore path (scripts/restore-ledger.js).
 *
 * Runs against a synthetic transcript under a throwaway HOME, so it needs no real session and
 * never touches the user's cache tree. It pins the four properties the path exists for:
 *
 *   1. The window is cursor-based, not boundary-based. The hook runs before Claude Code writes
 *      the compact_boundary record (measured 112 ms before), so a boundary-anchored window handed
 *      back the segment before the one just dropped. Here the boundary is deliberately absent
 *      from the transcript at hook time, and the restore must still cover up to the last line.
 *   2. What is kept verbatim in the newest segment: human turns, assistant text, teammate
 *      messages, subagent task notifications, and SendMessage bodies. What is dropped: tool_use /
 *      tool_result traffic, local-command echoes, meta records, and the injected compact summary
 *      (flagged at the record level, which is where Claude Code puts it).
 *   3. Successive compactions append successive segments; the newest is verbatim and the older
 *      ones are folded with every human turn whole and an L{n} marker on every entry.
 *   4. The token budget holds even when the newest segment alone exceeds it, and the
 *      restore never comes back empty while there is anything to restore.
 *
 * Usage: node scripts/test-restore-ledger.js
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..");
const SCRIPT = path.join(REPO, "scripts", "restore-ledger.js");

let failures = 0;
function check(name, cond, detail) {
  if (!cond) failures++;
  console.log(`${cond ? "OK  " : "FAIL"} ${name}${cond || !detail ? "" : `\n       ${detail}`}`);
}

// ── synthetic transcript ─────────────────────────────────────────────────────

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "sts-ledger-"));
const PROJECT = "-Users-test-proj";
const SID = "11111111-2222-3333-4444-555555555555";
const projDir = path.join(HOME, ".claude", "projects", PROJECT);
fs.mkdirSync(projDir, { recursive: true });
const transcript = path.join(projDir, `${SID}.jsonl`);

let t = 0;
const ts = () => new Date(Date.UTC(2026, 8, 6, 0, 0, t++)).toISOString();
const user = (text, extra = {}) => JSON.stringify({ type: "user", timestamp: ts(), sessionId: SID, message: { role: "user", content: text }, ...extra });
const assistant = (blocks) => JSON.stringify({ type: "assistant", timestamp: ts(), sessionId: SID, message: { role: "assistant", content: blocks } });
const toolResult = () => JSON.stringify({ type: "user", timestamp: ts(), sessionId: SID, message: { role: "user", content: [{ type: "tool_result", tool_use_id: "x", content: "TOOL_RESULT_BODY" }] } });
const boundary = () => JSON.stringify({ type: "system", subtype: "compact_boundary", timestamp: ts(), sessionId: SID, compactMetadata: { trigger: "auto" } });

const seg1 = [
  user("first human turn: keep going until morning"),
  assistant([{ type: "text", text: "reply one " + "x".repeat(600) }, { type: "tool_use", id: "1", name: "Bash", input: { command: "echo TOOL_USE_INPUT" } }]),
  toolResult(),
  user("Another Claude session sent a message:\n<teammate-message teammate_id=\"qa-sol\">QA PASS on gate 6 " + "y".repeat(700) + "</teammate-message>"),
  assistant([{ type: "tool_use", id: "2", name: "SendMessage", input: { to: "qa-sol", message: "SENDMESSAGE_BODY run the mutation check" } }]),
  user("<task-notification>\n<task-id>abc</task-id>\n<summary>Agent finished</summary>\n</task-notification>"),
  user("<local-command-stdout>ignored echo</local-command-stdout>"),
  user("meta record", { isMeta: true }),
];
const summary = JSON.stringify({ type: "user", timestamp: ts(), sessionId: SID, isCompactSummary: true, message: { role: "user", content: "This session is being continued from a previous conversation. COMPACT_SUMMARY_BODY" } });
const seg2 = [user("second human turn: do not narrow the scope"), assistant([{ type: "text", text: "reply two, short" }])];

function write(lines) {
  fs.writeFileSync(transcript, lines.join("\n") + "\n");
}
function run(args) {
  const r = spawnSync(process.execPath, [SCRIPT, transcript, ...args], { encoding: "utf8", env: { ...process.env, HOME } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const cacheDir = path.join(HOME, ".claude", "super-token-saver-data", PROJECT, SID);

// ── 1. first compaction: boundary NOT yet written ────────────────────────────

write(seg1);
let r = run(["--append"]);
check("first append exits 0", r.code === 0, r.err);
check("cursor covers the last line", fs.readFileSync(path.join(cacheDir, "restore-cursor"), "utf8").trim() === String(seg1.length));
check("human turn kept verbatim", r.out.includes("keep going until morning"));
check("assistant text kept verbatim (600+ chars)", r.out.includes("reply one " + "x".repeat(600)));
check("teammate message kept verbatim (700+ chars)", r.out.includes("y".repeat(700)));
check("SendMessage body kept", r.out.includes("SENDMESSAGE_BODY"));
check("task notification kept", r.out.includes("<task-notification>"));
check("tool_use input dropped", !r.out.includes("TOOL_USE_INPUT"));
check("tool_result dropped", !r.out.includes("TOOL_RESULT_BODY"));
check("local-command echo dropped", !r.out.includes("ignored echo"));
check("meta record dropped", !r.out.includes("meta record"));
check("every entry carries an L{n} marker", (r.out.match(/^\[Session:[0-9a-f]{8} \S+ L\d+\] \w+:$/gm) || []).length === 5);
check("one segment header", (r.out.match(/^### ▶ segment 1 — /m) || []).length === 1);

// ── 2. second compaction: boundary + summary now on disk, then new turns ─────

write([...seg1, boundary(), summary, ...seg2]);
r = run(["--append"]);
check("second append exits 0", r.code === 0, r.err);
check("compact summary dropped (record-level flag)", !r.out.includes("COMPACT_SUMMARY_BODY"));
check("boundary rendered as a marker", r.out.includes("[auto-compact boundary]"));
check("newest segment (2) verbatim", r.out.includes("reply two, short") && /^### ▶ segment 2 — /m.test(r.out));
check("older segment (1) present and folded", /^### ▶ segment 1 — /m.test(r.out) && r.out.includes("read L{n} for the rest"));
check("folded segment keeps the human turn whole", r.out.includes("keep going until morning"));
check("folded reply no longer carries its full 600 chars", !r.out.includes("x".repeat(600)));
check("segments emitted oldest first", r.out.indexOf("### ▶ segment 1") < r.out.indexOf("### ▶ segment 2"));
check("dry render (no --append) is identical", run([]).out === r.out);
check("ledger holds both segments", (fs.readFileSync(path.join(cacheDir, "restore-ledger.md"), "utf8").match(/^### ▶ segment \d+ — /gm) || []).length === 2);

// ── 3. budget: newest segment alone larger than the budget ───────────────────

const big = [];
for (let i = 0; i < 40; i++) big.push(user(`bulk turn ${i}`), assistant([{ type: "text", text: `bulk reply ${i} ` + "z".repeat(900) }]));
write([...seg1, boundary(), summary, ...seg2, boundary(), ...big]);
r = run(["--append", "--budget", "2500"]);
check("tight budget still exits 0", r.code === 0, r.err);
check("output within budget", require(SCRIPT).estimateTokens(r.out) <= 2500, `got ${require(SCRIPT).estimateTokens(r.out)} tokens`);
check("tail of the newest segment kept, not the head", r.out.includes("bulk turn 39") && !r.out.includes("bulk turn 0\n"));
check("earlier-entries note present", /\(\d+ earlier entries in this segment left on disk/.test(r.out));

// ── 4. an earlier session of the same project is picked up, folded ───────────

const SID2 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const older = path.join(HOME, ".claude", "super-token-saver-data", PROJECT, SID2);
fs.mkdirSync(older, { recursive: true });
fs.writeFileSync(path.join(older, "restore-ledger.md"), `# restore-ledger — session ${SID2}\n\n### ▶ segment 1 — L1..L2 — a → b\n\n[Session:aaaaaaaa 2026-09-05T00:00:00.000Z L1] User:\nEARLIER_SESSION_HUMAN_TURN\n\n[Session:aaaaaaaa 2026-09-05T00:00:01.000Z L2] Assistant:\n${"w".repeat(500)}\n`);
const past = Date.now() / 1000 - 3600;
fs.utimesSync(path.join(older, "restore-ledger.md"), past, past);
fs.writeFileSync(path.join(HOME, ".claude", "super-token-saver-data", PROJECT, "handoff.md"), "HANDOFF_BODY from /s-compact");
r = run([]);
check("earlier session's human turn included", r.out.includes("EARLIER_SESSION_HUMAN_TURN"));
check("earlier session folded", !r.out.includes("w".repeat(500)) && r.out.includes("earlier session " + SID2));
check("handoff.md included", r.out.includes("HANDOFF_BODY") && r.out.includes("handoff written by /s-compact"));
check("earlier session precedes this session's segments", r.out.indexOf("EARLIER_SESSION_HUMAN_TURN") < r.out.indexOf("[Session:11111111"));

// ── 4b. a sibling that never compacted has no ledger yet; a parallel one is left out ──

const SID3 = "33333333-3333-3333-3333-333333333333";
const sib = path.join(projDir, `${SID3}.jsonl`);
fs.writeFileSync(sib, [
  JSON.stringify({ type: "user", timestamp: "2026-09-05T10:00:00.000Z", sessionId: SID3, message: { role: "user", content: "NEVER_COMPACTED_SIBLING_TURN" } }),
  JSON.stringify({ type: "assistant", timestamp: "2026-09-05T10:00:01.000Z", sessionId: SID3, message: { role: "assistant", content: [{ type: "text", text: "sibling reply" }] } }),
].join("\n") + "\n");
const before = Date.UTC(2026, 8, 5, 12) / 1000; // stopped changing before this session's first record (2026-09-06)
fs.utimesSync(sib, before, before);
const SID4 = "44444444-4444-4444-4444-444444444444";
fs.writeFileSync(path.join(projDir, `${SID4}.jsonl`), JSON.stringify({ type: "user", timestamp: "2026-09-06T00:00:00.000Z", sessionId: SID4, message: { role: "user", content: "PARALLEL_SESSION_TURN" } }) + "\n");
r = run([]);
check("sibling that never compacted is appended lazily and included", r.out.includes("NEVER_COMPACTED_SIBLING_TURN") && fs.existsSync(path.join(HOME, ".claude", "super-token-saver-data", PROJECT, SID3, "restore-ledger.md")));
check("session still being written after this one began is left out", !r.out.includes("PARALLEL_SESSION_TURN"));
check("earlier sessions rendered oldest first", r.out.indexOf("NEVER_COMPACTED_SIBLING_TURN") < r.out.indexOf("EARLIER_SESSION_HUMAN_TURN"));

// ── 4c. the hook end to end: JSON out, restored text in, no f-string casualty ─

const hook = path.join(REPO, "hooks", "s-continue-after-compact.sh");
const hk = spawnSync("bash", [hook], { input: JSON.stringify({ source: "compact", session_id: SID, transcript_path: transcript }), encoding: "utf8", env: { ...process.env, HOME } });
let ctx = "";
try { ctx = JSON.parse(hk.stdout).hookSpecificOutput.additionalContext; } catch {}
check("hook emits SessionStart JSON with additionalContext", hk.status === 0 && ctx.length > 0, hk.stdout.slice(0, 200));
check("hook delivered the restore, not the fallback instruction", ctx.startsWith("# Restored:") && ctx.includes("bulk turn 39"));
check("hook text keeps the literal L{n} placeholder", ctx.includes("L{n}"));

// ── 4d. a Codex rollout is normalized first and lands in the codex cache tree ─

const codexHome = path.join(HOME, "codex-home");
fs.mkdirSync(path.join(codexHome, "sessions"), { recursive: true });
const CSID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const rollout = path.join(codexHome, "sessions", `rollout-${CSID}.jsonl`);
const crow = (o) => JSON.stringify(o);
fs.writeFileSync(rollout, [
  crow({ timestamp: "2026-09-06T01:00:00Z", type: "session_meta", payload: { id: CSID, session_id: CSID, cwd: "/Users/test/codexproj", timestamp: "2026-09-06T01:00:00Z" } }),
  crow({ timestamp: "2026-09-06T01:00:01Z", type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "CODEX_HUMAN_TURN keep the ledger" }] } }),
  crow({ timestamp: "2026-09-06T01:00:02Z", type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "CODEX_REPLY" }] } }),
  crow({ timestamp: "2026-09-06T01:00:03Z", type: "event_msg", payload: { type: "token_count", info: {} } }),
].join("\n") + "\n");
const cx = spawnSync(process.execPath, [SCRIPT, rollout, "--append"], { encoding: "utf8", env: { ...process.env, HOME, CODEX_HOME: codexHome } });
check("codex rollout restores its human turn and reply", cx.status === 0 && cx.stdout.includes("CODEX_HUMAN_TURN") && cx.stdout.includes("CODEX_REPLY"), cx.stderr);
check("codex entries keep the rollout's own line numbers", /L2\] User:/.test(cx.stdout) && /L3\] Assistant:/.test(cx.stdout));
const codexLedgers = [];
(function walk(d) { let es = []; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; } for (const e of es) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (e.name === "restore-ledger.md") codexLedgers.push(f); } })(path.join(HOME, ".claude", "super-token-saver-data", "codex"));
check("codex ledger lives under the codex cache subtree", codexLedgers.length === 1 && codexLedgers[0].includes(CSID));

// ── 5. nothing to restore is an error, never an empty success ────────────────
// A different project dir, so no handoff.md or earlier ledger is there to be restored.

const emptyProj = path.join(HOME, ".claude", "projects", "-Users-test-other");
fs.mkdirSync(emptyProj, { recursive: true });
const EMPTY = path.join(emptyProj, "99999999-0000-0000-0000-000000000000.jsonl");
fs.writeFileSync(EMPTY, toolResult() + "\n");
const e = spawnSync(process.execPath, [SCRIPT, EMPTY, "--append"], { encoding: "utf8", env: { ...process.env, HOME } });
check("tool-only transcript exits 2 with no stdout", e.status === 2 && e.stdout === "");

fs.rmSync(HOME, { recursive: true, force: true });
console.log(failures === 0 ? "\nrestore-ledger gate: PASS" : `\nrestore-ledger gate: ${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
