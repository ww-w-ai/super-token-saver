#!/usr/bin/env node
/**
 * test-precompact-watch.js — gate for scripts/precompact-watch.js and scripts/precompact-prepare.js,
 * the hook that starts the super-compact summary at the first 95% crossing.
 *
 * Pins: the threshold matches Claude Code's formula (window from env / settings / model, minus
 * min(max output, 20,000), minus 13,000, the pct override); the context size matches
 * tokenCountWithEstimation (usage incl. output, anchored at the first split of the last response,
 * chars/4 for later rows, non-API rows 0, sidechain and synthetic rows skipped); a last line larger
 * than the first tail window still measures the same as a full parse; a PostToolUse result not yet
 * in the transcript is added once; 8 hooks crossing at the same moment start exactly one
 * preparation; a held marker is not re-armed until the context falls under half the threshold; a
 * failed preparation is retried up to 3 attempts; the fork and subagents never arm; the preparer
 * forks with --resume <sid> --fork-session --max-turns 1 and writes ready / failed.
 *
 * Usage: node scripts/test-precompact-watch.js
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const W = require("./precompact-watch.js");
const P = require("./precompact-prepare.js");
const WATCH = path.join(__dirname, "precompact-watch.js");
const PREPARE = path.join(__dirname, "precompact-prepare.js");

let failures = 0;
function check(name, cond, detail) {
  if (!cond) failures++;
  console.log(`${cond ? "OK  " : "FAIL"} ${name}${cond || !detail ? "" : `\n       ${detail}`}`);
}

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "sts-precompact-"));
const HOME = path.join(ROOT, "home");
const CWD = path.join(ROOT, "proj");
fs.mkdirSync(path.join(HOME, ".claude"), { recursive: true });
fs.mkdirSync(CWD, { recursive: true });
fs.writeFileSync(path.join(HOME, ".claude", "settings.json"), JSON.stringify({ autoCompactWindow: 550000 }));

// ── threshold ──
const th = (env, settings, model) => W.autoCompactThreshold({ env, settings, model }).threshold;
check("settings 550,000 → 550,000 − 20,000 − 13,000", th({}, { autoCompactWindow: 550000 }) === 517000);
check("env window beats settings", th({ CLAUDE_CODE_AUTO_COMPACT_WINDOW: "300000" }, { autoCompactWindow: 550000 }) === 267000);
check("pct override takes the lower value", th({ CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: "80" }, { autoCompactWindow: 550000 }) === 424000);
check("pct override never raises past the buffer", th({ CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: "100" }, { autoCompactWindow: 550000 }) === 517000);
check("auto with an unknown model → 200,000 window", th({}, {}) === 167000);
check("auto with a [1m] model → 1,000,000 window", th({}, { model: "opus[1m]" }) === 967000);
check("configured window capped by a known model window", th({}, { autoCompactWindow: 1200000, model: "opus[1m]" }) === 967000);
check("byModel picks the matching key", th({}, { autoCompactWindow: { default: 400000, byModel: { opus: 600000 } } }, "claude-opus-5-5") === 567000);
check("small max output shrinks the reserve", th({ CLAUDE_CODE_MAX_OUTPUT_TOKENS: "8000" }, { autoCompactWindow: 550000 }) === 529000);

// ── context size ──
const usage = (input, read, write, out) => ({ input_tokens: input, cache_read_input_tokens: read, cache_creation_input_tokens: write, output_tokens: out });
const asst = (id, content, u) => ({ type: "assistant", message: { id, model: "claude-opus-5-5", role: "assistant", content, ...(u && { usage: u }) } });
const user = (content) => ({ type: "user", message: { role: "user", content } });
const toolResult = (id, text) => user([{ type: "tool_result", tool_use_id: id, content: text }]);

{
  const rows = [
    user("hello"),
    asst("m1", [{ type: "text", text: "x" }], usage(10, 1000, 100, 50)),
    asst("m2", [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "ls" } }], usage(5, 2000, 0, 7)),
    toolResult("t1", "a".repeat(400)),
    asst("m2", [{ type: "tool_use", id: "t2", name: "Read", input: { file: "f" } }], usage(5, 2000, 0, 30)),
    toolResult("t2", "b".repeat(800)),
    { type: "system", subtype: "informational", content: "z".repeat(4000) },
    { type: "progress", data: "p".repeat(4000) },
  ];
  const got = W.contextTokens(rows, true);
  const toolUse2 = Math.round(("Read" + JSON.stringify({ file: "f" })).length / 4);
  const expected = 5 + 2000 + 0 + 30 + 100 + toolUse2 + 200;
  check("anchors at the first split of the last response; output counted; non-API rows 0", got.tokens === expected, `got ${got.tokens}, expected ${expected}`);
  const withSide = [...rows, { ...asst("s1", [], usage(1, 999999, 0, 0)), isSidechain: true }, asst("syn", [], { ...usage(1, 999999, 0, 0) })];
  withSide[withSide.length - 1].message.model = "<synthetic>";
  const side = W.contextTokens(withSide, true).tokens;
  check("sidechain and synthetic usage rows are not anchors", side === expected + 0, `got ${side}`);
  check("an incomplete window that cannot see the anchor's start asks to widen", W.contextTokens(rows.slice(4), false) === undefined);

  const att = (a) => ({ type: "attachment", attachment: a });
  const base = [asst("m9", [], usage(0, 1000, 0, 0))];
  const after = (a) => W.contextTokens([...base, att(a)], true).tokens - 1000;
  check("PostToolUse hook_success sends nothing", after({ type: "hook_success", hookEvent: "PostToolUse", hookName: "PostToolUse:Bash", content: "x".repeat(4000) }) === 0);
  check("SessionStart hook_success is counted", after({ type: "hook_success", hookEvent: "SessionStart", hookName: "SessionStart:startup", content: "x".repeat(4000) }) > 1000);
  check("empty hook_success sends nothing", after({ type: "hook_success", hookEvent: "UserPromptSubmit", hookName: "UserPromptSubmit", content: "" }) === 0);
  check("already_read_file sends nothing", after({ type: "already_read_file", filename: "f", content: "x".repeat(4000) }) === 0);
}

// ── tail window ──
{
  const file = path.join(ROOT, "big.jsonl");
  const rows = [user("start"), asst("m1", [{ type: "tool_use", id: "t9", name: "Bash", input: {} }], usage(1, 300000, 0, 20)), toolResult("t9", "q".repeat(300 * 1024))];
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const measured = W.measureTranscript(file);
  const full = W.contextTokens(rows, true);
  check("a last line larger than the first tail window measures like a full parse", measured.tokens === full.tokens, `tail ${measured.tokens} vs full ${full.tokens}`);
}

// ── pending tool result ──
{
  const input = { hook_event_name: "PostToolUse", tool_use_id: "t5", tool_response: "r".repeat(400) };
  check("unwritten tool result is added", W.pendingToolTokens(input, []) === 100);
  check("written tool result is not added twice", W.pendingToolTokens(input, [toolResult("t5", "x")]) === 0);
  check("Stop adds nothing", W.pendingToolTokens({ hook_event_name: "Stop" }, []) === 0);
}

// ── decide ──
const SID = "11111111-2222-3333-4444-555555555555";
const TRANSCRIPT = path.join(ROOT, "t.jsonl");
const THRESHOLD = 517000;
function writeTranscript(contextTokens) {
  fs.writeFileSync(TRANSCRIPT, [user("go"), asst("mx", [{ type: "text", text: "" }], usage(0, contextTokens, 0, 0))].map((r) => JSON.stringify(r)).join("\n") + "\n");
}
const marker = W.markerPath(HOME, SID);
fs.mkdirSync(path.dirname(marker), { recursive: true });
const stopInput = { hook_event_name: "Stop", session_id: SID, transcript_path: TRANSCRIPT, cwd: CWD };
let launches = 0;
const decide = (extra = {}, env = {}) => W.decide({ input: { ...stopInput, ...extra }, env, home: HOME, now: Date.now(), launch: () => launches++ });

writeTranscript(Math.floor(0.95 * THRESHOLD) - 1);
check("one token under 95% stays below", decide() === "below" && !fs.existsSync(marker) && launches === 0);
writeTranscript(Math.ceil(0.95 * THRESHOLD));
check("reaching 95% arms and launches once", decide() === "armed" && launches === 1 && JSON.parse(fs.readFileSync(marker, "utf8")).status === "running");
check("a later call is held", decide() === "held" && launches === 1);
check("the fork never arms", decide({}, { SUPER_COMPACT_FORK: "1" }) === "skip:fork");
check("a subagent hook never arms", decide({ agent_id: "a1" }) === "skip:subagent");

fs.writeFileSync(marker, JSON.stringify({ status: "ready", attempts: 1, armedAt: Date.now() }));
writeTranscript(Math.floor(0.7 * THRESHOLD));
check("between half and 95% a ready marker is kept", decide() === "below" && fs.existsSync(marker));
writeTranscript(Math.floor(0.3 * THRESHOLD));
check("under half the threshold (compacted) the marker clears", decide() === "rearmed" && !fs.existsSync(marker));
writeTranscript(Math.ceil(0.96 * THRESHOLD));
check("the next crossing arms again", decide() === "armed" && launches === 2);

fs.writeFileSync(marker, JSON.stringify({ status: "failed", attempts: 1, armedAt: Date.now() }));
check("a failed preparation is retried", decide() === "retried" && launches === 3 && JSON.parse(fs.readFileSync(marker, "utf8")).attempts === 2);
fs.writeFileSync(marker, JSON.stringify({ status: "failed", attempts: 3, armedAt: Date.now() }));
check("no retry after 3 attempts", decide() === "held" && launches === 3);
fs.writeFileSync(marker, JSON.stringify({ status: "running", attempts: 1, armedAt: Date.now() - 16 * 60_000 }));
check("a running marker older than 15 minutes is retried", decide() === "retried" && launches === 4);
fs.writeFileSync(marker, JSON.stringify({ status: "running", attempts: 1, armedAt: Date.now() }));
writeTranscript(Math.floor(0.3 * THRESHOLD));
check("a running marker is never cleared", decide() === "below" && fs.existsSync(marker));

// ── 8 hooks at once, real processes ──
async function concurrent() {
  fs.rmSync(marker, { force: true });
  writeTranscript(Math.ceil(0.97 * THRESHOLD));
  const log = path.join(ROOT, "launches.log");
  const stub = path.join(ROOT, "stub-preparer.js");
  fs.writeFileSync(stub, `require("fs").appendFileSync(${JSON.stringify(log)}, process.argv[2] + " " + process.env.SUPER_COMPACT_FORK + "\\n")`);
  const runs = Array.from({ length: 8 }, (_, i) => new Promise((resolve) => {
    const child = spawn(process.execPath, [WATCH], { env: { ...process.env, HOME, SUPER_COMPACT_PREPARER: stub, SUPER_COMPACT_FORK: "" } });
    child.on("exit", resolve);
    child.stdin.end(JSON.stringify({ ...stopInput, hook_event_name: "PostToolUse", tool_use_id: `c${i}`, tool_response: "ok" }));
  }));
  await Promise.all(runs);
  const deadline = Date.now() + 3000;
  while (!fs.existsSync(log) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  await new Promise((r) => setTimeout(r, 300));
  const lines = fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n") : [];
  check("8 simultaneous hooks start exactly one preparation", lines.length === 1, `got ${lines.length}`);
  check("the preparation runs with SUPER_COMPACT_FORK=1", lines[0] === `${SID} 1`, lines[0]);
}

// ── preparer ──
function preparer() {
  check("reply split at LAST SEEN", JSON.stringify(P.splitReply("## A\nx\n## B\ny\nLAST SEEN: hello there")) === JSON.stringify({ summary: "## A\nx\n## B\ny", lastSeen: "hello there" }));
  check("reply without LAST SEEN is rejected", P.splitReply("## A\nx") === undefined);

  const argsLog = path.join(ROOT, "claude-args.json");
  const fake = path.join(ROOT, "fake-claude.js");
  fs.writeFileSync(fake, `#!/usr/bin/env node
require("fs").writeFileSync(${JSON.stringify(argsLog)}, JSON.stringify(process.argv.slice(2)));
const fail = process.env.FAKE_FAIL === "1";
process.stdout.write(JSON.stringify(fail ? { is_error: true, result: "boom" } : { is_error: false, result: "## A\\nold\\n## B\\nnew\\nLAST SEEN: the last line", session_id: "fork-1", total_cost_usd: 0.1, usage: { cache_read_input_tokens: 360000, cache_creation_input_tokens: 3600 } }));`);
  fs.chmodSync(fake, 0o755);
  writeTranscript(500000);
  fs.writeFileSync(marker, JSON.stringify({ status: "running", attempts: 1, armedAt: 1 }));
  spawnSync(process.execPath, [PREPARE, SID, TRANSCRIPT, CWD, marker], { env: { ...process.env, SUPER_COMPACT_CLAUDE: fake } });
  const ready = JSON.parse(fs.readFileSync(marker, "utf8"));
  const args = JSON.parse(fs.readFileSync(argsLog, "utf8"));
  check("fork args: --resume <sid> --fork-session, json, one turn",
    args[0] === "-p" && args.includes("--fork-session") && args[args.indexOf("--resume") + 1] === SID && args[args.indexOf("--max-turns") + 1] === "1" && args[args.indexOf("--output-format") + 1] === "json");
  check("ready marker carries summary, lastSeen, coveredLine and keeps attempts",
    ready.status === "ready" && ready.summary === "## A\nold\n## B\nnew" && ready.lastSeen === "the last line" && ready.coveredLine === 2 && ready.attempts === 1 && ready.cacheReadTokens === 360000,
    JSON.stringify(ready));
  spawnSync(process.execPath, [PREPARE, SID, TRANSCRIPT, CWD, marker], { env: { ...process.env, SUPER_COMPACT_CLAUDE: fake, FAKE_FAIL: "1" } });
  const failed = JSON.parse(fs.readFileSync(marker, "utf8"));
  check("a failed fork writes failed with its reason", failed.status === "failed" && failed.reason === "boom", JSON.stringify(failed));
}

concurrent().then(() => {
  preparer();
  fs.rmSync(ROOT, { recursive: true, force: true });
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exit(failures ? 1 : 0);
});
