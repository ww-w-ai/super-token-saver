#!/usr/bin/env node
/**
 * List JSONL transcript sessions, filtering to "main" sessions only.
 * A main session has at least 1 genuine user message (not subtask/meta).
 *
 * Usage: node list-sessions.js <transcripts-dir> [--limit N] [--offset N] [--exclude SESSION_ID]
 *                                [--source claude|codex|all] [--cwd PATH]
 *                                [--current-source claude|codex]
 *
 * Default: latest 10 main sessions, sorted by mtime descending.
 *
 * Sources. `claude` reads ~/.claude/projects/{projectHash}/. `codex` reads
 * ~/.codex/sessions/ and hands each rollout to the normalizer first, so every
 * session below — whichever tool produced it — is analyzed by the SAME code.
 * Each result carries `source` plus, for Codex, `originalPath`.
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const codex = require("./lib/codex-transcript");

// Tags to strip before checking user message content.
// NOTE: <command-name> and <command-args> are intentionally NOT stripped —
// slash-command invocations without extra text (e.g. /continue, /clear) would
// otherwise collapse to empty strings and get filtered out as "not genuine",
// which broke current-session detection when the newest JSONL held only a
// /continue call. Keeping the raw tags preserves intent with minimal noise.
const STRIP_PATTERNS = [
  /<system-reminder>[\s\S]*?<\/system-reminder>/g,
  /<task-notification>[\s\S]*?<\/task-notification>/g,
  /<command-message>[\s\S]*?<\/command-message>/g,
  /<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g,
  /<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g,
  // Codex injects this to drive a goal forward. Like CC's <task-notification>,
  // the user never typed it — a turn that is only this strips to empty and so
  // is not counted as genuine, while preprocess still keeps the content.
  /<codex_internal_context[\s\S]*?<\/codex_internal_context>/g,
];

// Subtask message prefixes to exclude
const SUBTASK_PREFIXES = [
  "Read the preprocessed transcript",
  "Read the file /tmp/preprocessed",
  "Read the file /tmp/continue-",
  "CRITICAL: Respond with TEXT ONLY",
  "Write the word",
  // Spawned by the built-in /security-review and /code-review commands, which
  // run as separate headless sessions with their own JSONL. The user never
  // typed these — they're programmatic review prompts, not genuine turns.
  "Review this change for security vulnerabilities",
  "Review the following code changes",
  "You are reviewing a pull request",
];

function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}

function stripTags(text) {
  let cleaned = text;
  for (const pat of STRIP_PATTERNS) {
    cleaned = cleaned.replace(pat, "");
  }
  return cleaned.trim();
}

function isGenuineUserMessage(text) {
  if (text.length === 0) return false;
  for (const prefix of SUBTASK_PREFIXES) {
    if (text.startsWith(prefix)) return false;
  }
  if (text.startsWith("[User ")) return false;
  // ESC-interrupt markers injected by CC as user messages — the user never
  // typed these. Covers both "[Request interrupted by user]" and
  // "[Request interrupted by user for tool use]". Left unfiltered, they leak
  // into firstMsg/lastMsg and mask the real last typed message.
  if (text.startsWith("[Request interrupted by user")) return false;
  return true;
}

function detectContextLoss(jsonlPath) {
  const content = fs.readFileSync(jsonlPath, "utf8");
  const events = { compactManual: false, compactAuto: false };
  const eventLines = []; // track all context-loss event line numbers

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const lineNum = i + 1; // 1-based line number
    try {
      const msg = JSON.parse(line);
      let isEvent = false;
      // auto-compact: isCompactSummary flag on user message
      if (msg.message?.isCompactSummary === true) {
        events.compactAuto = true;
        isEvent = true;
      }
      // compact_boundary system event (more reliable)
      if (msg.type === "system" && msg.subtype === "compact_boundary") {
        if (msg.compactMetadata?.trigger === "auto") events.compactAuto = true;
        if (msg.compactMetadata?.trigger === "manual") events.compactManual = true;
        isEvent = true;
      }
      // /compact manual command (via <command-name> tag in transcript).
      // Strip <task-notification> blocks first — subagent results may contain
      // command tags as discussion topics, not actual command invocations.
      // NOTE: /clear is NOT detected here — it creates a new JSONL and appears
      // at line 3 of the new session, so there's no content before it to restore.
      if (msg.type === "user" && typeof msg.message?.content === "string") {
        const stripped = msg.message.content.replace(/<task-notification>[\s\S]*?<\/task-notification>/g, "");
        if (/<command-name>\/compact<\/command-name>/.test(stripped)) {
          events.compactManual = true;
          isEvent = true;
        }
      }
      if (isEvent) eventLines.push(lineNum);
    } catch (e) {}
  }

  return {
    hasContextLoss: events.compactManual || events.compactAuto,
    events,
    eventLines,
    lastContextLossLine: eventLines.length > 0 ? eventLines[eventLines.length - 1] : null,
  };
}

function formatLocalTime(date) {
  const now = new Date();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return `today ${hh}:${mm}`;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()} ${hh}:${mm}`;
}

// Bare slash commands to skip in firstMsg/lastMsg display.
// Matches both "/clear" and plugin-namespaced "/plugin:clear".
const DISPLAY_SKIP_COMMANDS = ["clear", "exit", "compact", "continue"];

function isBareCommand(text) {
  const stripped = text
    .replace(/<command-name>([\s\S]*?)<\/command-name>/g, "$1")
    .replace(/<command-args>[\s\S]*?<\/command-args>/g, "")
    .trim();
  // Extract the final segment after any ":" or "/" prefix
  const cmd = stripped.replace(/^\//, "").split(":").pop();
  return DISPLAY_SKIP_COMMANDS.includes(cmd);
}

// Clean command tags for display (firstMsg/lastMsg only)
function cleanForDisplay(text) {
  return text
    .replace(/<command-name>([\s\S]*?)<\/command-name>/g, "$1")
    .replace(/<command-args>[\s\S]*?<\/command-args>/g, "")
    .trim();
}

function truncateMsg(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

async function analyzeSession(filePath) {
  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const genuineMessages = [];
  let firstActiveTimestamp = null;
  let lastUserTimestamp = null;
  // Non-interactive `claude -p` runs stamp every row with entrypoint
  // "sdk-cli"; a human-opened session stamps "cli". Captured from the FIRST
  // row that carries the field at all (it rides on "attachment" rows, not
  // "user" rows, so this must run before the user-type filter below).
  let entrypoint = null;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (entrypoint === null && typeof obj.entrypoint === "string") {
      entrypoint = obj.entrypoint;
    }

    if (obj.type !== "user") continue;

    const content = obj.message?.content ?? obj.content;
    const raw = extractText(content);

    if (obj.timestamp) {
      lastUserTimestamp = obj.timestamp;
    }

    if (obj.isMeta === true) continue;

    const stripped = stripTags(raw);

    if (isGenuineUserMessage(stripped)) {
      if (firstActiveTimestamp === null && obj.timestamp) {
        firstActiveTimestamp = obj.timestamp;
      }
      genuineMessages.push(stripped);
    }
  }

  return {
    genuineMessages,
    firstActiveTimestamp,
    lastUserTimestamp,
    nonInteractive: entrypoint === "sdk-cli",
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let dir = null;
  let limit = 10;
  let offset = 0;
  let exclude = null;
  let all = false;
  let source = "claude";
  let cwd = process.cwd();
  let currentSource = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && i + 1 < args.length) {
      limit = parseInt(args[i + 1], 10) || 10;
      i++;
    } else if (args[i] === "--offset" && i + 1 < args.length) {
      offset = parseInt(args[i + 1], 10) || 0;
      i++;
    } else if (args[i] === "--exclude" && i + 1 < args.length) {
      exclude = args[i + 1];
      i++;
    } else if (args[i] === "--source" && i + 1 < args.length) {
      source = args[i + 1];
      i++;
    } else if (args[i] === "--cwd" && i + 1 < args.length) {
      cwd = args[i + 1];
      i++;
    } else if (args[i] === "--current-source" && i + 1 < args.length) {
      currentSource = args[i + 1];
      i++;
    } else if (args[i] === "--all") {
      all = true;
    } else if (!args[i].startsWith("--")) {
      dir = args[i];
    }
  }

  return { dir, limit, offset, exclude, all, source, cwd, currentSource };
}

async function main() {
  const { dir, limit, offset, exclude, all, source, cwd, currentSource } = parseArgs(process.argv);

  const wantClaude = source === "claude" || source === "all";
  const wantCodex = source === "codex" || source === "all";

  if (wantClaude && !dir) {
    process.stderr.write(
      "Usage: node list-sessions.js <transcripts-dir> [--limit N] [--offset N] [--exclude SESSION_ID] [--all] [--source claude|codex|all] [--cwd PATH]\n",
    );
    process.exit(1);
  }

  const entries = [];

  if (wantClaude && fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".jsonl")) continue;
      const fullPath = path.join(dir, f);
      const stat = fs.statSync(fullPath);
      entries.push({ name: f, path: fullPath, mtime: stat.mtime, size: stat.size, source: "claude" });
    }
  } else if (wantClaude && !fs.existsSync(dir)) {
    if (!wantCodex) {
      process.stderr.write(`Error: directory not found: ${dir}\n`);
      process.exit(1);
    }
  }

  if (wantCodex) {
    for (const session of codex.listCodexSessions(cwd)) {
      let normalized;
      try {
        normalized = codex.normalizeCodexTranscript(session.path, session);
      } catch (err) {
        const reason = err && err.message ? err.message : String(err);
        throw new Error(`failed to normalize Codex session ${session.sessionId}: ${reason}`);
      }
      entries.push({
        name: `${session.sessionId}.jsonl`,
        path: normalized,
        // Report the ORIGINAL's mtime and size. The normalized copy is an
        // artifact of this tool; the user is choosing between real sessions.
        mtime: session.mtime,
        size: session.size,
        source: "codex",
        originalPath: session.path,
        startedIso: session.started,
        // `codex exec` / SDK runs stamp session_meta.payload.source === "exec",
        // the same non-interactive signal `entrypoint: "sdk-cli"` is for
        // Claude Code — see codex-transcript.js readSessionMeta().
        nonInteractive: session.nonInteractive === true,
      });
    }
  }

  entries.sort((a, b) => b.mtime - a.mtime);

  // Collect all main sessions first
  const mainSessions = [];

  for (const entry of entries) {
    const id = path.basename(entry.name, ".jsonl");

    // Filter out excluded session
    if (exclude && id === exclude) continue;

    const {
      genuineMessages,
      firstActiveTimestamp,
      lastUserTimestamp,
      nonInteractive: claudeNonInteractive,
    } = await analyzeSession(entry.path);
    const isMain = genuineMessages.length >= 1;
    // Claude: from the JSONL's own entrypoint field. Codex: from session_meta,
    // already resolved onto the entry when it was pushed above.
    const nonInteractive = entry.source === "codex" ? entry.nonInteractive === true : claudeNonInteractive;

    if (!all && !isMain) continue;

    let firstActive = null;
    if (firstActiveTimestamp) {
      firstActive = formatLocalTime(new Date(firstActiveTimestamp));
    }

    const { hasContextLoss, events: contextLossEvents, eventLines, lastContextLossLine } =
      detectContextLoss(entry.path);

    const now = Date.now();
    const lastMsgAgeSeconds = lastUserTimestamp
      ? Math.max(0, Math.floor((now - new Date(lastUserTimestamp).getTime()) / 1000))
      : null;

    mainSessions.push({
      id,
      source: entry.source,
      path: entry.path,
      ...(entry.originalPath ? { originalPath: entry.originalPath } : {}),
      firstActive,
      lastActive: formatLocalTime(entry.mtime),
      size: entry.size,
      firstMsg: truncateMsg(cleanForDisplay(genuineMessages.find((m) => !isBareCommand(m)) || genuineMessages[0] || ""), 100),
      lastMsg: truncateMsg(cleanForDisplay([...genuineMessages].reverse().find((m) => !isBareCommand(m)) || genuineMessages[genuineMessages.length - 1] || ""), 100),
      userMsgCount: genuineMessages.length,
      isMain,
      nonInteractive,
      hasContextLoss,
      contextLossEvents,
      lastContextLossLine,
      eventLines,
      lastMsgTimestamp: lastUserTimestamp,
      lastMsgAgeSeconds,
    });
  }

  // Current session = most recently active (smallest lastMsgAgeSeconds).
  // This works because STRIP_PATTERNS now preserves <command-name> tags,
  // so a freshly-started session containing only a /continue invocation
  // still counts as genuine and appears in mainSessions.
  //
  // With both tools listed, "most recent overall" is the wrong test: the
  // session being written right now belongs to the tool this skill is running
  // in, and the other tool's transcript can easily be newer. --current-source
  // names that tool, so the running session is identified rather than guessed.
  const currentPool = currentSource
    ? mainSessions.filter((s) => s.source === currentSource)
    : mainSessions;
  let currentId = null;
  let minAge = Infinity;
  for (const s of currentPool) {
    if (s.lastMsgAgeSeconds != null && s.lastMsgAgeSeconds < minAge) {
      minAge = s.lastMsgAgeSeconds;
      currentId = s.id;
    }
  }
  for (const s of mainSessions) {
    s.isCurrent = s.id === currentId && (!currentSource || s.source === currentSource);
  }

  // Exclude non-interactive (`claude -p` / `codex exec`) runs — an AI-launched
  // one-shot session, not one a human opened. isCurrent is computed above and
  // checked first so the running session is never excluded, even if it is
  // itself non-interactive.
  const visible = mainSessions.filter((s) => s.isCurrent || !s.nonInteractive);

  // Apply offset, then limit
  const results = visible.slice(offset, offset + limit);

  process.stdout.write(JSON.stringify(results, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
