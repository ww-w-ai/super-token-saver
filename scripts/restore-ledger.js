#!/usr/bin/env node
/**
 * restore-ledger.js — what the after-compact hook puts back, and the ledger it keeps.
 *
 * This is PATH ③ of super-compact (Codex, or Claude Code when the 95% prepare failed): the engine
 * did its own compaction and this reads the dropped turns back from the transcript, verbatim. It
 * also serves PATH ② (Claude Code with the super-compact mod off) when the hook passes
 * `--prepared-json <file>`: the ready summary that fork prepared leads the restore. PATH ① (mod on)
 * never reaches the ledger — the mod rebuilt the conversation and the hook injects only a pointer.
 *
 * The user-invoked path (/s-continue) renders compact.txt through restore.js and is unchanged.
 * This file is the OTHER path: unattended, after auto-compact, during an autonomous run. The two
 * differ in what they optimise for. /s-continue is asked for and is allowed to be cheap; the
 * after-compact restore is not asked for and must not lose the thread. So it spends tokens.
 *
 * What an autonomous stretch actually consists of, measured on one 9-hour compaction segment:
 * 7 human turns (14 KB), 58 assistant replies (16 KB), 20 teammate messages (54 KB), 7 subagent
 * completion notices (3 KB), and 244 tool calls with their results. compact.txt drops the
 * teammate messages and notices as machine noise and cuts every reply to 200 characters — three
 * quarters of the context that held the run's state. This path keeps all of it verbatim and
 * drops only the tool traffic, which is what compaction exists to shed.
 *
 * Why no compaction boundary is required: the boundary record is written by Claude Code AFTER the
 * SessionStart(compact) hook runs — measured 112 ms after, and the hook read the file before it
 * landed, took the previous boundary as the last one, and handed back the wrong segment. So the
 * window is not "since the last boundary". It is "since the cursor": the line this ledger last
 * appended up to. On the first compaction that is the top of the transcript. The boundary, when
 * present, is only rendered as a visible marker.
 *
 * Per session, under the session's cache dir:
 *   restore-ledger.md   every segment ever appended, verbatim, in order
 *   restore-cursor      the transcript line number the ledger covers up to
 *
 * Runs can outlive a session. The restore is therefore assembled from up to four sections, in
 * priority order, until a token budget is spent: this session's newest segment (verbatim), its
 * older segments (folded), the project's handoff.md if /s-compact wrote one, and the ledgers of
 * earlier sessions of the same project THAT THIS SESSION NAMES (full id, or the `Session:` + 8-char
 * prefix of a ledger header). An unnamed earlier session is never included: picking them by "same
 * project, ended before, newest five" once filled a restore's first 48K characters with sessions
 * unrelated to the run. A folded segment keeps head + tail of long human turns (over 500),
 * assistant replies (over 200) and teammate messages (head only); every line keeps its L{n} marker into the transcript it came from.
 *
 * The hook cannot inject that restore. Claude Code caps a hook's additionalContext at 10,000
 * characters (measured: inline max 9,993, persisted min 10.0 KB) and shows the model a 2 KB
 * preview past that, so a 150 KB restore never reached the model. The full restore goes to
 * restore.md beside the ledger instead, and the hook output (`--hook`) stays under
 * HOOK_CHAR_CAP: an instruction to Read that file first, its section index with line numbers, and
 * as many of the newest turns as fit. Codex gets the same output; whether Codex has the same cap
 * is unverified.
 *
 * Usage:
 *   node restore-ledger.js <transcript.jsonl> [--append] [--hook [--handled]] [--budget TOKENS] [--out <file>]
 *
 *   --append   extend this session's ledger from its cursor to the end of the transcript first,
 *              and write restore.md. The hook passes it; a dry render for inspection leaves it off.
 *   --hook     print the short hook context instead of the full restore (writes restore.md).
 *   --handled  with --hook: the super-compact module already rebuilt the conversation, so print
 *              only the pointer to restore.md, no turns.
 */

const fs = require("fs");
const path = require("path");
const { deriveCachePath } = require("./preprocess.js");
const { CACHE_BASE } = require("./lib/cache-paths.js");
const codex = require("./lib/codex-transcript.js");

/**
 * Estimated tokens of restore text the hook will hand back at most. Tokens, not characters: a
 * Korean or Japanese session runs about one token per 1.5 characters against four for English,
 * so a character budget that is safe for one language is three times over for the other. The
 * default is sized so the restore cannot by itself push a 200K-token window back over the
 * auto-compact threshold; that would compact again at once and drop what was just put back.
 */
