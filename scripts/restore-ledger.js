#!/usr/bin/env node
/**
 * restore-ledger.js — what the after-compact hook puts back, and the ledger it keeps.
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
 * Runs can outlive a session. The hook output is therefore assembled from three sources, most
 * recent first, until a token budget is spent: this session's ledger (newest segment
 * verbatim, older ones folded), the project's handoff.md if /s-compact wrote one, and the ledgers
 * of earlier sessions in the same project directory, folded, newest first. A folded segment keeps
 * every human turn whole and shortens assistant replies and teammate messages; nothing is
 * dropped, and every line keeps its L{n} marker into the transcript it came from.
 *
 * Usage:
 *   node restore-ledger.js <transcript.jsonl> [--append] [--budget TOKENS] [--out <file>]
 *
 *   --append   extend this session's ledger from its cursor to the end of the transcript first.
 *              The hook passes it; a dry render for inspection leaves it off.
 */

const fs = require("fs");
const path = require("path");
const { deriveCachePath } = require("./preprocess.js");
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
const FOLD_REPLY = 200;
const FOLD_TEAMMATE = 300;
/** Sessions of the same project consulted for earlier context, at most. */
const MAX_EARLIER_SESSIONS = 5;

const LEDGER_NAME = "restore-ledger.md";
const CURSOR_NAME = "restore-cursor";
const HANDOFF_NAME = "handoff.md";

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
  let meta = null;
  try {
    meta = codex.readSessionMeta(transcriptPath);
  } catch {
    meta = null;
  }
  if (!meta) return { parsePath: transcriptPath, original: transcriptPath };
  return { parsePath: codex.normalizeCodexTranscript(transcriptPath, meta), original: transcriptPath };
}

function ledgerPaths(transcriptPath) {
  const { parsePath, original } = resolveSource(path.resolve(transcriptPath));
  const { cacheDir, sessionId, projectHash } = deriveCachePath(parsePath);
  return {
    cacheDir,
    sessionId,
    projectHash,
    parsePath,
    original,
    transcriptDir: path.dirname(parsePath),
    projectDir: path.dirname(cacheDir),
    ledger: path.join(cacheDir, LEDGER_NAME),
    cursor: path.join(cacheDir, CURSOR_NAME),
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

/**
 * Append the transcript's unread tail to this session's ledger as one segment.
 * Returns the segment text (empty when nothing new), and moves the cursor.
 */
function appendSegment(transcriptPath) {
  const p = ledgerPaths(transcriptPath);
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
    fs.writeFileSync(p.ledger, `# restore-ledger — session ${p.sessionId}\n# transcript: ${p.original}\n\n`);
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

function fold(s, width) {
  const t = s.trim();
  if (t.length <= width) return t;
  return t.slice(0, width).trimEnd() + ` …[+${t.length - width} chars, read L{n} for the rest]`;
}

/**
 * A segment with every human turn whole and the rest shortened. The entry headers and their L{n}
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
    if (role === "User" || role === "System") out.push(text, "");
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
 */
function earlierSessions(p) {
  const ownStart = startedAt(p.parsePath) || Date.now();
  const candidates = new Map(); // sessionId -> { sessionId, transcript?, mtime }

  let siblings = [];
  try {
    siblings = fs.readdirSync(p.transcriptDir).filter((f) => SESSION_JSONL.test(f));
  } catch {}
  for (const f of siblings) {
    const full = path.join(p.transcriptDir, f);
    const sid = f.slice(0, -".jsonl".length);
    if (sid === p.sessionId) continue;
    const mt = fileMtime(full);
    if (!mt || mt > ownStart) continue;
    candidates.set(sid, { sessionId: sid, transcript: full, mtime: mt });
  }

  let cached = [];
  try {
    cached = fs.readdirSync(p.projectDir);
  } catch {}
  for (const d of cached) {
    if (d === p.sessionId || candidates.has(d)) continue;
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

/**
 * The text the hook hands back. Newest first inside the budget: this session's segments (the
 * latest verbatim, earlier ones folded), then handoff.md, then earlier sessions' ledgers folded.
 * Emitted oldest-first so it reads as a conversation.
 *
 * The newest segment is never dropped for size. If it does not fit verbatim it is folded; if it
 * does not fit folded, its tail is taken. Only then do older segments compete for what is left.
 */
function assemble(p, budget) {
  const pieces = []; // pushed newest first, reversed at the end
  let spent = 0;
  const blockOf = (label, text) => (label ? `${label}\n\n` : "") + text.trim() + "\n";
  const fits = (label, text) => spent + estimateTokens(blockOf(label, text)) + 1 <= budget;
  const take = (label, text) => {
    if (!text || !text.trim() || !fits(label, text)) return false;
    const block = blockOf(label, text);
    pieces.push(block);
    spent += estimateTokens(block) + 1; // +1 for the joining newline
    return true;
  };

  let own = [];
  if (fs.existsSync(p.ledger)) own = splitSegments(fs.readFileSync(p.ledger, "utf8"));
  if (own.length > 0) {
    const newest = own[own.length - 1];
    if (!take("", newest)) {
      const folded = foldSegment(newest);
      if (!take("", folded)) take("", tailWithin(folded, (t) => fits("", t)));
    }
    for (let i = own.length - 2; i >= 0; i--) {
      if (!take("", foldSegment(own[i]))) break;
    }
  }

  const handoff = path.join(p.projectDir, HANDOFF_NAME);
  if (fs.existsSync(handoff)) {
    take(`## handoff written by /s-compact (${new Date(fileMtime(handoff)).toISOString()})`, fs.readFileSync(handoff, "utf8"));
  }

  for (const e of earlierSessions(p)) {
    const segs = splitSegments(fs.readFileSync(e.path, "utf8"));
    let any = false;
    for (let i = segs.length - 1; i >= 0; i--) {
      if (!take(any ? "" : `## earlier session ${e.sessionId} (same project, folded)`, foldSegment(segs[i]))) break;
      any = true;
    }
    if (!any) break;
  }

  return pieces.reverse().join("\n");
}

// ───────────────────────────── CLI ─────────────────────────────

const VALUED = new Set(["--budget", "--out"]);

function parseArgs(argv) {
  const opts = { transcript: null, append: false, budget: DEFAULT_BUDGET, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (VALUED.has(a)) {
      const v = argv[++i];
      if (a === "--budget") {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) opts.budget = n;
      } else opts.out = v;
    } else if (a === "--append") opts.append = true;
    else if (!a.startsWith("--") && opts.transcript === null) opts.transcript = a;
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.transcript) {
    process.stderr.write("Usage: node restore-ledger.js <transcript.jsonl> [--append] [--budget TOKENS] [--out <file>]\n");
    process.exit(1);
  }
  const abs = path.resolve(opts.transcript);
  if (!fs.existsSync(abs)) {
    process.stderr.write(`Error: file not found: ${abs}\n`);
    process.exit(1);
  }
  const p = opts.append ? appendSegment(abs).paths : ledgerPaths(abs);
  const out = assemble(p, opts.budget);
  if (out.trim() === "") {
    process.stderr.write("restore-ledger.js: nothing to restore\n");
    process.exit(2);
  }
  if (opts.out) fs.writeFileSync(opts.out, out);
  else process.stdout.write(out);
}

if (require.main === module) main();

module.exports = { classify, readSegment, appendSegment, foldSegment, assemble, ledgerPaths, estimateTokens, DEFAULT_BUDGET };
