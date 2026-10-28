#!/usr/bin/env node
/**
 * precompact-watch.js — PostToolUse / Stop hook. Measures the context the way Claude Code's
 * auto-compact check does and, the first time it reaches ARM_FRACTION of the auto-compact
 * threshold, starts precompact-prepare.js in the background exactly once.
 *
 * Runs after every tool call, so it reads only the transcript's tail: the window doubles until it
 * holds a whole line carrying `message.usage` (one transcript line can exceed any fixed window).
 *
 * Context size = the engine's tokenCountWithEstimation (2.1.88 utils/tokens.ts):
 *   usage(input + cache_creation + cache_read + output) of the last API response, anchored at the
 *   first record split from that response (same message.id), plus a chars/4 estimate of every
 *   message after the anchor (services/tokenEstimation.ts rules). At PostToolUse the tool result is
 *   not in the transcript yet, so its tool_response is estimated and added.
 * Threshold = the engine's autoCompactThreshold (2.1.310 Tb/B7/MQ):
 *   window = CLAUDE_CODE_AUTO_COMPACT_WINDOW, else settings autoCompactWindow, else the model window,
 *   capped by the model window; minus min(max output, 20,000); minus 13,000
 *   (CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: min(floor(effective * pct / 100), effective - 13,000)).
 *
 * Exactly once per compaction: the marker <data>/.super-compact/<sid>.prepared.json is created with
 * O_EXCL, so of several hooks firing at once (parallel tool calls) one wins. A failed preparation is
 * retried up to MAX_ATTEMPTS, the takeover claimed by an atomic rename. The marker is cleared when
 * the context falls under REARM_FRACTION (a compaction happened), which re-arms the next crossing.
 *
 * Skips: subagent hooks (agent_id), the preparation fork itself (SUPER_COMPACT_FORK), and sessions
 * where auto-compact is off. Prints nothing; never fails the tool call (always exits 0).
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const ARM_FRACTION = 0.95;
const REARM_FRACTION = 0.5;
const MAX_ATTEMPTS = 3;
const RUNNING_STALE_MS = 15 * 60_000;
const TAIL_START_BYTES = 64 * 1024;
const MAX_OUTPUT_CAP = 20_000;
const AUTOCOMPACT_BUFFER = 13_000;
const DEFAULT_WINDOW = 200_000;
const ONE_M_WINDOW = 1_000_000;
const IMAGE_TOKENS = 2_000;

const dataDir = (home) => path.join(home, ".claude", "super-token-saver-data", ".super-compact");
const markerPath = (home, sid) => path.join(dataDir(home), `${sid}.prepared.json`);

// ───────────────────────────── context size ─────────────────────────────

const rough = (text) => Math.round(String(text ?? "").length / 4);

function blockTokens(block) {
  if (typeof block === "string") return rough(block);
  if (!block || typeof block !== "object") return 0;
  switch (block.type) {
    case "text": return rough(block.text);
    case "image": case "document": return IMAGE_TOKENS;
    case "tool_result": return contentTokens(block.content);
    case "tool_use": return rough((block.name ?? "") + JSON.stringify(block.input ?? {}));
    case "thinking": return rough(block.thinking);
    case "redacted_thinking": return rough(block.data);
    default: return rough(JSON.stringify(block));
  }
}

function contentTokens(content) {
  if (!content) return 0;
  if (typeof content === "string") return rough(content);
  if (!Array.isArray(content)) return 0;
  return content.reduce((sum, b) => sum + blockTokens(b), 0);
}

/** Attachment types normalizeAttachmentForAPI sends nothing for (2.1.88 utils/messages.ts). */
const NO_API_ATTACHMENTS = new Set([
  "already_read_file", "command_permissions", "edited_image_file", "hook_cancelled", "hook_error_during_execution",
  "hook_non_blocking_error", "hook_system_message", "structured_output", "hook_permission_decision",
  "autocheckpointing", "background_task_status", "todo", "task_progress", "ultramemory",
]);
const CONTEXT_HOOK_EVENTS = new Set(["SessionStart", "UserPromptSubmit"]);

function attachmentTokens(a) {
  if (NO_API_ATTACHMENTS.has(a.type)) return 0;
  if (a.type === "hook_success") {
    if (!CONTEXT_HOOK_EVENTS.has(a.hookEvent) || !a.content) return 0;
    return rough(`<system-reminder>\n${a.hookName} hook success: ${a.content}\n</system-reminder>`);
  }
  return rough(JSON.stringify(a));
}

/** One transcript row's share of the API request, by the engine's rough rules; 0 for non-API rows. */
function rowTokens(row) {
  if ((row.type === "user" || row.type === "assistant") && row.message?.content) return contentTokens(row.message.content);
  if (row.type === "attachment" && row.attachment) return attachmentTokens(row.attachment);
  return 0;
}