const DEFAULT_BUDGET = 60_000;

/** Rough token estimate: ASCII at ~4 chars per token, everything else (CJK, accents, emoji) at ~1.5. */
function estimateTokens(text) {
  let ascii = 0;
  let other = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) < 128) ascii++;
    else other++;
  }
  return Math.ceil(ascii / 4 + other / 1.5);
}
/** Folded widths: what an older segment keeps of each reply and teammate message. */
// Same criteria as hooks/super-compact.ts (USER_FOLD / REPLY_FOLD): over -> head + marker + tail.
const FOLD_USER = { over: 500, head: 300, tail: 200 };
const FOLD_REPLY = { over: 200, head: 100, tail: 100 };
// why: intentional divergence from the mod. The no-summary path (Codex) has no summary section B to hold teammate text verbatim, so the ledger keeps it folded here.
const FOLD_TEAMMATE = { over: 300, head: 300, tail: 0 };
/** Earlier sessions this session names, at most. */
const MAX_EARLIER_SESSIONS = 5;
/** Characters of hook output, at most. Claude Code's additionalContext cap is 10,000. */
const HOOK_CHAR_CAP = 9_000;

const LEDGER_NAME = "restore-ledger.md";
const CURSOR_NAME = "restore-cursor";
const HANDOFF_NAME = "handoff.md";
const RESTORE_NAME = "restore.md";

/**
 * Bumped whenever `classify()` learns to keep a row type it used to skip. A
 * ledger written by an older version already advanced its cursor past those
 * rows, so they are gone from the ledger forever unless the transcript is
 * re-read from the top — this is the version that forces that rebuild.
 * v2: `codex_agent_comm` rows (Codex outgoing dispatch + inbound envelopes).
 */
const LEDGER_FORMAT_VERSION = 2;
const FORMAT_LINE = /^# format: (\d+)\s*$/m;

// ───────────────────────────── transcript reading ─────────────────────────────

function textBlocks(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b && b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n");
}

function hasBlock(content, type) {
  return Array.isArray(content) && content.some((b) => b && b.type === type);
}

/**
 * Classify one transcript record into what the ledger keeps, or null to skip it.
 *
 * Kept: human turns, the model's own text replies, teammate messages and subagent completion
 * notices (both arrive as user records), and the body of every SendMessage the model sent —
 * the instruction side of a teammate exchange lives only in that tool_use input.
 * Skipped: tool_use/tool_result traffic, local command echoes, meta records, and the compact
 * summary the harness injects (it is a paraphrase, and the ledger holds the original).
 */
function classify(obj) {
  const type = obj.type;
  const msg = obj.message || {};
  const content = msg.content !== undefined ? msg.content : obj.content;

  if (type === "system" && obj.subtype === "compact_boundary") {
    const trigger = obj.compactMetadata && obj.compactMetadata.trigger;
    return { role: "System", text: trigger === "auto" ? "[auto-compact boundary]" : "[manual compact boundary]" };
  }
  if (type === "user") {
    // The injected compact summary carries its flag on the record, not inside message.
    if (obj.isMeta || obj.isCompactSummary || msg.isCompactSummary) return null;
    if (hasBlock(content, "tool_result")) return null;
    const text = textBlocks(content).trim();
    if (!text) return null;
    if (/^<local-command|^<command-name>/.test(text)) return null;
    if (/^\[Request interrupted by user/.test(text)) return null;
    if (text.includes("<teammate-message")) return { role: "Teammate", text };
    if (text.includes("<task-notification>")) return { role: "Agent", text };
    if (/^<[a-z]/.test(text)) return { role: "Machine", text };
    return { role: "User", text };
  }
  if (type === "assistant") {
    if (obj.error === "rate_limit") return null;
    const parts = [];
    const text = textBlocks(content).trim();
    if (text) parts.push(text);
    if (Array.isArray(content)) {
      for (const b of content) {
        if (b && b.type === "tool_use" && b.name === "SendMessage" && b.input) {
          const to = b.input.to || b.input.recipient || "?";
          const body = b.input.message || b.input.content || "";
          if (body) parts.push(`[SendMessage → ${to}] ${body}`);
        }
      }
    }
    if (parts.length === 0) return null;
    return { role: "Assistant", text: parts.join("\n") };
  }
  // Codex agent communication, normalized by codex-transcript.js into its own
  // row type so it can never be mistaken for a `user`/`assistant` transcript
  // record: an outgoing spawn_agent/send_message/followup_task call the model
  // itself issued, or an inbound anchored MESSAGE/FINAL_ANSWER/NEW_TASK
  // envelope from another agent.
  if (type === "codex_agent_comm") {
    if (obj.direction === "outgoing") {
      const text = String(obj.text || "").trim();
      if (!text) return null;
      const to = obj.to ? ` → ${obj.to}` : "";
      return { role: "Assistant", text: `[${obj.tool}${to}] ${text}` };
    }
    const text = String(obj.text || "").trim();
    if (!text) return null;
    return { role: obj.messageType === "MESSAGE" ? "Teammate" : "Agent", text };
  }
  return null;
}

/** Records after `fromLine` (1-based, exclusive) as ledger entries, plus the last line read. */
function readSegment(transcriptPath, fromLine) {
  const raw = fs.readFileSync(transcriptPath, "utf8");
  const lines = raw.split("\n");
  const entries = [];
  let last = fromLine;
  for (let i = fromLine; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    if (!line.trim()) continue;
    last = lineNum;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj.isSidechain) continue;
    const c = classify(obj);
    if (!c) continue;
    const ts = obj.timestamp || (obj.message && obj.message.timestamp) || "";
    entries.push({ lineNum, ts, role: c.role, text: c.text });
  }
  return { entries, last };
}

