/**
 * codex-transcript.js — Codex rollout transcripts, normalized into the shape
 * Claude Code writes.
 *
 * Why normalize instead of teaching every parser a second format:
 * `preprocess.js` and `list-sessions.js` already encode years of decisions
 * about markers, context-loss events, meta filtering and truncation. A second
 * parser would fork all of it and drift. Instead this module rewrites one
 * Codex rollout into a CC-shaped JSONL, ONE OUTPUT LINE PER INPUT LINE, so:
 *
 *   - every downstream `L{n}` marker still points at the Codex original's line
 *   - the Claude code path is provably untouched (it never learns Codex exists)
 *
 * Layout:
 *   source ~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<sessionId>.jsonl
 *   norm   ~/.claude/super-token-saver-data/codex/.normalized/{projectHash}/{sessionId}.jsonl
 *   cache  ~/.claude/super-token-saver-data/codex/{projectHash}/{sessionId}/compact.txt
 *
 * Everything Codex-related lives under the codex/ sub-tree; see cache-paths.js.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { CODEX_BASE, projectNameFromCwd } = require("./cache-paths");

// Codex resolves its own state directory through CODEX_HOME, so honour it —
// a non-default Codex home would otherwise be invisible to this tool.
const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const CODEX_ROOTS = [
  path.join(CODEX_HOME, "sessions"),
  path.join(CODEX_HOME, "archived_sessions"),
];
// Inside the Codex sub-tree, dot-prefixed so forHost('codex').listProjects() skips it.
const NORMALIZED_ROOT = path.join(CODEX_BASE, ".normalized");
const INDEX_PATH = path.join(NORMALIZED_ROOT, "index.json");
// v3: turn_context (model) and event_msg/token_count (usage + rate_limits)
// rows are now translated into host-neutral `codex_turn_context` /
// `codex_token_count` rows instead of being dropped as codex_skip, so the
// usage-view port can consume them. Bumping this forces every previously
// normalized file to be rewritten — a v2 file has neither row type.
const NORMALIZED_FORMAT_VERSION = 3;

// A Codex turn opens with injected context the user never typed. Marking these
// `isMeta` is how CC's own reader already signals "not a genuine user turn",
// so list-sessions filters them with its existing rule.
const META_USER_PREFIXES = [
  "# AGENTS.md instructions",
  "<skill>",
  "<user_instructions>",
  "<environment_context>",
  "<INSTRUCTIONS>",
];

// One placeholder per non-message line keeps input and output line numbers equal.
const SKIP_LINE = JSON.stringify({ type: "codex_skip" });

function textFromBlocks(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    if (block.type === "text" || block.type === "input_text" || block.type === "output_text") {
      if (block.text) parts.push(String(block.text));
    }
  }
  return parts.join("\n");
}

function isMetaUserText(text) {
  const head = text.trimStart();
  return META_USER_PREFIXES.some((p) => head.startsWith(p));
}

// -------------------------------------------------------------------------
// Discovery
// -------------------------------------------------------------------------

function walkJsonl(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkJsonl(full, out);
    else if (e.isFile() && e.name.endsWith(".jsonl")) out.push(full);
  }
}

function listCodexFiles() {
  const out = [];
  for (const root of CODEX_ROOTS) walkJsonl(root, out);
  return out;
}

/**
 * Read only the session_meta row (Codex writes it first).
 * Returns { sessionId, cwd, started } or null.
 */
