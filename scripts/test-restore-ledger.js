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
  user("LONGHUMAN_HEAD " + "h".repeat(300) + " " + "m".repeat(600) + " " + "t".repeat(190) + " LONGHUMAN_TAIL"),
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
check("every entry carries an L{n} marker", (r.out.match(/^\[Session:[0-9a-f]{8} \S+ L\d+\] \w+:$/gm) || []).length === 6);
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
// reply fold = over 200 -> head 100 + marker + tail 100 (610 chars: "reply one " + 600 x => head keeps 90 x, tail keeps 100 x, 410 omitted)
check("folded reply is head 100 + marker + tail 100", r.out.includes("reply one " + "x".repeat(90) + " …[+410 chars, read L{n} for the rest] " + "x".repeat(100) + "\n"));
// user fold = over 500 -> head 300 + marker + tail 200
const longHuman = "LONGHUMAN_HEAD " + "h".repeat(300) + " " + "m".repeat(600) + " " + "t".repeat(190) + " LONGHUMAN_TAIL";
check("long human turn folded: head 300 + marker + tail 200", r.out.includes(longHuman.slice(0, 300) + ` …[+${longHuman.length - 500} chars, read L{n} for the rest] ` + longHuman.slice(-200)) && !r.out.includes("m".repeat(600)));
check("sections newest first: segment 2 under section 1, segment 1 under section 2",
  r.out.indexOf("## 1. This session: newest segment") < r.out.indexOf("### ▶ segment 2") &&
  r.out.indexOf("### ▶ segment 2") < r.out.indexOf("## 2. This session: earlier segments") &&
  r.out.indexOf("## 2. This session: earlier segments") < r.out.indexOf("### ▶ segment 1"));
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

// ── 4. earlier sessions: only the ones this session names, folded, label first ──
// SID2 has a ledger of two segments; SID3 is a sibling transcript that never compacted; SID4 is
// still being written after this session began. None is named yet.

const SID2 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const older = path.join(HOME, ".claude", "super-token-saver-data", PROJECT, SID2);
fs.mkdirSync(older, { recursive: true });
fs.writeFileSync(path.join(older, "restore-ledger.md"), `# restore-ledger — session ${SID2}\n\n` +
  `### ▶ segment 1 — L1..L1 — a → a\n\n[Session:aaaaaaaa 2026-09-04T00:00:00.000Z L1] User:\nEARLIER_SEG1_TURN\n\n` +
  `### ▶ segment 2 — L2..L3 — a → b\n\n[Session:aaaaaaaa 2026-09-05T00:00:00.000Z L2] User:\nEARLIER_SESSION_HUMAN_TURN\n\n[Session:aaaaaaaa 2026-09-05T00:00:01.000Z L3] Assistant:\n${"w".repeat(500)}\n`);
const past = Date.now() / 1000 - 3600;
fs.utimesSync(path.join(older, "restore-ledger.md"), past, past);
fs.writeFileSync(path.join(HOME, ".claude", "super-token-saver-data", PROJECT, "handoff.md"), "HANDOFF_BODY from /s-compact");

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
check("handoff.md included", r.out.includes("HANDOFF_BODY") && r.out.includes("## 3. Handoff written by /s-compact"));
check("unnamed earlier session with a ledger is left out", !r.out.includes("EARLIER_SESSION_HUMAN_TURN") && !r.out.includes("earlier session " + SID2));
check("unnamed sibling transcript is left out and not appended", !r.out.includes("NEVER_COMPACTED_SIBLING_TURN") && !fs.existsSync(path.join(HOME, ".claude", "super-token-saver-data", PROJECT, SID3, "restore-ledger.md")));

// Now this session names SID2 by full id, SID3 by a ledger header's 8-char prefix, SID4 by full id.
const named = [user(`continue the work of session ${SID2} and ${SID4}`), assistant([{ type: "text", text: "picked up [Session:33333333 L1] as well" }])];
write([...seg1, boundary(), summary, ...seg2, boundary(), ...big, boundary(), ...named]);
r = run(["--append"]);
check("named earlier session (full id) included", r.out.includes("EARLIER_SESSION_HUMAN_TURN") && r.out.includes("earlier session " + SID2));
check("named earlier session folded", !r.out.includes("w".repeat(500)));
check("named sibling (8-char prefix) appended lazily and included", r.out.includes("NEVER_COMPACTED_SIBLING_TURN") && fs.existsSync(path.join(HOME, ".claude", "super-token-saver-data", PROJECT, SID3, "restore-ledger.md")));
check("named session still being written after this one began is left out", !r.out.includes("PARALLEL_SESSION_TURN"));
check("earlier sessions rendered oldest first", r.out.indexOf("NEVER_COMPACTED_SIBLING_TURN") < r.out.indexOf("EARLIER_SESSION_HUMAN_TURN"));
check("earlier sessions come after this session's segments", r.out.indexOf("[Session:11111111") < r.out.indexOf("## 4. Earlier sessions"));
const label2 = r.out.indexOf("### earlier session " + SID2);
check("label precedes every segment of its session", label2 >= 0 && label2 < r.out.indexOf("EARLIER_SEG1_TURN") && r.out.indexOf("EARLIER_SEG1_TURN") < r.out.indexOf("EARLIER_SESSION_HUMAN_TURN"));
check("no other session's label sits inside SID2's group", r.out.slice(label2 + 1, r.out.indexOf("EARLIER_SESSION_HUMAN_TURN")).indexOf("### earlier session ") === -1);

