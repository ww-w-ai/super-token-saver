#!/usr/bin/env node
/**
 * precompact-prepare.js — started detached by precompact-watch.js when the context first reaches
 * 95% of the auto-compact threshold. Forks the session from its transcript on disk
 * (`claude -p --resume <sid> --fork-session`, which reuses the session's prompt cache) and asks the
 * fork for the continuation summary, then rewrites the marker:
 *
 *   { status: "ready", summary, lastSeen, coveredLine, ... }   or   { status: "failed", reason, ... }
 *
 * coveredLine is the transcript's line count when the fork started: the fork read the file as it
 * was then, so every line after it is newer than the summary.
 *
 * Usage: node precompact-prepare.js <sessionId> <transcriptPath> <cwd> <markerPath>
 * Runs with SUPER_COMPACT_FORK=1 (set by the watcher) so the fork's own hooks never arm again.
 */

const fs = require("fs");
const { spawnSync } = require("child_process");

const FORK_TIMEOUT_MS = 10 * 60_000;
const SUMMARY_TOKEN_TARGET = 10_000;
const LAST_SEEN = "LAST SEEN:";
const LAST_SEEN_CHARS = 80;
const CONTINUATION_HEAD = "This session is being continued from a previous conversation that ran out of context.";

const SUMMARY_PROMPT = `Stop the current work for one reply. Do not call any tool. Write a continuation summary of this whole conversation for your future self, who will lose the raw transcript.

Output exactly two sections:

## A. Before the last compaction
Everything before the most recent message that begins "${CONTINUATION_HEAD}" (if any), together with that message itself: carry it forward compressed. Goals, decisions, standing user directives, finished and unfinished work.

## B. Since the last compaction
Your future self will ALSO receive every user message of this span (long ones cut to their first 300 and last 200 characters), every assistant reply (cut to first 100 and last 100 characters), and every message after the last one you can see, verbatim. The abbreviated dialogue leaves OUT teammate reports and subagent completion notices entirely — this section is the only place they survive. So do not restate ordinary dialogue; capture what that abbreviated dialogue loses:
- Machine messages, one list item each: every teammate report (<teammate-message>) and every subagent completion notice (<task-notification>) in this span. For each, write who/what it came from, what it was asked to do, and its concrete result verbatim — numbers, file paths, verdict, and what it could not do. These are delegated-work results; do not compress them away. (Ignore idle/waiting notifications.)
- details from the middle of long messages
- important tool results: file paths, commands, numbers, measurements, errors, findings
- the reasons behind user directives and corrections
- what was tried and abandoned, and why
- work in flight: the exact state, which step it reached and what the next step was (give the step numbers), and any pending decisions

Write content in the language the user writes in. Keep identifiers, paths and numbers verbatim. Stay under ${SUMMARY_TOKEN_TARGET} tokens.

End your reply with exactly one line, the last line, in this form:
${LAST_SEEN} <the first ${LAST_SEEN_CHARS} characters of the last message you can see before this request, copied exactly>`;

function countLines(file) {
  const fd = fs.openSync(file, "r");
  const buf = Buffer.alloc(1 << 20);
  let lines = 0;
  try {
    for (let n; (n = fs.readSync(fd, buf, 0, buf.length, null)) > 0;) {
      for (let i = 0; i < n; i++) if (buf[i] === 10) lines++;
    }
  } finally {
    fs.closeSync(fd);
  }
  return lines;
}

/** Splits the fork's reply into the summary and its LAST SEEN line; undefined when the line is missing. */
function splitReply(text) {
  const lines = String(text ?? "").trimEnd().split("\n");
  const last = lines.pop() ?? "";
  if (!last.startsWith(LAST_SEEN)) return undefined;
  return { summary: lines.join("\n").trim(), lastSeen: last.slice(LAST_SEEN.length).trim() };
}

function writeMarker(marker, body) {
  const tmp = `${marker}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(body, null, 2));
  fs.renameSync(tmp, marker);
}

function main() {
  const [sid, transcript, cwd, marker] = process.argv.slice(2);
  if (!sid || !transcript || !marker) process.exit(1);
  let armed = {};
  try { armed = JSON.parse(fs.readFileSync(marker, "utf8")); } catch { /* rewritten below */ }

  const startedAt = Date.now();
  const coveredLine = countLines(transcript);
  const run = spawnSync(
    process.env.SUPER_COMPACT_CLAUDE || "claude",
    ["-p", SUMMARY_PROMPT, "--resume", sid, "--fork-session", "--output-format", "json", "--max-turns", "1"],
    { cwd, env: process.env, encoding: "utf8", timeout: FORK_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 },
  );
  const base = { ...armed, coveredLine, startedAt, durationMs: Date.now() - startedAt };

  let out;
  try { out = JSON.parse(run.stdout); } catch { /* reported below */ }
  const reply = out && !out.is_error ? splitReply(out.result) : undefined;
  if (!reply) {
    const reason = run.error?.message || out?.result || (run.stderr || "").slice(-500) || `exit ${run.status}`;
    writeMarker(marker, { ...base, status: "failed", reason: String(reason).slice(0, 500) });
    return;
  }
  writeMarker(marker, {
    ...base,
    status: "ready",
    summary: reply.summary,
    lastSeen: reply.lastSeen,
    forkSessionId: out.session_id,
    costUsd: out.total_cost_usd,
    cacheReadTokens: out.usage?.cache_read_input_tokens,
    cacheWriteTokens: out.usage?.cache_creation_input_tokens,
  });
}

if (require.main === module) main();

module.exports = { splitReply, countLines, SUMMARY_PROMPT };