function readSessionMeta(filePath) {
  let fd;
  try { fd = fs.openSync(filePath, "r"); } catch { return null; }
  try {
    // session_meta carries the full system prompt, so it can be large.
    const buf = Buffer.alloc(1 << 20);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    const firstLine = buf.toString("utf8", 0, n).split("\n")[0];
    const row = JSON.parse(firstLine);
    if (row.type !== "session_meta") return null;
    const p = row.payload || {};
    // `session_id` is the THREAD id and a spawned subagent inherits its
    // parent's, so three files can carry the same one. `id` is per-file and is
    // the only safe cache key; keying on session_id makes subagent rollouts
    // overwrite the main session's normalized copy.
    const spawn = (p.source && p.source.subagent && p.source.subagent.thread_spawn) || null;
    return {
      sessionId: p.id || p.session_id || path.basename(filePath, ".jsonl"),
      threadId: p.session_id || p.id || null,
      cwd: p.cwd || null,
      started: p.timestamp || row.timestamp || null,
      isSubagent: p.thread_source === "subagent" || !!spawn,
      agent: spawn
        ? { nickname: spawn.agent_nickname || null, role: spawn.agent_role || null, path: spawn.agent_path || null }
        : null,
    };
  } catch {
    return null;
  } finally {
    try { fs.closeSync(fd); } catch {}
  }
}

function loadIndex() {
  try {
    const data = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
    if (data.version === NORMALIZED_FORMAT_VERSION && data.entries) return data.entries;
  } catch {}
  return {};
}

function saveIndex(entries) {
  try {
    fs.mkdirSync(NORMALIZED_ROOT, { recursive: true });
    fs.writeFileSync(INDEX_PATH, JSON.stringify({ version: NORMALIZED_FORMAT_VERSION, entries }));
  } catch {}
}

/**
 * Codex keeps every session in one global tree, so finding this project's
 * sessions means reading each file's first row. That is ~4k stat+read calls,
 * so the result is cached by (mtime, size) and only changed files are re-read.
 */
function listCodexSessions(cwd, options = {}) {
  const includeSubagents = options.includeSubagents === true;
  const files = listCodexFiles();
  const cached = loadIndex();
  const next = {};
  const results = [];
  let dirty = false;

  for (const file of files) {
    let stat;
    try { stat = fs.statSync(file); } catch { continue; }
    const prev = cached[file];
    let meta;
    if (prev && prev.mtimeMs === stat.mtimeMs && prev.size === stat.size) {
      meta = prev;
    } else {
      const read = readSessionMeta(file);
      if (!read) { dirty = true; continue; }
      meta = { ...read, mtimeMs: stat.mtimeMs, size: stat.size };
      dirty = true;
    }
    next[file] = meta;
    if (cwd && meta.cwd !== cwd) continue;
    // Subagent rollouts are Codex's equivalent of CC's subtask transcripts —
    // the user never typed in them, so they stay out of the session list by
    // the same rule list-sessions already applies to Claude subtasks.
    if (!includeSubagents && meta.isSubagent) continue;
    results.push({ path: file, ...meta, mtime: stat.mtime, size: stat.size });
  }

  if (dirty || Object.keys(cached).length !== Object.keys(next).length) saveIndex(next);
  return results.sort((a, b) => b.mtime - a.mtime);
}

// -------------------------------------------------------------------------
// Normalization
// -------------------------------------------------------------------------

function normalizedPathFor(cwd, sessionId) {
  return path.join(NORMALIZED_ROOT, projectNameFromCwd(cwd || "unknown"), `${sessionId}.jsonl`);
}

/**
 * Translate one Codex row into a CC-shaped row, or null to emit a placeholder.
 * `meta` carries sessionId/cwd so every emitted row looks like CC's own.
 */