const usageOf = (row) =>
  row.type === "assistant" && !row.isSidechain && row.message?.usage && row.message.model !== "<synthetic>"
    ? row.message.usage
    : undefined;

const usageTokens = (u) =>
  (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.output_tokens ?? 0);

/**
 * tokenCountWithEstimation over parsed rows (oldest first). `complete` says the rows reach the start
 * of the transcript; when they do not and the anchor walk runs off their start, the answer is
 * undefined so the caller widens the window.
 */
function contextTokens(rows, complete) {
  for (let i = rows.length - 1; i >= 0; i--) {
    const usage = usageOf(rows[i]);
    if (!usage) continue;
    const id = rows[i].message.id;
    let anchor = i;
    let j = i - 1;
    for (; j >= 0; j--) {
      const priorId = rows[j].type === "assistant" ? rows[j].message?.id : undefined;
      if (priorId === undefined) continue;
      if (priorId === id) anchor = j;
      else break;
    }
    if (j < 0 && !complete && id) return undefined;
    let after = 0;
    for (let k = anchor + 1; k < rows.length; k++) after += rowTokens(rows[k]);
    return { tokens: usageTokens(usage) + after, model: rows[i].message.model, rows: rows.slice(anchor + 1) };
  }
  return complete ? { tokens: rows.reduce((s, r) => s + rowTokens(r), 0), model: undefined, rows } : undefined;
}

/** Whole rows of the last `bytes` of the file; the first line is dropped unless the read starts at 0. */
function tailRows(fd, size, bytes) {
  const start = Math.max(0, size - bytes);
  const buf = Buffer.alloc(size - start);
  fs.readSync(fd, buf, 0, buf.length, start);
  const lines = buf.toString("utf8").split("\n");
  if (start > 0) lines.shift();
  const rows = [];
  for (const line of lines) {
    if (!line) continue;
    try { rows.push(JSON.parse(line)); } catch { /* a line still being written */ }
  }
  return { rows, complete: start === 0 };
}

/** Context size from the transcript tail, doubling the window until the anchor is whole. */
function measureTranscript(transcript) {
  const fd = fs.openSync(transcript, "r");
  try {
    const size = fs.fstatSync(fd).size;
    for (let bytes = TAIL_START_BYTES; ; bytes *= 2) {
      const { rows, complete } = tailRows(fd, size, bytes);
      const measured = contextTokens(rows, complete);
      if (measured) return measured;
      if (complete) return { tokens: 0, model: undefined, rows: [] };
    }
  } finally {
    fs.closeSync(fd);
  }
}

/** The PostToolUse result is not in the transcript yet; estimate it unless a row already carries it. */
function pendingToolTokens(input, rowsAfterAnchor) {
  if (input.hook_event_name !== "PostToolUse" || input.tool_response === undefined) return 0;
  const id = input.tool_use_id;
  const written = id && rowsAfterAnchor.some((r) =>
    Array.isArray(r.message?.content) && r.message.content.some((b) => b?.type === "tool_result" && b.tool_use_id === id));
  if (written) return 0;
  const resp = input.tool_response;
  return typeof resp === "string" ? rough(resp) : rough(JSON.stringify(resp));
}

// ───────────────────────────── threshold ─────────────────────────────

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return undefined; }
}

/** Merged settings, lowest precedence first: user, project, project local. */
function loadSettings(home, cwd) {
  const files = [path.join(home, ".claude", "settings.json")];
  if (cwd) files.push(path.join(cwd, ".claude", "settings.json"), path.join(cwd, ".claude", "settings.local.json"));
  return files.reduce((acc, f) => ({ ...acc, ...(readJson(f) ?? {}) }), {});
}

const positiveInt = (v) => {
  const n = typeof v === "number" ? v : parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

function configuredWindow(setting, model) {
  if (setting === undefined || setting === "auto") return undefined;
  if (typeof setting !== "object") return positiveInt(setting);
  const byModel = setting.byModel ?? {};
  const key = Object.keys(byModel).find((k) => model && model.includes(k));
  const v = key !== undefined ? byModel[key] : setting.default;
  return v === "auto" ? undefined : positiveInt(v);
}

/** The model's own window when the transcript or settings name it; undefined when unknown. */
function modelWindow(model, settings) {
  if (/\[1m\]/i.test(`${model ?? ""} ${settings.model ?? ""}`)) return ONE_M_WINDOW;
  return undefined;
}

/** autoCompactThreshold as Claude Code computes it, and where the window came from. */
function autoCompactThreshold({ env, settings, model }) {
  const ctx = modelWindow(model, settings);
  const envWindow = positiveInt(env.CLAUDE_CODE_AUTO_COMPACT_WINDOW);
  const configured = envWindow ?? configuredWindow(settings.autoCompactWindow, model);
  const source = envWindow !== undefined ? "env" : configured !== undefined ? "settings" : ctx !== undefined ? "model" : "default";
  const window = configured !== undefined ? Math.min(ctx ?? configured, configured) : ctx ?? DEFAULT_WINDOW;
  const maxOut = Math.min(positiveInt(env.CLAUDE_CODE_MAX_OUTPUT_TOKENS) ?? MAX_OUTPUT_CAP, MAX_OUTPUT_CAP);
  const effective = window - maxOut;
  const plain = effective - AUTOCOMPACT_BUFFER;
  const pct = parseFloat(env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE);
  const threshold = pct > 0 && pct <= 100 ? Math.min(Math.floor(effective * (pct / 100)), plain) : plain;
  return { threshold, window, source };
}

const autoCompactOff = (env, home) =>
  !!(env.DISABLE_AUTO_COMPACT || env.DISABLE_COMPACT) || readJson(path.join(home, ".claude.json"))?.autoCompactEnabled === false;

// ───────────────────────────── arming ─────────────────────────────

/** Creates the marker only if absent; true when this process won. */
function createMarker(file, body) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(body, null, 2), { flag: "wx" });
    return true;
  } catch {
    return false;
  }
}

