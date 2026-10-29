#!/usr/bin/env node
/**
 * precompact-wait.js — waits until a prepared-summary marker leaves the "running" state.
 *
 * Two callers, one rule:
 *   - hooks/super-compact.ts (Claude Code with the mod) runs it through $.process.run when
 *     compaction arrives while precompact-prepare.js is still writing the summary. A hook's own
 *     budget is 10 s and a $.clock wait spends it; a process the hook waits on does not.
 *   - the PreCompact hook (`--hook`), on Claude Code without the mod and on Codex, where nothing
 *     else can hold compaction back. It reads the session id from the hook's stdin.
 *
 * The wait ends at the first of: the marker leaves "running"; its process is gone (the preparer
 * writes its pid when it starts, so a marker still "running" without a process will never finish);
 * WAIT_CAP_MS, about twice the 90-180 s a preparation normally takes; or the fork's own timeout
 * (FORK_TIMEOUT_MS in precompact-prepare.js) since the marker was armed, plus a margin for writing
 * the file. Abandoning a running preparation means a fresh summary request at full price instead.
 *
 * Usage: node precompact-wait.js <markerPath>      prints "ready", "failed", "dead", "running"
 *                                                  (timed out), "absent", "consumed"
 *        node precompact-wait.js --hook             PreCompact hook; prints nothing
 * Always exits 0: a failed wait must never block compaction.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const POLL_MS = 1_000;
const WAIT_CAP_MS = 5 * 60_000;
const FORK_TIMEOUT_MS = 10 * 60_000;
const WRITE_MARGIN_MS = 15_000;

const markerFor = (home, sid) => path.join(home, ".claude", "super-token-saver-data", ".super-compact", `${sid}.prepared.json`);

function readMarker(marker) {
  try {
    return JSON.parse(fs.readFileSync(marker, "utf8"));
  } catch {
    return undefined;
  }
}

/** True while the process exists; EPERM means it exists under another user. */
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}

function state(marker) {
  const m = readMarker(marker);
  if (!m) return "absent";
  const status = m.status ?? "absent";
  if (status === "running" && Number.isInteger(m.pid) && !alive(m.pid)) return "dead";
  return status;
}

/** How long a running preparation armed at `armedAt` is worth waiting for, from `now`. */
function waitBudgetMs(armedAt, now) {
  const deadline = (armedAt ?? now) + FORK_TIMEOUT_MS + WRITE_MARGIN_MS;
  return Math.min(WAIT_CAP_MS, Math.max(0, deadline - now));
}

/** Resolves the final state once the marker stops running or the budget is spent. */
function waitFor(marker) {
  const budget = waitBudgetMs(readMarker(marker)?.armedAt, Date.now());
  const deadline = Date.now() + budget;
  return new Promise((resolve) => {
    const tick = () => {
      const s = state(marker);
      if (s !== "running" || Date.now() >= deadline) return resolve(s);
      setTimeout(tick, POLL_MS);
    };
    tick();
  });
}

function hookMarker() {
  let input = {};
  try { input = JSON.parse(fs.readFileSync(0, "utf8")); } catch { /* no input, nothing to wait for */ }
  if (input.agent_id || !input.session_id) return undefined;
  return markerFor(os.homedir(), input.session_id);
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--hook") {
    const marker = hookMarker();
    if (marker) await waitFor(marker);
    return;
  }
  const marker = args[0];
  process.stdout.write(`${marker ? await waitFor(marker) : "absent"}\n`);
}

if (require.main === module) main().catch(() => {});

module.exports = { state, waitBudgetMs, WAIT_CAP_MS };
