#!/usr/bin/env node
/**
 * restore.js — turn one transcript into the restore text the /s-continue skill reads.
 *
 * This is the user-invoked path: the caller asked to restore, so every turn is rendered. The
 * slicing used to live as an inline Python block inside SKILL.md; it lives here so the skill
 * calls code instead of copying it — a copy is how an earlier hook derived a cache path nothing
 * wrote and died quietly for months. The unattended after-compact restore is a different path
 * with different needs (verbatim, ledger-backed) and lives in restore-ledger.js.
 *
 * No reply is ever dropped. During an autonomous run the assistant answers dozens of times under
 * one user turn — measured, 60 replies under a single message came to 27 KB on their own — so the
 * replies at each end of a turn are kept at full stored width and the middle is shortened to 50
 * characters. The `-> N AI responses at lines X-Y` pointer above each turn locates the originals
 * in the transcript.
 *
 * Usage:
 *   node restore.js <transcript.jsonl> [--before-boundary] [--original <rollout>] [--out <file>]
 *
 * --before-boundary cuts everything from the last compaction onward: the turns after the boundary
 * are still in the model's context, the turns before it are the ones that were dropped. Without it
 * the whole session is rendered. A `--level N` argument from older invocations is accepted and
 * ignored.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { deriveCachePath } = require("./preprocess.js");
const codex = require("./lib/codex-transcript.js");

/** Replies kept at full width at each end of one user turn. */
const EDGE = 24;
/** Width a reply in the middle of a turn is shortened to. */
const MID = 50;

/**
 * A compaction boundary as preprocess.js writes it: a System turn whose whole
 * body is the marker. Both spellings appear — auto-compact fires on its own, a
 * person types /compact.
 *
 * It is anchored to the header line and to the System role on purpose. Matching
 * the marker anywhere in a block finds every turn that merely TALKS about
 * compaction, and a session about this feature is full of them — measured, the
 * unanchored form picked a user message as the last boundary and cut away
 * nothing.
 */
const BOUNDARY = /^\[Session:[^\]]*\][^ ]* System: "\[(auto|manual)-compact boundary\]"\s*$/;

const REPLY = /^(\d+)\. "/;
const HEADER = "[Session:";

/** One block is a header line plus everything under it until the next header. */
function splitBlocks(text) {
  const blocks = [];
  let cur = [];
  for (const line of text.split("\n")) {
    if (line.startsWith(HEADER) && cur.length > 0) {
      blocks.push(cur.join("\n"));
      cur = [];
    }
    cur.push(line);
  }
  if (cur.length > 0) blocks.push(cur.join("\n"));
  return blocks;
}

function firstLine(block) {
  const i = block.indexOf("\n");
  return i === -1 ? block : block.slice(0, i);
}

function isUser(block) {
  return block.length > 0 && firstLine(block).includes('User: "');
}

/**
 * The number and the readable body of one reply line, with the preprocessor's
 * own truncation marker and trailing bracketed annotations removed — those are
 * bookkeeping, not something a reader needs inside a shortened line.
 */