// ───────────────────────────── ledger files ─────────────────────────────

/**
 * The file to parse, and the file its L{n} markers address. A Codex rollout is normalized to a
 * CC-shaped copy first, one line per original line, so the line numbers stay the original's.
 * `readSessionMeta` returning null is the test for "not a Codex rollout": it parses the first line
 * and looks for a session_meta row, so it cannot mistake a Claude Code transcript for one.
 */
function resolveSource(transcriptPath) {
  const source = codex.resolveCodexSource(transcriptPath);
  if (!source) return { parsePath: transcriptPath, original: transcriptPath, isCodex: false, cwd: null };
  const { meta } = source;
  return {
    parsePath: codex.normalizeCodexTranscript(source.path, meta),
    original: source.path,
    isCodex: true,
    cwd: meta.cwd || null,
  };
}

function ledgerPaths(transcriptPath) {
  const { parsePath, original, isCodex, cwd } = resolveSource(path.resolve(transcriptPath));
  const { cacheDir, sessionId, projectHash } = deriveCachePath(parsePath);
  return {
    cacheDir,
    sessionId,
    projectHash,
    parsePath,
    original,
    isCodex,
    cwd,
    transcriptDir: path.dirname(parsePath),
    projectDir: path.dirname(cacheDir),
    // The shared cross-host root, never the host-specific tree: /s-compact
    // always writes handoff.md under the Claude Code tree
    // (~/.claude/super-token-saver-data/{projectHash}/handoff.md), even for a
    // Codex session, whose own cache lives under .../codex/{projectHash}/. A
    // Codex restore that looked in its own tree would never find it.
    handoffDir: path.join(CACHE_BASE, projectHash),
    ledger: path.join(cacheDir, LEDGER_NAME),
    cursor: path.join(cacheDir, CURSOR_NAME),
    restore: path.join(cacheDir, RESTORE_NAME),
  };
}