function translateRow(row, meta) {
  const ts = row.timestamp || null;

  // Context loss. CC's detector reads `system/compact_boundary`, so Codex's
  // own compaction is reported in exactly that vocabulary — which is how a
  // compacted Codex session earns the same "#0, restore the pre-loss part"
  // treatment a compacted Claude session gets.
  if (row.type === "compacted") {
    return { type: "system", subtype: "compact_boundary", compactMetadata: { trigger: "auto" }, timestamp: ts };
  }
  // The model id never rides on the usage row (see CODEX-PORT-BACKLOG.md) —
  // it is only on `turn_context`. Emitted as its own host-neutral row so the
  // usage-view analyzer can apply it prospectively to the token_count rows
  // that follow, the same way it tracks curModel over a Claude timeline.
  if (row.type === "turn_context") {
    const p = row.payload || {};
    if (!p.model) return null;
    return { type: "codex_turn_context", timestamp: ts, model: p.model };
  }

  if (row.type === "event_msg") {
    const p = row.payload || {};
    if (p.type === "context_compacted") {
      return { type: "system", subtype: "compact_boundary", compactMetadata: { trigger: "auto" }, timestamp: ts };
    }
    if (p.type === "thread_rolled_back") {
      return { type: "system", subtype: "compact_boundary", compactMetadata: { trigger: "manual" }, timestamp: ts };
    }
    // `total_token_usage` is a running total per turn and `last_token_usage`
    // is this turn's own delta — both are carried through untouched. Deciding
    // which one the analyzer trusts (and how it clamps/resets) lives in
    // codex-usage.js, not here: this module only normalizes shape.
    if (p.type === "token_count") {
      return {
        type: "codex_token_count",
        timestamp: ts,
        sessionId: meta.sessionId,
        totalTokenUsage: (p.info && p.info.total_token_usage) || null,
        lastTokenUsage: (p.info && p.info.last_token_usage) || null,
        modelContextWindow: (p.info && p.info.model_context_window) || null,
        rateLimits: p.rate_limits || null,
      };
    }
    return null;
  }

  if (row.type !== "response_item") return null;
  const p = row.payload || {};
  if (p.type !== "message") return null;
  const role = p.role;
  if (role !== "user" && role !== "assistant") return null; // developer = injected

  const text = textFromBlocks(p.content);
  if (!text) return null;

  const out = {
    type: role,
    message: { role, content: [{ type: "text", text }] },
    timestamp: ts,
    sessionId: meta.sessionId,
    cwd: meta.cwd,
  };
  if (role === "user" && isMetaUserText(text)) out.isMeta = true;
  return out;
}

/**
 * Rewrite a Codex rollout as a CC-shaped JSONL, one output line per input line.
 * Returns the normalized path. Reuses an existing file when it is newer than
 * the source.
 */
function normalizedMetaPathFor(dest) {
  return dest + ".meta.json";
}

function normalizeCodexTranscript(srcPath, meta) {
  const resolved = meta || readSessionMeta(srcPath);
  if (!resolved) throw new Error(`Not a Codex transcript: ${srcPath}`);
  const dest = normalizedPathFor(resolved.cwd, resolved.sessionId);
  const metaPath = normalizedMetaPathFor(dest);

  try {
    const srcStat = fs.statSync(srcPath);
    const destStat = fs.statSync(dest);
    // The per-session file carries its own format-version stamp (a sidecar,
    // not a header line — a header would shift every line number by one and
    // break the L{n}-points-at-the-original invariant). Without this check a
    // stale v2 file (no codex_turn_context/codex_token_count rows) would be
    // reused forever just because its mtime is newer than the source.
    const stamp = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    if (stamp.version === NORMALIZED_FORMAT_VERSION && destStat.mtimeMs >= srcStat.mtimeMs) return dest;
  } catch {}

  const raw = fs.readFileSync(srcPath, "utf8");
  const lines = raw.split("\n");
  // A trailing newline yields one empty final element; dropping it keeps the
  // line count equal to the source's real line count.
  if (lines.length && lines[lines.length - 1] === "") lines.pop();

  const out = new Array(lines.length);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { out[i] = SKIP_LINE; continue; }
    let row;
    try { row = JSON.parse(line); } catch { out[i] = SKIP_LINE; continue; }
    const translated = translateRow(row, resolved);
    out[i] = translated ? JSON.stringify(translated) : SKIP_LINE;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, out.join("\n") + "\n");
  fs.writeFileSync(metaPath, JSON.stringify({ version: NORMALIZED_FORMAT_VERSION }));
  return dest;
}

module.exports = {
  CODEX_ROOTS,
  NORMALIZED_ROOT,
  listCodexSessions,
  readSessionMeta,
  normalizeCodexTranscript,
  normalizedPathFor,
};