function bodyOf(line) {
  const m = line.match(/^(\d+)\. "(.*)$/);
  if (!m) return null;
  let rest = m[2].split("[...truncated...]")[0];
  rest = rest.replace(/(\s*\[[^\]]*\])+\s*$/, "").trimEnd().replace(/"$/, "");
  return { num: m[1], body: rest.trim() };
}

/**
 * Everything before the last compaction boundary.
 *
 * The LAST one, not the first: a long session compacts repeatedly, and only the
 * most recent boundary separates "gone from context" from "still in context".
 */
function beforeLastBoundary(blocks) {
  let lastBoundary = -1;
  for (let i = 0; i < blocks.length; i++) {
    if (BOUNDARY.test(firstLine(blocks[i]))) lastBoundary = i;
  }
  return lastBoundary === -1 ? blocks : blocks.slice(0, lastBoundary);
}

/**
 * One block, rendered: the header line as stored, the replies at each end of the turn as stored,
 * the replies in the middle shortened. Without the middle cut a single user turn is unbounded.
 */
function renderBlock(block) {
  const out = [];
  const lines = block.split("\n");
  out.push(lines[0]);

  const replies = [];
  let pointer = null;
  const others = [];
  for (const line of lines.slice(1)) {
    if (REPLY.test(line)) replies.push(line);
    else if (line.startsWith("->")) pointer = line;
    // The trailing "# Session references:" footer lands here. On a Codex
    // session it names the original rollout — the only line saying which file
    // an L{n} marker addresses — so it is never dropped.
    else if (line.trim() !== "") others.push(line);
  }

  if (pointer) out.push(pointer);
  replies.forEach((line, i) => {
    if (i < EDGE || i >= replies.length - EDGE) {
      out.push(line);
      return;
    }
    const parsed = bodyOf(line);
    if (!parsed) {
      out.push(line);
      return;
    }
    out.push(`${parsed.num}. "${parsed.body.slice(0, MID)}"`);
  });

  return out.concat(others).join("\n");
}

/** The restore text for one already-preprocessed compact file. */
function render(text, { beforeBoundary } = {}) {
  let blocks = splitBlocks(text);
  if (beforeBoundary) blocks = beforeLastBoundary(blocks);

  // Anything before the first header is the "# compact-format:" preamble, not
  // a turn. It is kept as is.
  let preamble = "";
  if (blocks.length > 0 && !isUser(blocks[0]) && !blocks[0].startsWith(HEADER)) {
    preamble = blocks.shift();
  }

  const rendered = blocks.map(renderBlock);
  const head = preamble.trim() === "" ? "" : preamble.replace(/\n+$/, "") + "\n";
  return head + rendered.join("\n") + "\n";
}

/**
 * The file to parse, and the file its L{n} markers address.
 *
 * A Codex rollout is not in the shape the preprocessor reads, so it is
 * normalized to a copy first — but the line numbers stay the ORIGINAL's,
 * because that is the file a reader opens. `readSessionMeta` returning null is
 * the test for "this is not a Codex rollout": it parses the first line and
 * looks for a session_meta row, so it cannot mistake a Claude Code transcript
 * for one.
 */
function resolveSource(transcriptPath) {
  let meta = null;
  try {
    meta = codex.readSessionMeta(transcriptPath);
  } catch {
    meta = null;
  }
  if (!meta) return { parsePath: transcriptPath, originalPath: null };
  return {
    parsePath: codex.normalizeCodexTranscript(transcriptPath, meta),
    originalPath: transcriptPath,
  };
}

/** Refresh the compact cache for this transcript, and return its path. */
function ensureCache(transcriptPath, originalOverride) {
  const { parsePath, originalPath } = resolveSource(transcriptPath);
  const original = originalOverride || originalPath;

  const args = [path.join(__dirname, "preprocess.js"), parsePath];
  if (original) args.push("--original", original);
  const run = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (run.status !== 0) {
    throw new Error(`preprocess failed: ${(run.stderr || "").trim() || `exit ${run.status}`}`);
  }
  return deriveCachePath(path.resolve(parsePath)).cachePath;
}

/** Flags that take a value, so the value is never mistaken for the transcript. */
const VALUED = new Set(["--level", "--original", "--out"]);

function parseArgs(argv) {
  const opts = { transcript: null, beforeBoundary: false, original: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (VALUED.has(arg)) {
      const value = argv[++i]; // --level's value is consumed here and ignored
      if (arg === "--original") opts.original = value;
      else if (arg === "--out") opts.out = value;
    } else if (arg === "--before-boundary") {
      opts.beforeBoundary = true;
    } else if (!arg.startsWith("--") && opts.transcript === null) {
      opts.transcript = arg;
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.transcript) {
    process.stderr.write(
      "Usage: node restore.js <transcript.jsonl> [--before-boundary] [--original <path>] [--out <file>]\n",
    );
    process.exit(1);
  }
  const abs = path.resolve(opts.transcript);
  if (!fs.existsSync(abs)) {
    process.stderr.write(`Error: file not found: ${abs}\n`);
    process.exit(1);
  }

  const cachePath = ensureCache(abs, opts.original);
  const text = fs.readFileSync(cachePath, "utf8");
  const out = render(text, { beforeBoundary: opts.beforeBoundary });

  // An empty render is a failure, not a result. A caller that prints it would
  // announce a restore that carried nothing.
  if (out.trim() === "") {
    process.stderr.write("restore.js: nothing to restore (no turns before the boundary)\n");
    process.exit(2);
  }

  if (opts.out) fs.writeFileSync(opts.out, out);
  else process.stdout.write(out);
}

module.exports = { render, splitBlocks, beforeLastBoundary, bodyOf };

if (require.main === module) main();