// ── 4c. the hook end to end: JSON out, restored text in, no f-string casualty ─

const hook = path.join(REPO, "hooks", "s-continue-after-compact.sh");
const { HOOK_CHAR_CAP } = require(SCRIPT);
function runHook(sid, transcriptPath) {
  const hk = spawnSync("bash", [hook], { input: JSON.stringify({ source: "compact", session_id: sid, transcript_path: transcriptPath }), encoding: "utf8", env: { ...process.env, HOME } });
  let ctx = "";
  try { ctx = JSON.parse(hk.stdout).hookSpecificOutput.additionalContext; } catch {}
  return { status: hk.status, stdout: hk.stdout, ctx };
}
let hk = runHook(SID, transcript);
let ctx = hk.ctx;
const restoreFile = path.join(cacheDir, "restore.md");
check("hook emits SessionStart JSON with additionalContext", hk.status === 0 && ctx.length > 0, hk.stdout.slice(0, 200));
check("hook delivered the restore, not the fallback instruction", ctx.startsWith("# Restored:") && ctx.includes("picked up [Session:33333333"));
check("hook text keeps the literal L{n} placeholder", ctx.includes("L{n}"));
check("hook output under the 9,000-char cap", ctx.length < HOOK_CHAR_CAP, `got ${ctx.length}`);
check("hook names restore.md and it holds the full restore", ctx.includes(restoreFile) && fs.existsSync(restoreFile) && fs.readFileSync(restoreFile, "utf8").includes("bulk turn 0\n"));
const idx = /- lines (\d+)-(\d+): (1\. This session: newest segment)/.exec(ctx);
const restoreLines = fs.existsSync(restoreFile) ? fs.readFileSync(restoreFile, "utf8").split("\n") : [];
check("section index line numbers point at the section titles", !!idx && restoreLines[Number(idx[1]) - 1] === "## " + idx[3] && /- lines \d+-\d+: 4\. Earlier sessions/.test(ctx));

// ── 4c'. a newest segment far over the cap: output still under 9,000, newest turn kept ──

const HUGE_SID = "77777777-7777-7777-7777-777777777777";
const hugeT = path.join(projDir, `${HUGE_SID}.jsonl`);
const huge = [];
for (let i = 0; i < 100; i++) huge.push(user(`huge turn ${i} ` + "h".repeat(3000)), assistant([{ type: "text", text: `huge reply ${i} ` + "r".repeat(3000) }]));
fs.writeFileSync(hugeT, huge.join("\n") + "\n");
hk = runHook(HUGE_SID, hugeT);
const hugeFile = path.join(HOME, ".claude", "super-token-saver-data", PROJECT, HUGE_SID, "restore.md");
check("huge newest segment: hook output under the cap", hk.ctx.startsWith("# Restored:") && hk.ctx.length < HOOK_CHAR_CAP, `got ${hk.ctx.length}`);
// The file is under the 60K-token budget too, so it keeps the newest ~70 turns of this segment.
check("huge newest segment: newest reply in the output, older turns only in the file", hk.ctx.includes("huge reply 99") && !hk.ctx.includes("huge turn 50 ") && fs.readFileSync(hugeFile, "utf8").includes("huge turn 50 "));

const ONE_SID = "88888888-8888-8888-8888-888888888888";
const oneT = path.join(projDir, `${ONE_SID}.jsonl`);
fs.writeFileSync(oneT, [user("one giant reply follows"), assistant([{ type: "text", text: "GIANT_HEAD " + "g".repeat(30000) }])].join("\n") + "\n");
hk = runHook(ONE_SID, oneT);
check("single entry over the cap: cut, marked, output under the cap", hk.ctx.length < HOOK_CHAR_CAP && hk.ctx.includes("GIANT_HEAD") && hk.ctx.includes("…[cut here;"), `got ${hk.ctx.length}`);

// ── 4c''. super-compact handled the compaction: pointer only, marker consumed ──

const markerDir = path.join(HOME, ".claude", "super-token-saver-data", ".super-compact");
const marker = path.join(markerDir, `${SID}.json`);
fs.mkdirSync(markerDir, { recursive: true });
fs.writeFileSync(marker, "{}");
hk = runHook(SID, transcript);
check("handled marker: pointer only, no turns re-injected", hk.ctx.startsWith("# Compaction handled by super-compact") && hk.ctx.includes(restoreFile) && !hk.ctx.includes("picked up [Session:33333333"));
check("handled marker consumed", !fs.existsSync(marker));
fs.writeFileSync(marker, "{}");
const stale = Date.now() / 1000 - 3600;
fs.utimesSync(marker, stale, stale);
hk = runHook(SID, transcript);
check("stale handled marker ignored and removed", hk.ctx.startsWith("# Restored:") && !fs.existsSync(marker));

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
