#!/usr/bin/env node
/**
 * Transcript preprocessor — v6 compact format.
 * Reads a CC JSONL transcript and emits a compact text transcript used by the
 * /continue skill for cheap session-restore (no LLM summarization).
 *
 * Usage: node preprocess.js <transcript.jsonl>
 *
 * Self-managing cache: derives cache path from JSONL path, checks format
 * version + mtime, skips if fresh, writes to cache file if stale.
 * Callers just run this and then Read the cached compact.txt directly.
 *
 * Input:
 *   ~/.claude/projects/{PROJECT_HASH}/{SESSION_ID}.jsonl   (CC transcript file)
 *
 * Output (cache file, not stdout):
 *   ~/.claude/super-token-saver-data/{projectHash}/{sessionId}/compact.txt
 *   Compact text transcript with [Session:{sid} {ISO} L{n}] headers and markers.
 *   Top:    "# compact-format: {version}"
 *   Bottom: session reference footer pointing to the original JSONL.
 *
 * ──────────────────────────────────────────────────────────────────────
 * Output structure — turn-oriented, user-centric
 * ──────────────────────────────────────────────────────────────────────
 *   [Session:{sid8} {ISO UTC} L{lineNum}]{markers?} User: "{content}"
 *   -> {N} AI response(s) at line{s} {range}:
 *      1. "{preview}" [+{n} code, {m} table, {k} list]?
 *      2. "{preview}" [...]?
 *
 * Slash commands and system events also appear as visible turns (v6+):
 *   [Session:... L3] User: "/clear"
 *   -> 0 AI responses
 *
 *   [Session:... L1734] System: "[auto-compact boundary]"
 *   -> 0 AI responses
 *
 * ──────────────────────────────────────────────────────────────────────
 * Marker Reference — user-side only (v1.4.0+ compact-timeline-separation)
 * ──────────────────────────────────────────────────────────────────────
 * Generated here (preprocess.js), parsed downstream in build-report.js.
 * Only USER-SIDE markers live in compact.txt. Cost/ctx/heuristic/rate-limit
 * markers are owned by analyze-usage.js → timeline.csv.
 *
 * Markers sit immediately after the closing `]` of a header and attach to
 * the NEXT genuine user turn (not to the slash-command visible turn itself).
 * This preserves build-report's rule-based index location.
 *
 * User-side markers emitted here:
 *   @   New session start (first non-meta user message)
 *   @@  /clear restart
 *   +   Manual /compact (user-invoked via <command-name>/compact</command-name>
 *       OR system:compact_boundary trigger=manual)
 *   ++  Auto-compact (system:compact_boundary trigger=auto; fired by context
 *       pressure) — also triggered by isCompactSummary=true on injected user msg
 *   ~   /reload-plugins (system prompt change)
 *   !   /model change (cache invalidation)
 *   ^   /continue skill (single session restore)
 *   ^^  /continue skill (multi-session restore)
 *
 * Stacking rules (see addMarker):
 *   - @@ prepends (anchored at start)
 *   - ++ upgrades a trailing + to ++ in-place
 *   - + appends once; ++ appends once
 *   - @, ^, ^^, ~, ! append once (deduped)
 *   - Combos like "@@+", "@@++", "@@^", "+!" are possible on a single turn
 *     when multiple events happened before the next real user message.
 *
 * Not emitted here (moved to analyze-usage.js → timeline.csv markers column):
 *   * **               cost bands
 *   # ##               context bands
 *   ?                  --continue/--resume heuristic
 *   %5/%%/%W/%O/%S/%X  rate-limit markers
 *
 * Why split: the previous accumulate-on-same-user-line logic produced literal
 * `****` artefacts on tool-heavy turns where multiple assistant API calls
 * share one user prompt. Now build-report.js joins compact.txt (user events)
 * with timeline.csv (per-call cost data) by JSONL line number and aggregates
 * per user turn.
 *
 * Note: /resume is NOT detected directly — CC's resume command uses
 *   display:'skip' and writes no transcript entry. The `?` heuristic (now in
 *   analyze-usage.js) catches most --continue/--resume invocations retroactively.
 *
 * ──────────────────────────────────────────────────────────────────────
 * Format version history
 * ──────────────────────────────────────────────────────────────────────
 *   v1: legacy — cost/ctx/?/% markers mixed on user lines (pre-v1.4.0)
 *   v2: user-side markers only (@ @@ + ++ ~ ! ^ ^^)
 *   v3: signal-weighted truncation (smartTruncate, code block index, last-10 boost)
 *   v5: radical simplification — pair-based turns, fixed truncation rules
 *   v6: slash commands and compact_boundary emitted as visible turns; readable
 *       path alongside marker fast-path (dual-encoding, unchanged marker semantics)
 *   v7: skip "[Request interrupted by user...]" ESC markers (not typed turns) so
 *       they no longer leak into the compact transcript or "Last N messages"
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const os = require("os");

const COMPACT_FORMAT_VERSION = 7;

// Truncation constants
const USER_MAX = 500;
const USER_HEAD = 300;
const USER_TAIL = 200;
const AI_MAX = 200;
const AI_HEAD = 100;
const AI_TAIL = 100;
const MAX_IMAGES_PER_MSG = 3; // cap images per user message
const WORD_SNAP_WINDOW = 5;

// Boilerplate stripping (kept from v3, includes insight blocks per v1.4.1 feedback)
const STRIP_PATTERNS = [
  // bkit feature usage blocks
  /─{3,}[\s\S]*?bkit Feature Usage[\s\S]*?─{3,}/g,
  /✅ Used:.*$/gm,
  /⏭️? Not Used:.*$/gm,
  /💡 Recommended:.*$/gm,
  // insight blocks (★ Insight ─────…───────)
  /★\s*Insight\s*─+[\s\S]*?─{3,}/g,
  // local-command-caveat blocks
  /<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g,
  // command-name/message/args/stdout tags
  /<command-name>[\s\S]*?<\/command-name>/g,
  /<command-message>[\s\S]*?<\/command-message>/g,
  /<command-args>[\s\S]*?<\/command-args>/g,
  /<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g,
  // system-reminder blocks
  /<system-reminder>[\s\S]*?<\/system-reminder>/g,
  // task-notification blocks
  /<task-notification>[\s\S]*?<\/task-notification>/g,
];

const SKIP_USER_PATTERNS = [
  /^\s*$/,
  /^<local-command/,
  /^Base directory for this skill:/,
  // ESC-interrupt markers CC injects as user messages (not typed by the user).
  // Skipping keeps them out of the compact transcript and the "Last N messages".
  /^\[Request interrupted by user/,
];

function cleanText(text) {
  let cleaned = text || "";
  for (const pat of STRIP_PATTERNS) {
    cleaned = cleaned.replace(pat, "");
  }
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  return cleaned.trim();
}

function shouldSkipUser(text) {
  return SKIP_USER_PATTERNS.some((pat) => pat.test(text.trim()));
}

// Extract text-only content from a message content array (skip tool_use)
function extractAssistantText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b && b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n");
}

// Extract user text, prefixing [Image] markers for any image blocks.
function extractUserTextWithImages(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  let imageCount = 0;
  const texts = [];
  for (const b of content) {
    if (!b) continue;
    if (b.type === "image") {
      imageCount += 1;
    } else if (b.type === "text" && b.text) {
      texts.push(b.text);
    }
  }
  const body = texts.join("\n").trim();
  // Cap image markers at MAX_IMAGES_PER_MSG; if more, show "[Image×N]" summary
  let prefix = "";
  if (imageCount > 0) {
    if (imageCount <= MAX_IMAGES_PER_MSG) {
      prefix = Array(imageCount).fill("[Image]").join(" ");
    } else {
      prefix = "[Image×" + imageCount + "]";
    }
  }
  if (prefix && body) return prefix + " " + body;
  if (prefix) return prefix;
  return body;
}

// Word-boundary snap: given a cut index in `s`, find a space within ±WINDOW.
function snapToWordBoundary(s, idx, direction) {
  if (idx <= 0 || idx >= s.length) return idx;
  const lo = Math.max(0, idx - WORD_SNAP_WINDOW);
  const hi = Math.min(s.length, idx + WORD_SNAP_WINDOW);
  if (direction === "end") {
    // Prefer space at or before idx, within window
    for (let i = idx; i >= lo; i--) {
      if (/\s/.test(s[i])) return i;
    }
    for (let i = idx + 1; i <= hi; i++) {
      if (/\s/.test(s[i])) return i;
    }
  } else {
    // Prefer space at or after idx, within window
    for (let i = idx; i <= hi; i++) {
      if (/\s/.test(s[i])) return i;
    }
    for (let i = idx - 1; i >= lo; i--) {
      if (/\s/.test(s[i])) return i;
    }
  }
  return idx;
}

// Abstract bulk structural content in user messages into placeholders.
// This preserves user intent (prose) while collapsing tables/lists/code.
// Image blocks are handled separately in extractUserTextWithImages.
function abstractUserContent(text) {
  let result = text;

  // 1. Fenced code blocks → [Code] (must be first — may contain table/list-like lines)
  result = result.replace(/```[\s\S]*?```/g, "[Code]");

  // 2. Markdown tables → [Table]
  // Detect: header row `|...|` + separator `|---|---|` + optional data rows
  result = result.replace(
    /(?:^\|[^\n]+\|\n\|\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|\n(?:\|[^\n]+\|\n?)*)/gm,
    "[Table]"
  );

  // 3. Bullet/numbered lists (3+ consecutive items) → [List]
  result = result.replace(
    /(?:^[\s]{0,4}(?:[-*+]|\d+[.)])\s+[^\n]{1,500}(?:\n|$)){3,}/gm,
    "[List]"
  );

  return result;
}

// Truncate user message per v5 rules
function truncateUser(text) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= USER_MAX) return flat;
  const originalLineCount = text.split("\n").length;
  const headEnd = snapToWordBoundary(flat, USER_HEAD, "end");
  const tailStart = snapToWordBoundary(flat, flat.length - USER_TAIL, "start");
  const head = flat.slice(0, headEnd).trim();
  const tail = flat.slice(tailStart).trim();
  // Approximate omitted line count
  const omittedLines = Math.max(1, originalLineCount - 2);
  return head + ` ..[${omittedLines}lines omitted].. ` + tail;
}

// Truncate assistant preview per v5 rules (simple HEAD + TAIL)
function truncateAssistant(text) {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= AI_MAX) return oneLine;

  const headEnd = snapToWordBoundary(oneLine, AI_HEAD, "end");
  const tailStart = snapToWordBoundary(oneLine, oneLine.length - AI_TAIL, "start");
  const head = oneLine.slice(0, headEnd).trim();
  const tail = oneLine.slice(tailStart).trim();

  return head + " [...truncated...] " + tail;
}

// Count structural elements in original assistant text
function countStructural(text) {
  // Fenced code blocks: count pairs of ```
  const fenceMatches = text.match(/```/g);
  const codeCount = fenceMatches ? Math.floor(fenceMatches.length / 2) : 0;

  // Markdown tables: count separator lines like |---|---|
  const tableMatches = text.match(/^\s*\|?[\s:-]*\|[\s:|-]*\|?\s*$/gm) || [];
  // Must contain at least one `---`
  const tableCount = tableMatches.filter((l) => /---/.test(l)).length;

  // Consecutive list blocks (3+ lines): count blocks
  const listLineRe = /^\s*(?:[-*+]|\d+\.)\s+/;
  const linesArr = text.split("\n");
  let listBlocks = 0;
  let run = 0;
  for (const ln of linesArr) {
    if (listLineRe.test(ln)) {
      run++;
    } else {
      if (run >= 3) listBlocks++;
      run = 0;
    }
  }
  if (run >= 3) listBlocks++;

  return { code: codeCount, table: tableCount, list: listBlocks };
}

function formatStructural(counts) {
  const parts = [];
  if (counts.code > 0) parts.push(`+${counts.code} code`);
  if (counts.table > 0) parts.push(`${counts.table} table`);
  if (counts.list > 0) parts.push(`${counts.list} list`);
  if (parts.length === 0) return "";
  // First part already has `+` prefix, others don't
  return " [" + parts.join(", ") + "]";
}

function toISOUtc(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    // Full ISO 8601 with Z, second precision
    return d.toISOString().replace(/\.\d{3}Z$/, "Z");
  } catch {
    return "";
  }
}

// Derive cache path from JSONL path.
// Claude: ~/.claude/projects/{projectHash}/{sessionId}.jsonl
//      →  ~/.claude/super-token-saver-data/{projectHash}/{sessionId}/compact.txt
// Codex:  a normalized rollout under the codex/ sub-tree
//      →  ~/.claude/super-token-saver-data/codex/{projectHash}/{sessionId}/compact.txt
function deriveCachePath(jsonlAbsPath) {
  const { CODEX_BASE, forHost } = require("./lib/cache-paths");
  const sessionId = path.basename(jsonlAbsPath, ".jsonl");
  const projectHash = path.basename(path.dirname(jsonlAbsPath));
  const host = path.resolve(jsonlAbsPath).startsWith(CODEX_BASE + path.sep) ? "codex" : "claude";
  const cacheDir = forHost(host).getSessionDir(projectHash, sessionId);
  return { cacheDir, cachePath: path.join(cacheDir, "compact.txt"), sessionId, projectHash };
}

// Read the format version from the `# compact-format: N` header line.
function readFormatVersion(filePath) {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(128);
    const n = fs.readSync(fd, buf, 0, 128, 0);
    fs.closeSync(fd);
    const m = buf.toString("utf8").match(/^# compact-format:\s*(\d+)/m);
    return m ? Number(m[1]) : 1;
  } catch { return 0; }
}

// Check if cached compact.txt is fresh (format version + mtime).
function isCacheFresh(cachePath, jsonlPath) {
  if (!fs.existsSync(cachePath)) return false;
  try {
    const ver = readFormatVersion(cachePath);
    if (ver < COMPACT_FORMAT_VERSION) return false;
    const cacheMtime = fs.statSync(cachePath).mtime;
    const jsonlMtime = fs.statSync(jsonlPath).mtime;
    return cacheMtime >= jsonlMtime;
  } catch { return false; }
}

async function main() {
  const argv = process.argv.slice(2);
  const filePath = argv.find((a) => !a.startsWith("--"));
  // A Codex transcript is read through a normalized copy, so the copy is what
  // this script parses — but the line numbers are the ORIGINAL rollout's, and
  // that is the file a reader should open. --original names it for the footer.
  const originalIdx = argv.indexOf("--original");
  const originalPath = originalIdx >= 0 ? argv[originalIdx + 1] : null;

  if (!filePath) {
    process.stderr.write("Usage: node preprocess.js <transcript.jsonl> [--original <path>]\n");
    process.exit(1);
  }

  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    process.stderr.write(`Error: file not found: ${absPath}\n`);
    process.exit(1);
  }

  const { cacheDir, cachePath, projectHash } = deriveCachePath(absPath);

  // Sweep project cache: delete all pre-v6 compact files
  const projectCacheDir = path.join(os.homedir(), ".claude", "super-token-saver-data", projectHash);
  if (fs.existsSync(projectCacheDir)) {
    for (const entry of fs.readdirSync(projectCacheDir)) {
      const sessionDir = path.join(projectCacheDir, entry);
      try { if (!fs.statSync(sessionDir).isDirectory()) continue; } catch { continue; }
      for (const name of ["compact.txt", "compact.aggressive.txt"]) {
        const p = path.join(sessionDir, name);
        if (!fs.existsSync(p)) continue;
        if (readFormatVersion(p) < 6) { try { fs.unlinkSync(p); } catch {} }
      }
    }
  }

  // Fresh cache → skip
  if (isCacheFresh(cachePath, absPath)) return;

  // Session ID from filename: first 8 chars of UUID
  const baseName = path.basename(absPath, ".jsonl");
  const sid8 = baseName.slice(0, 8);

  const stream = fs.createReadStream(absPath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  // Collect raw messages in order with line numbers
  // Each entry: { kind: 'user'|'asst', raw, lineNum, ts }
  // Plus context-loss flags collected separately
  const messages = [];
  let pendingMarker = ""; // to attach to next user message
  let lineNum = 0;
  let isFirstUserMessage = true; // for @ startup marker
  let inContinueSkill = false; // track /continue skill execution
  const continueCompactFiles = new Set(); // track Read calls to compact.txt during /continue

  // Marker stacking rules — see "Marker Reference" in the file header.
  //
  //   @@ is always anchored at the start (prepended). Reason: /clear is a
  //      hard session reset, and downstream rule scanners check prefix
  //      positions for "is this turn right after a restart?".
  //
  //   ++ (auto-compact) upgrades a trailing + (manual compact) in-place
  //      rather than appending, because the two events cannot realistically
  //      fire in succession for the same next-real-user-turn — if both
  //      appeared they would be redundant.
  //
  //   + appends once; ++ appends once (deduped).
  //
  //   All other marks (@, ^, ^^, ~, !) simple dedupe-append.
  //
  // Combos that show up in real transcripts: "@@+", "@@++", "@@^", "+!", "@@+!",
  // "+^", etc. — one per context-loss event stacked before the next real user msg.
  function addMarker(mark) {
    if (mark === "@@") {
      if (!pendingMarker.includes("@@")) pendingMarker = "@@" + pendingMarker;
    } else if (mark === "++") {
      if (!pendingMarker.includes("++")) {
        // replace `+` with `++` if present, else append
        if (pendingMarker.endsWith("+") && !pendingMarker.endsWith("++")) {
          pendingMarker = pendingMarker.slice(0, -1) + "++";
        } else {
          pendingMarker += "++";
        }
      }
    } else if (mark === "+") {
      if (!pendingMarker.includes("+")) pendingMarker += "+";
    } else {
      // Simple dedupe append for @, ^, ^^, ~, !
      if (!pendingMarker.includes(mark)) pendingMarker += mark;
    }
  }

  function flushContinueMarker() {
    if (inContinueSkill) {
      // ^ for single session restore, ^^ for multi-session
      const mark = continueCompactFiles.size > 1 ? "^^" : "^";
      addMarker(mark);
      continueCompactFiles.clear();
    }
    inContinueSkill = false;
  }

  for await (const line of rl) {
    lineNum++;
    const trimmed = line.trim();
    if (!trimmed) continue;

    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }

    const type = obj.type;
    const content = obj.message?.content ?? obj.content;
    const ts = obj.timestamp || obj.message?.timestamp || "";

    // Detect auto/manual compact via system compact_boundary event.
    // Emits BOTH: marker (fast rule-based index for build-report) AND visible
    // system turn (readable path for humans/LLMs reading compact.txt).
    if (type === "system" && obj.subtype === "compact_boundary") {
      const trigger = obj.compactMetadata && obj.compactMetadata.trigger;
      if (trigger === "auto") addMarker("++");
      else addMarker("+");
      messages.push({
        kind: "system",
        raw: trigger === "auto" ? "[auto-compact boundary]" : "[manual compact boundary]",
        lineNum,
        ts,
        markers: "", // marker defers to next real user turn — unchanged
      });
      continue;
    }

    // isCompactSummary: the injected auto-compact summary user message.
    // Emit a tiny system placeholder — the summary body itself is huge and
    // already covered by the compact_boundary turn above.
    if (obj.message && obj.message.isCompactSummary === true) {
      addMarker("++");
      messages.push({
        kind: "system",
        raw: "[auto-compact summary injected]",
        lineNum,
        ts,
        markers: "",
      });
      continue;
    }

    if (type === "user") {
      // Detect slash commands from raw content (tags preserved).
      // Strip <task-notification> first — subagent results may contain command
      // tags as discussion topics, not actual command invocations.
      let rawForCmd = typeof content === "string" ? content : extractAssistantText(content);
      rawForCmd = rawForCmd.replace(/<task-notification>[\s\S]*?<\/task-notification>/g, "");
      const cmdNameMatch = rawForCmd && rawForCmd.match(/<command-name>(\/[^<]+)<\/command-name>/);

      if (cmdNameMatch) {
        const cmdName = cmdNameMatch[1].trim(); // e.g. "/clear", "/super-token-saver:continue"
        const cmdArgsMatch = rawForCmd.match(/<command-args>([^<]*)<\/command-args>/);
        const cmdArgs = cmdArgsMatch ? cmdArgsMatch[1].trim() : "";

        // Marker dispatch — key = last colon segment of the command name so
        // both /clear and /some-plugin:clear would dispatch to the same slot.
        const cmdKey = cmdName.replace(/^\//, "").split(":").pop();
        if (cmdKey === "clear") addMarker("@@");
        else if (cmdKey === "compact") addMarker("+");
        else if (cmdKey === "reload-plugins") addMarker("~");
        else if (cmdKey === "model") addMarker("!");

        // /clear: skip as user message — it's recorded at the start of a new
        // session JSONL but was typed in the previous session. Marker (@@) is
        // already queued via addMarker above; no visible turn needed.
        if (cmdKey === "clear") continue;

        // /continue skill invocation tracking (unchanged).
        if (rawForCmd.includes("<command-message>super-token-saver:continue</command-message>")) {
          inContinueSkill = true;
        }

        // Emit the slash command as a visible user turn. Markers stay in
        // pendingMarker and attach to the NEXT real user message — preserves
        // the existing build-report indexing location.
        const commandText = cmdArgs ? `${cmdName} ${cmdArgs}` : cmdName;
        messages.push({
          kind: "user",
          raw: commandText,
          lineNum,
          ts,
          markers: "",
        });
        continue;
      }

      // Non-command user message: /continue flush, then normal handling.
      if (inContinueSkill && !obj.isMeta) {
        flushContinueMarker();
      }

      // Skip meta messages
      if (obj.isMeta) continue;

      // Skip tool_result-only messages
      if (Array.isArray(content)) {
        const hasText = content.some((b) => b && b.type === "text" && b.text);
        const hasImage = content.some((b) => b && b.type === "image");
        if (!hasText && !hasImage) continue;
      }

      const rawText = extractUserTextWithImages(content);
      const cleaned = cleanText(rawText);
      const text = abstractUserContent(cleaned);
      if (!text || shouldSkipUser(text)) continue;

      // First real user message gets @ startup marker (only if no other marker)
      let markers = pendingMarker;
      if (isFirstUserMessage && !markers) {
        markers = "@";
      }
      isFirstUserMessage = false;
      pendingMarker = "";

      messages.push({
        kind: "user",
        raw: text,
        lineNum,
        ts,
        markers,
      });
    } else if (type === "assistant") {
      if (obj.error === "rate_limit") continue;
      // Track Read tool calls to compact.txt files during /continue skill
      if (inContinueSkill && Array.isArray(content)) {
        for (const block of content) {
          if (block && block.type === "tool_use" && block.name === "Read" && block.input && block.input.file_path) {
            const m = block.input.file_path.match(/\/super-token-saver-data\/[^/]+\/([^/]+)\/compact/);
            if (m) continueCompactFiles.add(m[1]);
          }
        }
      }
      const rawText = extractAssistantText(content);
      const cleaned = cleanText(rawText);
      if (!cleaned) continue;
      messages.push({
        kind: "asst",
        raw: cleaned,
        lineNum,
        ts,
      });
    }
  }

  // Group into turns: each user/system msg + following assistant msgs until next boundary
  const turns = [];
  let current = null;
  for (const m of messages) {
    if (m.kind === "user" || m.kind === "system") {
      if (current) turns.push(current);
      current = { user: m, assts: [] };
    } else if (m.kind === "asst") {
      if (current) current.assts.push(m);
      // Orphan assistant (before any user) — skip
    }
  }
  if (current) turns.push(current);

  // Render
  const out = [];
  out.push(`# compact-format: ${COMPACT_FORMAT_VERSION}`);
  out.push("");

  for (const turn of turns) {
    const u = turn.user;
    const iso = toISOUtc(u.ts);
    const header = `[Session:${sid8} ${iso} L${u.lineNum}]${u.markers}`;
    const roleLabel = u.kind === "system" ? "System" : "User";
    const userPreview = truncateUser(u.raw).replace(/\n/g, " ");
    out.push(`${header} ${roleLabel}: "${userPreview}"`);

    const assts = turn.assts;
    if (assts.length === 0) {
      out.push(`-> 0 AI responses`);
      out.push("");
      continue;
    }

    const lineNums = assts.map((a) => a.lineNum);
    const minL = Math.min(...lineNums);
    const maxL = Math.max(...lineNums);
    const refLabel =
      assts.length === 1
        ? `-> 1 AI response at line ${minL}:`
        : `-> ${assts.length} AI responses at lines ${minL}-${maxL}:`;
    out.push(refLabel);

    assts.forEach((a, i) => {
      const preview = truncateAssistant(a.raw).replace(/\n/g, " ");
      const counts = countStructural(a.raw);
      const suffix = formatStructural(counts);
      out.push(`${i + 1}. "${preview}"${suffix}`);
    });
    out.push("");
  }

  // Footer
  out.push("---");
  out.push("# Session references:");
  out.push(`- Session ${sid8} → ${originalPath || absPath}`);
  if (originalPath) out.push(`- Session ${sid8} (normalized copy) → ${absPath}`);
  out.push(
    originalPath
      ? `# [Session:{sid} {ISO} L{n}] headers link to the original transcript above — use L{n} to read the exact line.`
      : `# [Session:{sid} {ISO} L{n}] headers link to original transcripts at ~/.claude/projects/{projectHash}/{sessionId}.jsonl — use L{n} to read the exact line.`,
  );

  // Write to cache file
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cachePath, out.join("\n") + "\n");
}

// Exported so restore.js derives the cache path from this file rather than
// from a copy of the rule. A second copy is how the after-compact hook once
// looked at a path nothing wrote and failed silently for months.
module.exports = { deriveCachePath };

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`preprocess.js error: ${err.message}\n`);
    process.exit(1);
  });
}