/** Claims a failed or stale marker for a retry; the atomic rename lets one contender through. */
function claimRetry(file) {
  const claimed = `${file}.claim-${process.pid}-${Date.now()}`;
  try { fs.renameSync(file, claimed); } catch { return undefined; }
  const previous = readJson(claimed);
  fs.rmSync(claimed, { force: true });
  return previous;
}

const isRetryable = (m, now) =>
  m && (m.status === "failed" || (m.status === "running" && now - (m.armedAt ?? 0) > RUNNING_STALE_MS)) &&
  (m.attempts ?? 1) < MAX_ATTEMPTS;

/**
 * The decision for one hook call. Returns what happened: "below", "rearmed", "armed", "retried",
 * "held" (a marker already covers this compaction) or a skip reason.
 */
function decide({ input, env, home, now, launch }) {
  if (env.SUPER_COMPACT_FORK) return "skip:fork";
  if (input.agent_id) return "skip:subagent";
  const sid = input.session_id;
  const transcript = input.transcript_path;
  if (!sid || !transcript || !fs.existsSync(transcript)) return "skip:no-transcript";
  if (autoCompactOff(env, home)) return "skip:auto-compact-off";

  const measured = measureTranscript(transcript);
  const tokens = measured.tokens + pendingToolTokens(input, measured.rows);
  const { threshold, source } = autoCompactThreshold({ env, settings: loadSettings(home, input.cwd), model: measured.model });
  const file = markerPath(home, sid);

  if (tokens < ARM_FRACTION * threshold) {
    const m = fs.existsSync(file) ? readJson(file) : undefined;
    if (m && m.status !== "running" && tokens < REARM_FRACTION * threshold) {
      fs.rmSync(file, { force: true });
      return "rearmed";
    }
    return "below";
  }

  const body = (attempts) => ({ status: "running", attempts, armedAt: now, tokens, threshold, thresholdSource: source, event: input.hook_event_name });
  if (createMarker(file, body(1))) {
    launch({ sid, transcript, cwd: input.cwd, marker: file });
    return "armed";
  }
  const current = readJson(file);
  if (!isRetryable(current, now)) return "held";
  const previous = claimRetry(file);
  if (!isRetryable(previous, now) || !createMarker(file, body((previous.attempts ?? 1) + 1))) return "held";
  launch({ sid, transcript, cwd: input.cwd, marker: file });
  return "retried";
}

/** Starts the preparation detached; SUPER_COMPACT_FORK keeps the fork's own hooks from arming again. */
function launchPreparer({ sid, transcript, cwd, marker }) {
  const script = process.env.SUPER_COMPACT_PREPARER || path.join(__dirname, "precompact-prepare.js");
  const child = spawn(process.execPath, [script, sid, transcript, cwd || process.cwd(), marker], {
    detached: true,
    stdio: "ignore",
    cwd: cwd || process.cwd(),
    env: { ...process.env, SUPER_COMPACT_FORK: "1" },
  });
  child.unref();
}

function main() {
  let raw = "";
  try { raw = fs.readFileSync(0, "utf8"); } catch { return; }
  let input;
  try { input = JSON.parse(raw); } catch { return; }
  try {
    const result = decide({ input, env: process.env, home: os.homedir(), now: Date.now(), launch: launchPreparer });
    if (process.env.SUPER_COMPACT_WATCH_DEBUG) process.stderr.write(`${result}\n`);
  } catch { /* never fail the tool call */ }
}

if (require.main === module) main();

module.exports = { contextTokens, measureTranscript, pendingToolTokens, autoCompactThreshold, decide, markerPath, ARM_FRACTION, REARM_FRACTION, MAX_ATTEMPTS };
