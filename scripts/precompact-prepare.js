#!/usr/bin/env node
/**
 * precompact-prepare.js — started detached by precompact-watch.js when the context first reaches
 * 95% of the auto-compact threshold. Forks the session from its transcript on disk and asks the
 * fork for the continuation summary — Claude Code: `claude -p --resume <sid> --fork-session`, which
 * reuses the session's prompt cache; Codex: `codex exec … fork <sid>` — then rewrites the marker:
 *
 *   { status: "ready", summary, lastSeen, coveredLine, ... }   or   { status: "failed", reason, ... }
 *
 * coveredLine is the transcript's line count when the fork started: the fork read the file as it
 * was then, so every line after it is newer than the summary.
 *
 * Usage: node precompact-prepare.js <sessionId> <transcriptPath> <cwd> <markerPath> [claude|codex]
 * Runs with SUPER_COMPACT_FORK=1 (set by the watcher) so the fork's own hooks never arm again.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const FORK_TIMEOUT_MS = 10 * 60_000;
const LAST_SEEN = "LAST SEEN:";

/**
 * The summary instruction, shared with hooks/super-compact.ts, which sends the same text when no
 * prepared summary is ready at compaction. It asks for sections A and B and ends with the LAST SEEN
 * line splitReply() reads.
 */
const SUMMARY_PROMPT = fs.readFileSync(path.join(__dirname, "super-compact-prompt.txt"), "utf8").trimEnd();

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
  const [sid, transcript, cwd, marker, host] = process.argv.slice(2);
  if (!sid || !transcript || !marker) process.exit(1);
  let armed = {};
  try { armed = JSON.parse(fs.readFileSync(marker, "utf8")); } catch { /* rewritten below */ }
  // The pid lets a compaction waiting on this marker stop at once when this process is gone. Only
  // this process writes the marker while it runs, so no "ready" can be overwritten here.
  armed = { ...armed, pid: process.pid };
  writeMarker(marker, armed);

  const startedAt = Date.now();
  const coveredLine = countLines(transcript);
  const fork = host === "codex" ? forkCodex(sid, cwd, marker) : forkClaude(sid, cwd);
  const base = { ...armed, host: host || "claude", coveredLine, startedAt, durationMs: Date.now() - startedAt };
  const reply = fork.text !== undefined ? splitReply(fork.text) : undefined;
  if (!reply) {
    const reason = fork.reason || (fork.text !== undefined ? `no ${LAST_SEEN} line in the reply` : "no reply");
    writeMarker(marker, { ...base, status: "failed", reason: String(reason).slice(0, 500), ...(fork.retry === false && { retry: false }) });
    return;
  }
  writeMarker(marker, { ...base, status: "ready", summary: reply.summary, lastSeen: reply.lastSeen, ...fork.extra });
}

const spawnOptions = (cwd) => ({ cwd, env: process.env, encoding: "utf8", timeout: FORK_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });

/**
 * The fork's own settings. verbose turns `--output-format json` into an array of events. Hooks
 * fire in the fork as in the session; measured, a SessionStart injection there cut the cache read
 * from 92K to 40.8K tokens.
 */
const FORK_SETTINGS = JSON.stringify({ verbose: false, disableAllHooks: true });

/** The result event of `claude -p --output-format json`: one object, or the last "result" of a verbose array. */
function resultEvent(out) {
  if (!Array.isArray(out)) return out;
  return out.filter((e) => e && e.type === "result").pop();
}

/** Claude Code: one tool-less turn on a fork of the session, which reuses its prompt cache. */
function forkClaude(sid, cwd) {
  const run = spawnSync(
    process.env.SUPER_COMPACT_CLAUDE || "claude",
    ["-p", SUMMARY_PROMPT, "--resume", sid, "--fork-session", "--output-format", "json", "--max-turns", "1", "--settings", FORK_SETTINGS],
    spawnOptions(cwd),
  );
  let parsed;
  try { parsed = JSON.parse(run.stdout); } catch { /* reported below */ }
  const out = resultEvent(parsed);
  // A parsed reply with no result object fails the same way on every retry, and each retry is a
  // full-context fork.
  if (parsed && (!out || typeof out !== "object")) return { reason: `exit ${run.status}: unexpected output shape`, retry: false };
  if (!out || out.is_error) {
    // Measured: a fork that exited 1 left stderr empty, so the reason said only "exit 1". stdout is
    // where `claude -p` puts its own error text, so its tail goes in too.
    const detail = run.error?.message || out?.result || (run.stderr || "").trim().slice(-500) || (run.stdout || "").trim().slice(-500);
    return { reason: `exit ${run.status}${detail ? `: ${detail}` : ""}` };
  }
  return {
    text: out.result,
    extra: {
      forkSessionId: out.session_id,
      costUsd: out.total_cost_usd,
      cacheReadTokens: out.usage?.cache_read_input_tokens,
      cacheWriteTokens: out.usage?.cache_creation_input_tokens,
    },
  };
}

/**
 * Codex: `codex exec fork` in a read-only sandbox. Exec options go before `fork` (after it they are
 * refused); --ephemeral keeps the fork out of the session list; -o writes the last reply to a file.
 */
function forkCodex(sid, cwd, marker) {
  const lastMessage = `${marker}.codex-reply-${process.pid}.txt`;
  const run = spawnSync(
    process.env.SUPER_COMPACT_CODEX || "codex",
    ["exec", "--ephemeral", "-s", "read-only", "--skip-git-repo-check", "--json", "-o", lastMessage, "fork", sid, SUMMARY_PROMPT],
    { ...spawnOptions(cwd), input: "" },
  );
  let text;
  try { text = fs.readFileSync(lastMessage, "utf8"); } catch { /* reported below */ }
  fs.rmSync(lastMessage, { force: true });
  const usage = codexUsage(run.stdout);
  if (text === undefined || run.status !== 0) {
    return { reason: run.error?.message || (run.stderr || "").slice(-500) || `exit ${run.status}` };
  }
  return { text, extra: { cacheReadTokens: usage?.cached_input_tokens, inputTokens: usage?.input_tokens } };
}

/** The usage of the fork's turn.completed event in `codex exec --json` output. */
function codexUsage(stdout) {
  for (const line of String(stdout ?? "").split("\n").reverse()) {
    try {
      const ev = JSON.parse(line);
      if (ev.type === "turn.completed") return ev.usage;
    } catch { /* not an event line */ }
  }
  return undefined;
}

if (require.main === module) main();

module.exports = { splitReply, countLines, codexUsage, SUMMARY_PROMPT };