function readCursor(p) {
  try {
    const n = parseInt(fs.readFileSync(p, "utf8").trim(), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function shortSid(sessionId) {
  return String(sessionId).slice(0, 8);
}

function renderEntry(e, sid) {
  const head = `[Session:${sid} ${e.ts} L${e.lineNum}] ${e.role}:`;
  return `${head}\n${e.text.trim()}\n`;
}

function ledgerFormatVersion(text) {
  const m = FORMAT_LINE.exec(text);
  return m ? parseInt(m[1], 10) : 1; // unstamped ledgers predate this field
}

/**
 * A ledger built by an older format version has a cursor already past rows
 * `classify()` now knows how to keep — for Codex that means agent
 * communication a run genuinely sent or received, silently unrecoverable
 * unless the transcript is re-read from line 0. Never done for a rebuild that
 * would come back empty, and the pre-migration ledger+cursor are always kept
 * as a backup rather than overwritten, so a rebuild is never a data-loss risk.
 */
function migrateLedgerIfStale(p) {
  if (!p.isCodex || !fs.existsSync(p.ledger)) return;
  const text = fs.readFileSync(p.ledger, "utf8");
  const version = ledgerFormatVersion(text);
  if (version >= LEDGER_FORMAT_VERSION) return;
  const { entries, last } = readSegment(p.parsePath, 0);
  // A truncated/missing source is not evidence that the old history should disappear.
  if (!entries.length || last < readCursor(p.cursor)) return;

  const ledgerBak = `${p.ledger}.v${version}.bak`;
  const cursorBak = `${p.cursor}.v${version}.bak`;
  if (!fs.existsSync(ledgerBak)) fs.copyFileSync(p.ledger, ledgerBak);
  if (fs.existsSync(p.cursor) && !fs.existsSync(cursorBak)) fs.copyFileSync(p.cursor, cursorBak);

  const sid = shortSid(p.sessionId);
  const header =
    `# restore-ledger — session ${p.sessionId}\n` +
    `# transcript: ${p.original}\n` +
    `# format: ${LEDGER_FORMAT_VERSION}\n` +
    `# migrated from v${version}: full-history rebuild recovers rows the old normalizer skipped; ` +
    `prior ledger kept at ${path.basename(ledgerBak)}\n\n`;
  const segHeader = `### ▶ segment 1 — L${entries[0].lineNum}..L${entries[entries.length - 1].lineNum} — ${entries[0].ts} → ${entries[entries.length - 1].ts}\n\n`;
  const body = entries.map((e) => renderEntry(e, sid)).join("\n");
  fs.writeFileSync(p.ledger, header + segHeader + body + "\n");
  fs.writeFileSync(p.cursor, String(last));
}

/**
 * Append the transcript's unread tail to this session's ledger as one segment.
 * Returns the segment text (empty when nothing new), and moves the cursor.
 */
function appendSegment(transcriptPath) {
  const p = ledgerPaths(transcriptPath);
  migrateLedgerIfStale(p);
  const from = readCursor(p.cursor);
  const { entries, last } = readSegment(p.parsePath, from);
  if (entries.length === 0) {
    if (last > from) {
      fs.mkdirSync(p.cacheDir, { recursive: true });
      fs.writeFileSync(p.cursor, String(last));
    }
    return { paths: p, segment: "" };
  }
  const sid = shortSid(p.sessionId);
  const first = entries[0].ts;
  const final = entries[entries.length - 1].ts;
  const n = fs.existsSync(p.ledger) ? countSegments(fs.readFileSync(p.ledger, "utf8")) + 1 : 1;
  const header = `### ▶ segment ${n} — L${entries[0].lineNum}..L${entries[entries.length - 1].lineNum} — ${first} → ${final}\n\n`;
  const body = entries.map((e) => renderEntry(e, sid)).join("\n");
  const segment = header + body;
  fs.mkdirSync(p.cacheDir, { recursive: true });
  if (!fs.existsSync(p.ledger)) {
    fs.writeFileSync(p.ledger, `# restore-ledger — session ${p.sessionId}\n# transcript: ${p.original}\n${p.isCodex ? `# format: ${LEDGER_FORMAT_VERSION}\n` : ""}\n`);
  }
  fs.appendFileSync(p.ledger, segment + "\n");
  fs.writeFileSync(p.cursor, String(last));
  return { paths: p, segment };
}

const SEGMENT_HEAD = /^### ▶ segment (\d+) — /m;

function countSegments(text) {
  return (text.match(/^### ▶ segment \d+ — /gm) || []).length;
}

/** The ledger split into its segments, oldest first. */
function splitSegments(text) {
  const parts = text.split(/^(?=### ▶ segment \d+ — )/m).filter((s) => SEGMENT_HEAD.test(s));
  return parts;
}

// ───────────────────────────── folding ─────────────────────────────

const ENTRY_HEAD = /^\[Session:[^\]]+\] (User|Assistant|Teammate|Agent|Machine|System):$/;

function fold(s, { over, head, tail }) {
  const t = s.trim();
  if (t.length <= over) return t;
  const tailText = tail > 0 ? " " + t.slice(-tail).trimStart() : "";
  return t.slice(0, head).trimEnd() + ` …[+${t.length - head - tail} chars, read L{n} for the rest]` + tailText;
}

/**
 * A segment with every entry folded to head + tail by the FOLD_* rules (short ones stay whole). The entry headers and their L{n}
 * markers are untouched, so anything shortened here can be read back from the transcript.
 */
function foldSegment(segment) {
  const out = [];
  const lines = segment.split("\n");
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(ENTRY_HEAD);
    if (!m) {
      out.push(lines[i]);
      i++;
      continue;
    }
    const role = m[1];
    out.push(lines[i]);
    i++;
    const body = [];
    while (i < lines.length && !ENTRY_HEAD.test(lines[i]) && !lines[i].startsWith("### ▶ segment ")) {
      body.push(lines[i]);
      i++;
    }
    const text = body.join("\n").trim();
    if (role === "User" || role === "System") out.push(fold(text, FOLD_USER), "");
    else if (role === "Teammate") out.push(fold(text, FOLD_TEAMMATE), "");
    else out.push(fold(text, FOLD_REPLY), "");
  }
  return out.join("\n");
}

// ───────────────────────────── assembly ─────────────────────────────

function fileMtime(p) {
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return 0;
  }
}

/** Ledgers of other sessions in this project, newest first, that predate this session's ledger. */
const SESSION_JSONL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/i;

/** Timestamp of the first record in a transcript, in ms since the epoch, or null. */
function startedAt(transcriptPath) {
  let fd;
  try {
    fd = fs.openSync(transcriptPath, "r");
    const buf = Buffer.alloc(1 << 16);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    for (const line of buf.toString("utf8", 0, n).split("\n")) {
      if (!line.trim()) continue;
      const obj = JSON.parse(line);
      const ts = Date.parse(obj.timestamp || (obj.message && obj.message.timestamp) || "");
      return Number.isFinite(ts) ? ts : null;
    }
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  return null;
}

/**
 * Earlier sessions of the same project whose turns this restore may carry on, newest first.
 *
 * An earlier session is one whose transcript stopped changing before this session's first record:
 * it ended before we started. A transcript still being written after that is a parallel session,
 * not an ancestor, and is left out. Their ledgers are brought up to date HERE, from the transcript
 * on disk, because the hook only ever appends at compaction — a session that ended without
 * compacting would otherwise have no ledger and nothing to hand on. A ledger whose transcript is
 * gone is still consulted.
 *
 * Only sessions this session names are candidates (`namesSession`). The names are searched in
 * this session's own ledger, not its raw transcript: the raw transcript also holds earlier hook
 * output, which listed unrelated sessions and would otherwise keep re-selecting them.
 */
function earlierSessions(p) {
  const own = fs.existsSync(p.ledger) ? fs.readFileSync(p.ledger, "utf8") : "";
  const named = (sessionId) => namesSession(own, sessionId);
  return p.isCodex ? earlierSessionsCodex(p, named) : earlierSessionsCC(p, named);
}

/** Whether `text` names `sessionId`: the full id, or a ledger header's `Session:` + 8-char prefix. */
function namesSession(text, sessionId) {
  return text.includes(sessionId) || text.includes(`Session:${shortSid(sessionId)}`);
}

/**
 * Codex predecessors of the same project. Codex keeps one global session
 * tree (no per-project directory to list), so `listCodexSessions` — already
 * scoped to this exact cwd and already excluding subagent rollouts — is the
 * only way to find them, not a directory scan of the (per-session) normalized
 * tree. Ordering and the "already ended" cutoff both use each session's own
 * `session_meta` timestamp, never a normalized file's mtime: the normalizer
 * only exists once a session is first read, so its mtime reflects when THAT
 * happened, not when the session itself ran.
 */
function earlierSessionsCodex(p, named) {
  if (!p.cwd) return [];
  const ownMeta = codex.readSessionMeta(p.original);
  const ownStart = ownMeta && ownMeta.started ? Date.parse(ownMeta.started) : NaN;
  if (!Number.isFinite(ownStart)) return []; // no safe reference point to compare against

  let sessions = [];
  try { sessions = codex.listCodexSessions(p.cwd, { includeSubagents: false }); } catch { sessions = []; }

  const candidates = [];
  for (const s of sessions) {
    if (s.sessionId === p.sessionId || !named(s.sessionId)) continue;
    const start = s.started ? Date.parse(s.started) : NaN;
    if (!Number.isFinite(start)) continue; // missing timestamp: excluded, never Date.now()
    const ended = Number(s.mtimeMs);
    if (start >= ownStart || !Number.isFinite(ended) || ended > ownStart) continue;
    candidates.push({ sessionId: s.sessionId, path: s.path, ended });
  }
  candidates.sort((a, b) => b.ended - a.ended || a.sessionId.localeCompare(b.sessionId));

  const found = [];
  for (const c of candidates.slice(0, MAX_EARLIER_SESSIONS)) {
    let ledger;
    try { ledger = appendSegment(c.path).paths.ledger; } catch { continue; }
    if (fs.existsSync(ledger)) found.push({ sessionId: c.sessionId, path: ledger, original: c.path, mtime: c.ended });
  }
  return found;
}

function earlierSessionsCC(p, named) {
  const ownStart = startedAt(p.parsePath) || Date.now();
  const candidates = new Map(); // sessionId -> { sessionId, transcript?, mtime }

  let siblings = [];
  try {
    siblings = fs.readdirSync(p.transcriptDir).filter((f) => SESSION_JSONL.test(f));
  } catch {}
  for (const f of siblings) {
    const full = path.join(p.transcriptDir, f);
    const sid = f.slice(0, -".jsonl".length);
    if (sid === p.sessionId || !named(sid)) continue;
    const mt = fileMtime(full);
    if (!mt || mt > ownStart) continue;
    candidates.set(sid, { sessionId: sid, transcript: full, mtime: mt });
  }

  let cached = [];
  try {
    cached = fs.readdirSync(p.projectDir);
  } catch {}
  for (const d of cached) {
    if (d === p.sessionId || candidates.has(d) || !named(d)) continue;
    const lp = path.join(p.projectDir, d, LEDGER_NAME);
    const mt = fileMtime(lp);
    if (mt) candidates.set(d, { sessionId: d, transcript: null, mtime: mt });
  }

  const found = [];
  const ordered = [...candidates.values()].sort((a, b) => b.mtime - a.mtime).slice(0, MAX_EARLIER_SESSIONS);
  for (const c of ordered) {
    let ledger = path.join(p.projectDir, c.sessionId, LEDGER_NAME);
    if (c.transcript) {
      try {
        ledger = appendSegment(c.transcript).paths.ledger;
      } catch {
        continue;
      }
    }
    if (fs.existsSync(ledger)) found.push({ sessionId: c.sessionId, path: ledger, mtime: c.mtime });
  }
  return found;
}

/**
 * The tail of a folded segment that fits in `room`, cut on an entry boundary so no header is
 * orphaned. Used only when even the folded newest segment overflows the budget: the most recent
 * turns are the ones a resumed run needs, so the cut is from the front.
 */
function tailWithin(segment, fits) {
  const lines = segment.split("\n");
  const head = lines[0];
  const starts = [];
  for (let i = 1; i < lines.length; i++) if (ENTRY_HEAD.test(lines[i])) starts.push(i);
  for (let k = 0; k < starts.length; k++) {
    const body = lines.slice(starts[k]).join("\n");
    const note = k ? `\n(${k} earlier entries in this segment left on disk; the ledger has them)\n` : "\n";
    const text = head + note + "\n" + body;
    if (fits(text)) return text;
  }
  return "";
}

/** The restore's sections, in priority order; the file lists them in this order. */
const SECTION_TITLES = {
  newest: "## 1. This session: newest segment",
  older: "## 2. This session: earlier segments (folded)",
  handoff: "## 3. Handoff written by /s-compact",
  earlier: "## 4. Earlier sessions this session names (folded)",
};

/** Token accounting for the restore: one budget across every block and heading taken. */
function budgeter(budget) {
  let spent = 0;
  const cost = (parts) => parts.reduce((s, t) => s + estimateTokens(t) + 1, 0);
  return {
    fits: (...parts) => spent + cost(parts) <= budget,
    take(...parts) {
      if (!this.fits(...parts)) return false;
      spent += cost(parts);
      return true;
    },
  };
}

/** A heading's cost only on the first block taken under it. */
function headingOnce(list, heading) {
  return list.length ? [] : [heading];
}

/**
 * This session's own segments. The newest is never dropped for size: verbatim if it fits, else
 * folded, else the tail of the folded text. Older segments follow, newest first, until one does
 * not fit; they are returned oldest first.
 */
function takeOwn(p, b) {
  const own = fs.existsSync(p.ledger) ? splitSegments(fs.readFileSync(p.ledger, "utf8")) : [];
  const out = { newest: [], older: [] };
  if (!own.length) return out;
  const newest = own[own.length - 1];
  const head = SECTION_TITLES.newest;
  const folded = foldSegment(newest);
  const chosen = b.fits(head, newest) ? newest : b.fits(head, folded) ? folded : tailWithin(folded, (t) => b.fits(head, t));
  if (chosen && b.take(head, chosen)) out.newest.push(chosen);
  for (let i = own.length - 2; i >= 0; i--) {
    const seg = foldSegment(own[i]);
    if (!b.take(...headingOnce(out.older, SECTION_TITLES.older), seg)) break;
    out.older.unshift(seg);
  }
  return out;
}

function takeHandoff(p, b) {
  const file = path.join(p.handoffDir, HANDOFF_NAME);
  if (!fs.existsSync(file)) return [];
  const text = `(written ${new Date(fileMtime(file)).toISOString()})\n\n${fs.readFileSync(file, "utf8").trim()}`;
  return b.take(SECTION_TITLES.handoff, text) ? [text] : [];
}

/**
 * Earlier sessions this session names, newest session first while the budget lasts; each one's
 * segments newest first until one does not fit. Returned oldest session first, each session's
 * segments oldest first, so its label always opens its own group.
 */
function takeEarlier(p, b) {
  const groups = [];
  let opened = false;
  for (const e of earlierSessions(p)) {
    const label = `### earlier session ${e.sessionId}${e.original ? `\n# transcript: ${e.original}\n# ledger: ${e.path}` : ""}`;
    const segs = splitSegments(fs.readFileSync(e.path, "utf8"));
    const group = { label, segments: [] };
    for (let i = segs.length - 1; i >= 0; i--) {
      const seg = foldSegment(segs[i]);
      const heads = [...(opened ? [] : [SECTION_TITLES.earlier]), ...headingOnce(group.segments, label)];
      if (!b.take(...heads, seg)) break;
      opened = true;
      group.segments.unshift(seg);
    }
    if (!group.segments.length) break;
    groups.unshift(group);
  }
  return groups;
}

/**
 * The restore, as sections in priority order: this session's newest segment, its older segments,
 * handoff.md, earlier sessions this session names. Chronological inside each section. Blocks are
 * chosen newest first under one token budget, so what is left out is always the oldest.
 */
function collectSections(p, budget) {
  const b = budgeter(budget);
  const own = takeOwn(p, b);
  const handoff = takeHandoff(p, b);
  const earlier = takeEarlier(p, b);
  return [
    { title: SECTION_TITLES.newest, blocks: own.newest },
    { title: SECTION_TITLES.older, blocks: own.older },
    { title: SECTION_TITLES.handoff, blocks: handoff },
    { title: SECTION_TITLES.earlier, blocks: earlier.flatMap((g) => [g.label, ...g.segments]) },
  ].filter((s) => s.blocks.length);
}

/** Sections rendered as one text, with each section's first and last line (1-based). */
function renderSections(sections) {
  const lines = [];
  const index = [];
  for (const s of sections) {
    const start = lines.length + 1;
    lines.push(s.title, "");
    for (const block of s.blocks) lines.push(...block.trim().split("\n"), "");
    index.push({ title: s.title.replace(/^## /, ""), start, end: lines.length - 1 }); // last line is the blank separator
  }
  return { text: lines.join("\n"), index };
}

/** The full restore text (what restore.md holds and a non-hook run prints). */
function assemble(p, budget) {
  return renderSections(collectSections(p, budget)).text;
}

// ───────────────────────────── hook output ─────────────────────────────

const HOOK_HEAD = `# Restored: the turns this session lost to compaction

Compaction dropped earlier turns from context. super-token-saver read them back from this
session's own transcript: the real conversation, not a summary and **not a new request**.`;

const HANDLED_HEAD = `# Compaction handled by super-compact

super-token-saver's super-compact module rebuilt this conversation itself (a summary, this span's
dialogue abbreviated with [L{n}] line pointers, the current turn verbatim), so the restore is not
injected again.
If a detail turns out to be missing, the full restore is on disk:`;

const HOOK_RULES = `Prefer it over the compact summary wherever the two disagree, and do NOT re-derive findings
that already appear in it. If you were mid-run on an autonomous task (cowork-sprint, pdca-wf, a
Workflow), resume from it rather than re-planning. Standing orders stated there still govern the
work. Folded entries end in \`…[+N chars, read L{n} for the rest]\`: read that line of the
transcript (named in the entry's \`[Session:… L{n}]\` header) when one matters.`;

function fileIndex(restorePath, text, index) {
  const bytes = Buffer.byteLength(text, "utf8");
  const rows = index.map((s) => `- lines ${s.start}-${s.end}: ${s.title}`).join("\n");
  return `\`${restorePath}\` (${bytes} bytes, ${text.split("\n").length} lines). Sections, newest first:\n${rows}`;
}

/** Whole entries of `segment`, newest last, that fit in `room` characters; or the last entry cut. */
function newestEntriesWithin(segment, room) {
  const lines = segment.split("\n");
  const starts = [];
  for (let i = 0; i < lines.length; i++) if (ENTRY_HEAD.test(lines[i])) starts.push(i);
  for (const s of starts) {
    const text = lines.slice(s).join("\n").trim();
    if (text.length <= room) return text;
  }
  if (!starts.length) return "";
  const last = lines.slice(starts[starts.length - 1]).join("\n").trim();
  const marker = "\n…[cut here; the rest of this entry is in the file above]";
  const keep = room - marker.length;
  return keep > 200 ? last.slice(0, keep) + marker : "";
}

/**
 * What the after-compact hook injects, always under HOOK_CHAR_CAP characters: an instruction to
 * Read restore.md first with its section index, then as many of the newest turns as fit.
 * With `handled`, only the pointer: the super-compact module already put the dialogue back.
 */
function hookContext(p, rendered, { handled = false } = {}) {
  const pointer = fileIndex(p.restore, rendered.text, rendered.index);
  if (handled) return `${HANDLED_HEAD}\n${pointer}\n`.slice(0, HOOK_CHAR_CAP - 1);
  const head =
    `${HOOK_HEAD}\n\n**Before your first substantive action, Read this file in full:** ${pointer}\n\n${HOOK_RULES}\n\n` +
    "## Newest turns, verbatim (everything older is only in the file)\n\n";
  const own = fs.existsSync(p.ledger) ? splitSegments(fs.readFileSync(p.ledger, "utf8")) : [];
  const turns = own.length ? newestEntriesWithin(own[own.length - 1], HOOK_CHAR_CAP - 1 - head.length) : "";
  return (head + turns + "\n").slice(0, HOOK_CHAR_CAP - 1);
}

// ───────────────────────────── CLI ─────────────────────────────

const VALUED = new Set(["--budget", "--out", "--prepared-json"]);

/** Title of the section a path-2 run prepends: the summary the 95% fork prepared before compaction. */
const PREPARED_SECTION_TITLE = "## Prepared summary (written at 95%, before this compaction)";

/**
 * The ready summary inside a prepared.json, for path 2 (CC, super-compact mod off): the shell fork
 * wrote the summary but no mod rebuilt the conversation, so it is prepended to the restore here.
 * Any other status, or a missing/unreadable file, yields "" and the restore is the ledger alone
 * (path 3, unchanged).
 */
function preparedSummary(file) {
  if (!file) return "";
  try {
    const m = JSON.parse(fs.readFileSync(file, "utf8"));
    return m && m.status === "ready" && typeof m.summary === "string" ? m.summary.trim() : "";
  } catch {
    return "";
  }
}

function parseArgs(argv) {
  const opts = { transcript: null, append: false, hook: false, handled: false, budget: DEFAULT_BUDGET, out: null, preparedJson: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (VALUED.has(a)) {
      const v = argv[++i];
      if (a === "--budget") {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) opts.budget = n;
      } else if (a === "--prepared-json") opts.preparedJson = v;
      else opts.out = v;
    } else if (a === "--append") opts.append = true;
    else if (a === "--hook") opts.hook = true;
    else if (a === "--handled") opts.handled = true;
    else if (!a.startsWith("--") && opts.transcript === null) opts.transcript = a;
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.transcript) {
    process.stderr.write("Usage: node restore-ledger.js <transcript.jsonl> [--append] [--hook [--handled]] [--budget TOKENS] [--out <file>]\n");
    process.exit(1);
  }
  const abs = path.resolve(opts.transcript);
  if (!fs.existsSync(abs)) {
    process.stderr.write(`Error: file not found: ${abs}\n`);
    process.exit(1);
  }
  const p = opts.append ? appendSegment(abs).paths : ledgerPaths(abs);
  let sections = collectSections(p, opts.budget);
  // Path 2 (mod off): the 95% fork prepared a summary but nothing rebuilt the conversation, so the
  // prepared summary leads the restore. Path 3 passes no --prepared-json and this is a no-op.
  const prepared = preparedSummary(opts.preparedJson);
  if (prepared) sections = [{ title: PREPARED_SECTION_TITLE, blocks: [prepared] }, ...sections];
  const rendered = renderSections(sections);
  if (rendered.text.trim() === "") {
    process.stderr.write("restore-ledger.js: nothing to restore\n");
    process.exit(2);
  }
  if (opts.append || opts.hook) {
    fs.mkdirSync(p.cacheDir, { recursive: true });
    fs.writeFileSync(p.restore, rendered.text);
  }
  const out = opts.hook ? hookContext(p, rendered, { handled: opts.handled }) : rendered.text;
  if (opts.out) fs.writeFileSync(opts.out, out);
  else process.stdout.write(out);
}

if (require.main === module) main();

module.exports = {
  classify,
  readSegment,
  appendSegment,
  foldSegment,
  assemble,
  collectSections,
  renderSections,
  hookContext,
  namesSession,
  ledgerPaths,
  estimateTokens,
  DEFAULT_BUDGET,
  HOOK_CHAR_CAP,
  LEDGER_FORMAT_VERSION,
  ledgerFormatVersion,
};
