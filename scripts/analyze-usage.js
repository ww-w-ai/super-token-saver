#!/usr/bin/env node
/**
 * Analyze transcript JSONL files for token usage and cost data.
 * Outputs JSON to stdout. Caches results per session in project/session hierarchy.
 *
 * Usage: node analyze-usage.js [options]
 *   --days N            Only analyze last N days (default: ~1 month; 0 = all)
 *   --project <name>    Analyze single project by name (hashed CWD, e.g. -Users-foo-myproject).
 *                       Scans only ~/.claude/projects/{name}/ for transcripts.
 *                       Default: all projects.
 *   --force             Force re-analyze, ignore cached results
 *
 * Cache structure: ~/.claude/super-token-saver-data/{projectName}/{sessionId}/
 *   summary.json   — session metadata (tokens, cost, timestamps)
 *   timeline.csv   — per-API-call timeline
 *   subagents/{agentId}/summary.json, timeline.csv — agent sessions
 *
 * Timeline CSV columns (v14): ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt,line,req
 *   win:     5h window start (sparse, simple hourFloor+5h per session)
 *   rl:      rate limit event (limit_hit_5h, limit_hit_weekly, limit_hit_opus, limit_hit_sonnet, limit_hit_extra, limit_hit_unknown) + reset info
 *   evt:     context/cost events, pipe-separated (startup, compact, cost_warn, ctx_danger, etc.)
 *   line:    1-based JSONL line number of this row's source message (v9+, for user-turn aggregation)
 *   markers: assistant-side marker string from analyze-usage side:
 *              cost markers  *  (≥ $0.50)  **  (≥ $1.00)
 *              ctx markers   #  (≥ 35%)    ##  (≥ 70%)  (first-crossing only)
 *              heuristic     ?  (large cache creation with < 1h gap, likely /continue or --resume)
 *              rate-limit    %% %5 %W %O %S %X  (on synthetic assistant rate-limit messages)
 *            Concatenated string, e.g. "**##?". Parsed order-agnostically in build-report.js.
 *
 * Marker ownership (v1.4.0+):
 *   compact.txt (preprocess.js) — user-side only: @ @@ + ++ ~ ! ^ ^^
 *   timeline.csv (this file)    — assistant-side: * ** # ## ? %5/%%/%W/%O/%S/%X
 *   build-report.js joins by JSONL line number and aggregates per user-turn.
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const os = require("os");

const {
  CACHE_BASE: CACHE_DIR,
  CODEX_BASE,
  forHost,
  extractProjectName,
  getSessionDir,
  getTimelinePath,
  getSummaryPath,
  getSubagentDir,
  getSubagentTimelinePath,
  getSubagentSummaryPath,
  migrateFromYYMM,
  projectNameFromCwd,
} = require("./lib/cache-paths");
const { MODEL_PRICING, DEFAULT_PRICING, calcCost, UnknownModelError } = require("./lib/pricing");
const { listCodexSessions, normalizeCodexTranscript } = require("./lib/codex-transcript");
const {
  createSessionUsageTracker,
  deltaToUsageRow,
  extractRateLimitSamples,
  mergeRateLimitSamples,
  selectLongestRateLimitLane,
} = require("./lib/codex-usage");
const { normalizeCodexPlan } = require("./lib/plan-info");

const PRICING_JSON_PATH = path.join(__dirname, "model-pricing.json");
const PRICING_SOURCE_URL = "https://platform.claude.com/docs/en/about-claude/pricing#model-pricing";

function emitUnknownModelError(models) {
  const list = Array.from(models).sort().join(", ");
  process.stderr.write(
    "ERROR:UNKNOWN_MODEL\n" +
    `models: ${list}\n` +
    `source: ${PRICING_SOURCE_URL}\n` +
    `file: ${PRICING_JSON_PATH}\n` +
    "action: fetch pricing -> edit file -> re-run the same command\n"
  );
}

function writeFileAtomic(filePath, content) {
  const tmp = filePath + ".tmp." + process.pid;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, filePath);
}
const CACHE_VERSION = 14; // v14: preprocess.js v6 self-managing cache format
const _subagentSep = /[/\\]subagents[/\\]/;
const PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects");

// v1.4.0: Per-row evt tags and structured rl column own all assistant-side
// event information. Short-form marker strings (*, **, #, ##, ?, %5) are no
// longer stored here; build-report.js maps evt/rl to display badges for HTML.

function parseArgs(argv) {
  const args = argv.slice(2);
  let days = -1; // -1 = 1 month (default)
  let project = null; // null = all projects
  let force = false;
  let host = "claude";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && i + 1 < args.length) {
      days = args[i + 1] === 'all' ? 0 : parseInt(args[i + 1], 10);
      if (isNaN(days)) days = -1;
      i++;
    } else if (args[i] === "--project" && i + 1 < args.length) {
      project = args[i + 1];
      i++;
    } else if (args[i] === "--force") {
      force = true;
    } else if (args[i] === "--host" && i + 1 < args.length) {
      host = args[i + 1];
      i++;
    }
  }

  return { days, project, force, host };
}

/**
 * Shared cutoff-date math for both hosts: explicit --days N, the default
 * "last ~1 month", or --days all (0 = no cutoff).
 */
function computeCutoff(opts) {
  if (opts.days > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - opts.days);
    return cutoff;
  }
  if (opts.days === -1) {
    // Default: 1 month ago from now (exact time)
    // Handle month boundary: 3/31 → setMonth(2) → JS makes 3/3, fix to 2/28
    const cutoff = new Date();
    const origDate = cutoff.getDate();
    cutoff.setMonth(cutoff.getMonth() - 1);
    if (cutoff.getDate() !== origDate) {
      cutoff.setDate(0); // day 0 = last day of previous month
    }
    return cutoff;
  }
  return new Date(0); // --days 0 = all
}

function findTranscriptDirs(opts) {
  if (opts.project) {
    // --project accepts a projectName (hashed CWD, e.g. -Users-foo-myproject)
    const dir = path.join(PROJECTS_DIR, opts.project);
    if (!fs.existsSync(dir)) {
      process.stderr.write(`Warning: transcripts dir not found: ${dir}\n`);
      return [];
    }
    return [dir];
  }
  // Default: all projects
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs
    .readdirSync(PROJECTS_DIR)
    .map((d) => path.join(PROJECTS_DIR, d))
    .filter((d) => {
      try {
        return fs.statSync(d).isDirectory();
      } catch {
        return false;
      }
    });
}

function listJsonlFiles(dirs, cutoffDate) {
  const files = [];

  function scanDir(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const f of entries) {
      const fullPath = path.join(dir, f);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (f.endsWith(".jsonl") && stat.mtime >= cutoffDate) {
          // Skip orphaned subagent transcripts (main session deleted)
          if (fullPath.match(_subagentSep)) {
            const parts = fullPath.split(_subagentSep);
            const mainJsonl = parts[0] + ".jsonl";
            if (!fs.existsSync(mainJsonl)) continue;
          }
          files.push({ path: fullPath, mtime: stat.mtime });
        }
      } catch {
        continue;
      }
    }
  }

  for (const dir of dirs) {
    scanDir(dir);
  }
  return files;
}

/**
 * Resolve cache paths for a transcript file.
 * Main sessions:  {projectName}/{sessionId}/summary.json, timeline.csv
 * Agent sessions:  {projectName}/{mainSessionId}/subagents/{agentId}/summary.json, timeline.csv
 *
 * @param {string} filePath - transcript .jsonl path
 * @returns {{ summaryPath: string, timelinePath: string, sessionDir: string, isAgent: boolean, agentId: string|null, mainSessionId: string|null, projectName: string }}
 */
function resolveSessionPaths(filePath) {
  const projectName = extractProjectName(filePath) || "_unknown";
  const basename = path.basename(filePath, ".jsonl");

  // Agent transcript: .../{mainSessionId}/subagents/agent-{agentId}.jsonl
  if (filePath.match(_subagentSep)) {
    const parts = filePath.split(_subagentSep);
    const mainSessionId = path.basename(parts[0]); // directory name = mainSessionId
    // basename is "agent-{agentId}" — strip "agent-" prefix
    const agentId = basename.startsWith("agent-") ? basename.slice(6) : basename;
    return {
      summaryPath: getSubagentSummaryPath(projectName, mainSessionId, agentId),
      timelinePath: getSubagentTimelinePath(projectName, mainSessionId, agentId),
      sessionDir: getSubagentDir(projectName, mainSessionId, agentId),
      isAgent: true,
      agentId,
      mainSessionId,
      projectName,
    };
  }

  // Main session transcript
  const sessionId = basename;
  return {
    summaryPath: getSummaryPath(projectName, sessionId),
    timelinePath: getTimelinePath(projectName, sessionId),
    sessionDir: getSessionDir(projectName, sessionId),
    isAgent: false,
    agentId: null,
    mainSessionId: null,
    projectName,
  };
}

function isCacheValid(cachePath, transcriptMtime) {
  try {
    const cacheStat = fs.statSync(cachePath);
    if (cacheStat.mtime < transcriptMtime) return false;
    // Check cache version
    const data = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    return data.cacheVersion === CACHE_VERSION;
  } catch {
    return false;
  }
}

function readCache(cachePath) {
  try {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  } catch {
    return null;
  }
}

function writeCache(summaryPath, timelinePath, data) {
  try {
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    fs.mkdirSync(path.dirname(timelinePath), { recursive: true });

    // Split: JSON metadata (without usageTimeline)
    const { usageTimeline, ...metadata } = data;
    metadata.cacheVersion = CACHE_VERSION;
    writeFileAtomic(summaryPath, JSON.stringify(metadata));

    // CSV timeline (v11: add req column for subagent cost dedup)
    const header = "ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt,line,req";
    const lines = [header];
    let prevModel = null;
    let prevWin = null;
    for (const e of usageTimeline) {
      const ts = Math.floor(new Date(e.ts).getTime() / 1000);
      const model = e.model !== prevModel ? (e.model || "") : "";
      const win = e.win != null && e.win !== prevWin ? e.win : "";
      const rl = e.rl || "";
      const evt = e.evt || "";
      const line = e.line != null ? e.line : "";
      const req = e.reqId || "";
      lines.push(`${ts},${model},${e.input},${e.cacheCreation},${e.cacheCreate5m},${e.cacheCreate1h},${e.cacheRead},${e.output},${e.cost},${win},${rl},${evt},${line},${req}`);
      if (e.model) prevModel = e.model;
      if (e.win != null) prevWin = e.win;
    }
    writeFileAtomic(timelinePath, lines.join("\n") + "\n");
  } catch (err) {
    process.stderr.write(`Warning: failed to write cache: ${err.message}\n`);
  }
}

async function analyzeSession(filePath) {
  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let firstTs = null;
  let lastTs = null;
  let firstUserMsg = null;
  let lastUserMsg = null;
  let skillSignature = null; // "Base directory for this skill:..." line for skill session detection
  const userMessageLog = []; // {ts, text} for window-level first/last msg
  let userMsgs = 0;
  let asstMsgs = 0;
  let input = 0;
  let cacheCreation = 0;
  let cacheCreate5m = 0;
  let cacheCreate1h = 0;
  let cacheRead = 0;
  let output = 0;
  let costUSD = 0;
  const usageTimeline = [];
  const rateLimitEvents = [];
  const contextEvents = [];

  // /continue detection state
  let continueStartTs = null;
  let continueReads = [];
  let inContinueSequence = false;

  function flushContinueEvent() {
    if (!inContinueSequence || continueReads.length === 0) return;
    const uniqueFiles = new Set(continueReads.map(r => r.filePath.replace(/\.aggressive\.txt$/, '.txt')));
    const restoredSessionIds = [...uniqueFiles].map(f => {
      const mNew = f.match(/\/([0-9a-f-]+)\/compact\.txt$/);
      const mOld = f.match(/compact-([0-9a-f-]+)\.txt$/);
      const m = mNew || mOld;
      return m ? m[1] : null;
    }).filter(Boolean);
    contextEvents.push({
      type: "continue",
      ts: continueStartTs,
      sessionCount: uniqueFiles.size,
      readCount: continueReads.length,
      lastReadTs: continueReads[continueReads.length - 1].ts,
      restoredSessionIds,
    });
    inContinueSequence = false;
    continueStartTs = null;
    continueReads = [];
  }

  // Rate limit message patterns (prefix matching)
  const RATE_LIMIT_PATTERNS = [
    { prefix: "You've hit your" },
    { prefix: "You've used" },
    { prefix: "You're now using extra usage" },
    { prefix: "You're close to your extra usage" },
    { prefix: "You're out of extra usage" },
  ];

  // Track per-requestId to deduplicate streaming chunks
  const requestUsage = new Map();

  // v9: 1-based JSONL line counter (increments on every line, skips or not)
  // Used by build-report.js to join user alerts (from compact.txt) with
  // assistant rows (from timeline.csv) by line proximity.
  let lineNum = 0;
  // Track last user message line so heuristic '?' can skip if session marker was set
  let lastUserLineNum = 0;
  let lastAssistantTs = 0;  // epoch seconds for heuristic_resume (<1h gap)
  // Track whether a session-marker-producing event happened after the last user message
  // (clear / compact / reload / model / startup). Used to suppress heuristic_resume.
  let sessionMarkPending = false;

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

    const ts =
      obj.timestamp || (obj.message && obj.message.timestamp) || null;
    if (ts) {
      if (!firstTs) firstTs = ts;
      lastTs = ts;
    }

    // Detect /compact events: system messages with subtype "compact_boundary"
    if (obj.type === "system" && obj.subtype === "compact_boundary") {
      const meta = obj.compactMetadata || {};
      contextEvents.push({
        type: "compact",
        ts,
        trigger: meta.trigger || "unknown",
        preTokens: meta.preTokens || 0,
        line: lineNum,
      });
      sessionMarkPending = true;  // suppress ? heuristic on the next assistant turn
    }

    // Detect /continue skill invocation in user meta messages
    if (obj.type === "user" && obj.isMeta) {
      const content = obj.message && obj.message.content;
      let text = "";
      if (typeof content === "string") text = content;
      else if (Array.isArray(content)) text = content.filter(b => b.type === "text" && b.text).map(b => b.text).join(" ");
      if (text.includes("super-token-saver:continue")) {
        inContinueSequence = true;
        continueStartTs = ts;
        continueReads = [];
        sessionMarkPending = true;  // /continue is a session transition
      }
    }

    if (obj.type === "user") {
      userMsgs++;
      // Detect cache-affecting slash commands (mirrors preprocess.js)
      const rawContent = obj.message && obj.message.content;
      let rawText = "";
      if (typeof rawContent === "string") rawText = rawContent;
      else if (Array.isArray(rawContent)) rawText = rawContent.filter(b => b.type === "text" && b.text).map(b => b.text).join(" ");
      // Session event detection — mirrors preprocess.js session marker detection.
      // Events are stored in contextEvents → timeline evt column.
      // Used by build-report for session detail rendering.
      const cmdMatch = rawText.match(/<command-name>\/([\w-]+)<\/command-name>/);
      if (cmdMatch) {
        const cmd = cmdMatch[1];
        let evtType = null;
        if (cmd === "clear") evtType = "clear";
        // Note: /resume is NOT detected — CC's resume command uses display:'skip'
        // and never writes the command-name tag to the transcript. The ? heuristic
        // in preprocess.js covers 1h-inside cache_creation cases instead.
        else if (cmd === "reload-plugins") evtType = "reload_plugins";
        else if (cmd === "model") evtType = "model_change";
        if (evtType) {
          contextEvents.push({ type: evtType, ts, line: lineNum });
          sessionMarkPending = true;  // suppress ? on next assistant turn
        }
      }
      // Track non-meta user line for ? heuristic scope.
      // A new user message (non-meta, non-tool-result) "starts" a new user turn.
      if (!obj.isMeta) {
        lastUserLineNum = lineNum;
      }
      // Extract first/last user message text
      if (!obj.isMeta) {
        const content = obj.message && obj.message.content;
        let text = '';
        if (typeof content === 'string') text = content;
        else if (Array.isArray(content)) text = content.filter(b => b.type === 'text' && b.text).map(b => b.text).join(' ');
        // Strip system tags
        text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
                   .replace(/<command-name>[\s\S]*?<\/command-name>/g, '')
                   .replace(/<command-message>[\s\S]*?<\/command-message>/g, '')
                   .replace(/<task-notification>[\s\S]*?<\/task-notification>/g, '')
                   .trim();
        // Capture skill signature for session type detection
        if (!skillSignature && text.startsWith('Base directory for this skill:')) {
          skillSignature = text.slice(0, 200);
        }
        // Skip non-genuine messages
        if (text.startsWith('<')) continue;          // any XML/HTML tag
        if (text.startsWith('{') && text.endsWith('}')) continue;  // pure JSON
        if (text.startsWith('/')) continue;           // slash commands
        if (text.startsWith('[User ')) continue;      // subtask prefixes
        if (text.startsWith('This session is being continued')) continue;  // /continue prompts
        if (text.startsWith('Read the preprocessed transcript')) continue;
        if (text.startsWith('CRITICAL:')) continue;   // system prompts
        if (text.startsWith('Write the word')) continue;
        if (text.startsWith('Base directory for this skill:')) continue;  // skill content injection
        if (text.length > 0) {
          if (!firstUserMsg) firstUserMsg = text.slice(0, 80);
          lastUserMsg = text.slice(0, 80);
          userMessageLog.push({ ts, text: text.slice(0, 80) });
        }
      }
    }

    if (obj.type === "assistant") {
      asstMsgs++;

      // Detect rate limit messages in assistant text content
      // and /continue Read calls for compact-*.txt files
      const content = obj.message && obj.message.content;

      // Detect rate_limit error on assistant messages
      if (obj.error === "rate_limit") {
        let msgText = "";
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text) msgText += block.text;
          }
        }
        const rateLimitType = detectRateLimitType(msgText);
        const resetsAt = parseResetsAt(msgText, ts);
        rateLimitEvents.push({
          ts,
          message: msgText,
          rateLimitType,
          resetsAt,
          line: lineNum,
        });
      }

      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text" && block.text) {
            for (const pat of RATE_LIMIT_PATTERNS) {
              if (block.text.startsWith(pat.prefix)) {
                const rateLimitType = detectRateLimitType(block.text);
                const resetsAt = parseResetsAt(block.text, ts);
                // Only push if not already captured via obj.error
                if (obj.error !== "rate_limit") {
                  rateLimitEvents.push({
                    ts,
                    message: block.text,
                    rateLimitType,
                    resetsAt,
                  });
                }
                break;
              }
            }
          }
          // Detect Read tool_use calls to compact-*.txt (part of /continue)
          if (inContinueSequence && block.type === "tool_use" && block.name === "Read") {
            const filePath = block.input && block.input.file_path;
            if (filePath && (/compact-[0-9a-f-]+\.(txt|aggressive\.txt)$/.test(filePath) || /\/[0-9a-f-]+\/compact(?:\.aggressive)?\.txt$/.test(filePath))) {
              continueReads.push({ ts, filePath });
            }
          }
        }
      }

      // End /continue sequence: non-meta user message or assistant with no Read calls to compact files
      // Actually, the sequence ends when we see a non-Read-compact assistant message after reads started
      if (inContinueSequence && continueReads.length > 0) {
        let hasCompactRead = false;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "tool_use" && block.name === "Read") {
              const fp = block.input && block.input.file_path;
              if (fp && (/compact-[0-9a-f-]+\.(txt|aggressive\.txt)$/.test(fp) || /\/[0-9a-f-]+\/compact(?:\.aggressive)?\.txt$/.test(fp))) {
                hasCompactRead = true;
              }
            }
          }
        }
        if (!hasCompactRead) {
          flushContinueEvent();
        }
      }

      const usage = obj.usage || (obj.message && obj.message.usage);
      const reqId = obj.requestId || (obj.message && obj.message.id);
      const model = obj.message && obj.message.model;
      if (usage && reqId) {
        // Skip synthetic messages (rate limit blocks, login prompts, etc.)
        if (model === "<synthetic>") continue;
        const inp = usage.input_tokens || 0;
        const ccTotal = usage.cache_creation_input_tokens || 0;
        const cr = usage.cache_read_input_tokens || 0;
        const out = usage.output_tokens || 0;
        // Split cache creation into 5m and 1h tiers
        const cacheDetail = usage.cache_creation || {};
        const cc5m = cacheDetail.ephemeral_5m_input_tokens || 0;
        const cc1h = cacheDetail.ephemeral_1h_input_tokens || 0;
        const cc5mFinal = cc5m || 0;
        const cc1hFinal = cc1h || (cc5m ? 0 : ccTotal);
        const msgCost = calcCost(inp, cc5mFinal, cc1hFinal, cr, out, model);

        // ── Streaming-time flag: heuristic_resume ──
        // Conditions: large cache creation, tight gap, no pending session event.
        // The actual evt string is assembled in the post-sort loop below.
        const currentTs = ts ? Math.floor(new Date(ts).getTime() / 1000) : 0;
        const isHeuristicResume =
          !sessionMarkPending &&
          ccTotal >= 10000 &&
          ccTotal >= inp * 2 &&
          lastAssistantTs > 0 &&
          currentTs > 0 &&
          (currentTs - lastAssistantTs) < 3600;
        if (currentTs > 0) lastAssistantTs = currentTs;
        // Once an assistant turn fires, session-mark pending flag is consumed
        sessionMarkPending = false;

        requestUsage.set(reqId, {
          ts,
          reqId,
          model: model || "unknown",
          input: inp,
          cacheCreation: ccTotal,
          cacheCreate5m: cc5mFinal,
          cacheCreate1h: cc1hFinal,
          cacheRead: cr,
          output: out,
          cost: Math.round(msgCost * 1000000) / 1000000,
          line: lineNum,
          _heuristicResume: isHeuristicResume,
        });
      }
    }
  }

  // Flush any pending /continue sequence at end of file
  flushContinueEvent();

  // Aggregate deduplicated usage
  // reqEntries: compact per-request records for universal subagent cost dedup.
  // Each entry: {r: reqId, i: input, c5: cc5m, c1: cc1h, cr, o: out, $ : cost}
  // Stored in summary.json; post-processing subtracts parent-session reqIds from
  // subagent totals to correct double-counting from CC's runForkedAgent replay.
  const reqEntries = [];
  for (const entry of requestUsage.values()) {
    input += entry.input;
    cacheCreation += entry.cacheCreation;
    cacheCreate5m += entry.cacheCreate5m;
    cacheCreate1h += entry.cacheCreate1h;
    cacheRead += entry.cacheRead;
    output += entry.output;
    costUSD += entry.cost;
    usageTimeline.push(entry);
    reqEntries.push({
      r: entry.reqId,
      i: entry.input,
      c5: entry.cacheCreate5m,
      c1: entry.cacheCreate1h,
      cr: entry.cacheRead,
      o: entry.output,
      $: entry.cost,
    });
  }

  // Initialize rl/evt fields on usage entries
  for (const e of usageTimeline) {
    e.win = null;
    e.rl = "";
    e.evt = "";
    if (e.line == null) e.line = null;
  }

  // Insert rate limit events into the timeline. Structured data in `rl`
  // column (type + reset info); no short-form marker duplicated in evt.
  for (const rle of rateLimitEvents) {
    // Format: limit_hit_5h{1am@Asia/Seoul} or limit_hit_unknown (no reset info)
    const rlValue = rle.resetsAt ? `${rle.rateLimitType}${rle.resetsAt}` : rle.rateLimitType;
    usageTimeline.push({
      ts: rle.ts,
      model: "",
      input: 0,
      cacheCreation: 0,
      cacheCreate5m: 0,
      cacheCreate1h: 0,
      cacheRead: 0,
      output: 0,
      cost: 0,
      win: null,
      rl: rlValue,
      evt: "",
      line: rle.line != null ? rle.line : null,
    });
  }

  // Insert context events into the timeline
  for (const ce of contextEvents) {
    usageTimeline.push({
      ts: ce.ts,
      model: "",
      input: 0,
      cacheCreation: 0,
      cacheCreate5m: 0,
      cacheCreate1h: 0,
      cacheRead: 0,
      output: 0,
      cost: 0,
      win: null,
      rl: "",
      evt: ce.type === "compact"
        ? `compact:${ce.trigger}:${ce.preTokens}`
        : ce.type === "continue"
        ? `continue:${ce.sessionCount}`
        : ce.type,  // clear, reload_plugins, model_change
      line: ce.line != null ? ce.line : null,
    });
  }

  // Re-sort after inserting rate limit and context events
  usageTimeline.sort((a, b) => (a.ts > b.ts ? 1 : -1));

  // Mark each row with its hourFloor (1h boundary).
  // 5h window assembly happens in build-report.js using all sessions + ratelimit data.
  for (const e of usageTimeline) {
    const ts = Math.floor(new Date(e.ts).getTime() / 1000);
    e.win = hourFloor(ts);
  }

  // Build the evt column — single source of truth for cost/ctx/heuristic tags.
  // Post-sort so context tokens are computed on chronological order; cost tags
  // use per-row cost thresholds; heuristic_resume was detected at streaming time
  // (has session-mark suppression) and carried via _heuristicResume flag.
  let curModel = null;
  let evtPrevCtxLevel = 0;  // 0=none, 1=warn(35%), 2=danger(70%)
  for (const e of usageTimeline) {
    if (e.model && e.model !== "unknown" && e.model !== "") curModel = e.model;
    if (e.cost <= 0 && e.input <= 0) continue; // skip event-only rows

    const evts = e.evt ? [e.evt] : [];

    // Cost thresholds (per-row, single API call)
    if (e.cost >= 1.0) {
      evts.push("cost_danger");
    } else if (e.cost >= 0.5) {
      evts.push("cost_warn");
    }

    // Context % thresholds (first-crossing only)
    if (curModel) {
      const rates = MODEL_PRICING[curModel];
      const contextWindow = rates ? rates.contextWindow : (DEFAULT_PRICING ? DEFAULT_PRICING.contextWindow : 200000);
      if (contextWindow > 0) {
        const contextTokens = e.input + e.cacheCreation + e.cacheRead;
        const contextPct = contextTokens / contextWindow;
        let ctxLevel = 0;
        if (contextPct >= 0.70) ctxLevel = 2;
        else if (contextPct >= 0.35) ctxLevel = 1;

        if (ctxLevel > evtPrevCtxLevel) {
          if (ctxLevel >= 2) evts.push("ctx_danger");
          else if (ctxLevel >= 1) evts.push("ctx_warn");
          evtPrevCtxLevel = ctxLevel;
        }
      }
    }

    // heuristic_resume — flag set during streaming parse (has session-mark suppression)
    if (e._heuristicResume) evts.push("heuristic_resume");

    e.evt = evts.join("|");
    // Clean up transient flag — not persisted in CSV
    delete e._heuristicResume;
  }

  // Determine primary model (most frequent in timeline)
  const modelCounts = {};
  for (const e of usageTimeline) {
    if (e.model && e.model !== "unknown") modelCounts[e.model] = (modelCounts[e.model] || 0) + 1;
  }
  const primaryModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const sessionId = path.basename(filePath, ".jsonl");
  return {
    sessionId,
    filePath,
    firstTs,
    lastTs,
    firstUserMsg,
    lastUserMsg,
    skillSignature,
    userMsgs,
    asstMsgs,
    model: primaryModel,
    tokens: { input, cacheCreation, cacheCreate5m, cacheCreate1h, cacheRead, output },
    costUSD: Math.round(costUSD * 10000) / 10000,
    reqEntries,
    usageTimeline,
    rateLimitEvents,
    contextEvents,
    userMessageLog,
  };
}

function detectRateLimitType(message) {
  if (!message) return "limit_hit_unknown";
  const lower = message.toLowerCase();
  if (lower.includes("session limit")) return "limit_hit_5h";
  if (lower.includes("weekly limit")) return "limit_hit_weekly";
  if (lower.includes("opus limit")) return "limit_hit_opus";
  if (lower.includes("sonnet limit")) return "limit_hit_sonnet";
  if (lower.includes("you're out of extra usage")) return "limit_hit_extra";
  if (lower.includes("extra usage")) return "limit_hit_extra";
  return "limit_hit_unknown";
}

function parseResetsAt(message, eventTs) {
  if (!message || !eventTs) return null;
  const m = message.match(/·\s*resets\s+(\S+?)(?:\s+\(([^)]+)\))?(?:\s|$)/i);
  if (!m) return null;
  const timeStr = m[1]; // e.g. "1am", "10:30am"
  const tz = m[2]; // e.g. "Asia/Seoul" (optional)
  return tz ? `{${timeStr}@${tz}}` : `{${timeStr}}`;
}


function hourFloor(ts) {
  return ts - (ts % 3600);
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.host === "codex") return mainCodex(opts);

  const cutoff = computeCutoff(opts);

  const dirs = findTranscriptDirs(opts);
  if (dirs.length === 0) {
    process.stdout.write(
      JSON.stringify({
        sessions: [],
        summary: {
          totalCost: 0,
          totalTokens: 0,
          sessionCount: 0,
          dateRange: { from: null, to: null },
          host: "claude",
          hasCostData: true,
        },
      }) + "\n",
    );
    return;
  }

  const files = listJsonlFiles(dirs, cutoff);
  process.stderr.write(`Found ${files.length} transcript files\n`);

  // Ensure cache dir exists
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  // Auto-migrate old YYMM cache structure (idempotent, runs once)
  migrateFromYYMM();

  const sessions = [];
  const unknownModels = new Set();

  for (const file of files) {
    const paths = resolveSessionPaths(file.path);

    // Check cache
    if (!opts.force && isCacheValid(paths.summaryPath, file.mtime)) {
      const cached = readCache(paths.summaryPath);
      if (cached) {
        sessions.push(cached);
        continue;
      }
    }

    // Analyze and cache. Fail-fast on unknown model: skip this session's
    // cache write, record the model, continue to next session so we collect
    // ALL unknowns in a single pass.
    let result;
    try {
      result = await analyzeSession(file.path);
    } catch (err) {
      if (err instanceof UnknownModelError) {
        unknownModels.add(err.model);
        continue;
      }
      throw err;
    }

    // For agent sessions, read CC's meta.json if available
    if (paths.isAgent && paths.mainSessionId && paths.agentId) {
      const ccMetaPath = path.join(
        PROJECTS_DIR,
        paths.projectName,
        paths.mainSessionId,
        "subagents",
        `agent-${paths.agentId}.meta.json`,
      );
      try {
        if (fs.existsSync(ccMetaPath)) {
          const meta = JSON.parse(fs.readFileSync(ccMetaPath, "utf8"));
          if (meta.agentType) result.agentType = meta.agentType;
          if (meta.description) result.agentDescription = meta.description;
        }
      } catch (_) { /* ignore meta read errors */ }
    }

    writeCache(paths.summaryPath, paths.timelinePath, result);
    // Push metadata only (without usageTimeline)
    const { usageTimeline, ...metadata } = result;
    sessions.push(metadata);
  }

  // ── Universal subagent cost dedup ──────────────────────────────
  // CC's runForkedAgent (auto-compact, sideQuestion, agentSummary, worktree forks)
  // writes the FULL parent conversation history into the subagent sidechain via
  // recordSidechainTranscript. Replayed parent messages retain their ORIGINAL
  // requestId, causing cost double-counting when subagents are aggregated
  // independently. Fix: a subagent's effective cost = sum of entries whose reqId
  // does NOT appear in its parent's requestIds. Handles ALL fork cases uniformly:
  //   • Regular independent subagents → 0 overlap → unchanged
  //   • Acompact → ~100% overlap → only the summary call counted
  //   • Aside_question → ~90% overlap → only new calls counted
  //   • Worktree forks → high overlap → only new calls counted
  //
  // Dedup mutates session.tokens, session.costUSD in place (on the in-memory
  // copy — cached summary.json keeps raw reqEntries so dedup is reproducible
  // across runs without re-parsing JSONL).
  {
    // Build parent reqId sets keyed by main sessionId
    const parentReqIds = new Map(); // mainSessionId -> Set<reqId>
    for (const sess of sessions) {
      if (!sess.filePath || sess.filePath.match(_subagentSep)) continue;
      if (!Array.isArray(sess.reqEntries)) continue;
      const set = new Set();
      for (const e of sess.reqEntries) set.add(e.r);
      parentReqIds.set(sess.sessionId, set);
    }

    let dedupCount = 0;
    for (const sess of sessions) {
      if (!sess.filePath || !sess.filePath.match(_subagentSep)) continue;
      if (!Array.isArray(sess.reqEntries) || sess.reqEntries.length === 0) continue;
      // Derive parent session id from file path
      const parts = sess.filePath.split(_subagentSep);
      if (parts.length < 2) continue;
      const parentId = path.basename(parts[0]);
      const parentSet = parentReqIds.get(parentId);
      if (!parentSet || parentSet.size === 0) continue;
      // Filter entries whose reqId is NOT in parent
      const filtered = sess.reqEntries.filter((e) => !parentSet.has(e.r));
      if (filtered.length === sess.reqEntries.length) continue; // no overlap
      let input = 0, cc5m = 0, cc1h = 0, cr = 0, out = 0, cost = 0;
      for (const e of filtered) {
        input += e.i || 0;
        cc5m += e.c5 || 0;
        cc1h += e.c1 || 0;
        cr += e.cr || 0;
        out += e.o || 0;
        cost += e.$ || 0;
      }
      sess.tokens = {
        input,
        cacheCreation: cc5m + cc1h,
        cacheCreate5m: cc5m,
        cacheCreate1h: cc1h,
        cacheRead: cr,
        output: out,
      };
      sess.costUSD = Math.round(cost * 10000) / 10000;
      sess._dedupApplied = {
        removed: sess.reqEntries.length - filtered.length,
        kept: filtered.length,
      };
      dedupCount++;
    }
    if (dedupCount > 0) {
      process.stderr.write(`Subagent cost dedup applied to ${dedupCount} sessions\n`);
    }
  }

  // Filter sessions that have timestamps and are within cutoff, sort by firstTs descending
  // Also exclude /continue skill invocation sessions (their first user message
  // starts with "Base directory for this skill:" and contains "skills/continue")
  const valid = sessions
    .filter((s) => s.firstTs && s.lastTs && new Date(s.firstTs) >= cutoff)
    .filter((s) => {
      const sig = s.skillSignature || '';
      return !(sig.includes('skills/continue'));
    })
    .sort((a, b) => new Date(b.firstTs) - new Date(a.firstTs));

  // Remove internal-only fields from output
  // reqEntries stays in cached summary.json (needed for reproducible dedup)
  // but is not emitted to stdout/build-report (keeps JSON payload small).
  for (const s of valid) {
    delete s.skillSignature;
    delete s.reqEntries;
    delete s._dedupApplied;
  }

  // totalCost is NOT computed here — per-session costUSD double-counts replayed
  // rows in subtasks. Accurate dedup'd total is computed in build-report.js
  // from timeline CSVs (see tokenBreakdown → summary.totalCost).
  const totalTokens = valid.reduce(
    (s, x) =>
      s +
      x.tokens.input +
      x.tokens.cacheCreation +
      x.tokens.cacheRead +
      x.tokens.output,
    0,
  );
  const dates = valid
    .filter((s) => s.firstTs)
    .flatMap((s) => [s.firstTs, s.lastTs])
    .sort();
  const dateRange = dates.length > 0
    ? { from: dates[0], to: dates[dates.length - 1] }
    : { from: null, to: null };

  // Fail-fast: if any unknown models were encountered, refuse to emit
  // (possibly-wrong) cost data. Exit(2) with structured stderr so the
  // skill LLM can look up prices, update model-pricing.json, and re-run.
  if (unknownModels.size > 0) {
    emitUnknownModelError(unknownModels);
    process.exit(2);
  }

  const output = {
    sessions: valid,
    summary: {
      totalTokens,
      sessionCount: valid.length,
      dateRange,
      host: "claude",
      hasCostData: true,
    },
  };

  process.stdout.write(JSON.stringify(output) + "\n");
}

// ── Codex host ──────────────────────────────────────────────────────────
//
// Codex has no per-model pricing table in this plugin and its rollout has a
// completely different row shape, so discovery/parsing is a parallel path
// (reusing codex-transcript.js for normalization — never a second scanner of
// ~/.codex/sessions — and codex-usage.js for the delta/rate-limit math).
// But the *output* of this path is deliberately shaped to match what a
// Claude session already looks like — same cache tree (getSessionDir/
// getSummaryPath/getTimelinePath), same 14-column timeline.csv — so
// build-report.js's existing discovery, CSV reader and REPORT_DATA pipeline
// pick these sessions up with no new code on that side. A separate cache
// namespace or CSV shape would just be a second thing for build-report.js to
// know about; this plugin does not fork the rendering path per host.
//
// Field mapping (no double counting): Codex's `cached_input_tokens` is what
// Claude calls cache READ (context reused, not paid to write); Codex's
// `cache_write_input_tokens` is what Claude calls cache creation. Codex's
// `input_tokens` already includes the cached portion, so the CSV's `input`
// column carries `noncachedInput` (input minus cached), matching Claude's
// own `input` column, which is also "fresh" input excluding cache columns.
// `reasoning_output_tokens` is a detail of `output_tokens` and is not added
// to any column separately — it would double it.
//
// Cost is written as 0, never as an empty/NaN field — a numeric column that
// silently parses as 0 is safe arithmetic, but it must never be *displayed*
// as a real $0.00. That distinction is enforced downstream in
// build-report.js via `summary.hasCostData`/`REPORT_DATA.host`, not here.

const CODEX_CACHE_VERSION = 3;

function selectCanonicalRateLimits(samples) {
  const ranked = (samples || []).filter((s) => s.limitId === "codex").slice().sort((a, b) => {
    const at = Date.parse(a.ts); const bt = Date.parse(b.ts);
    const av = Number.isFinite(at); const bv = Number.isFinite(bt);
    if (av !== bv) return av ? -1 : 1;
    if (av && at !== bt) return bt - at;
    const lineDiff = (Number(b.line) || -1) - (Number(a.line) || -1);
    if (lineDiff) return lineDiff;
    return String(a.sessionId || "").localeCompare(String(b.sessionId || ""));
  });
  const pick = (lane) => {
    const s = ranked.find((sample) => sample.lane === lane);
    return s ? { limitId: "codex", lane, usedPercent: s.usedPercent ?? null, windowMinutes: s.windowMinutes ?? null, resetsAt: s.resetsAt ?? null, ts: s.ts ?? null } : null;
  };
  return { limitId: "codex", primary: pick("primary"), secondary: pick("secondary") };
}

function isCodexCacheValid(cachePath, transcriptMtime) {
  try {
    const cacheStat = fs.statSync(cachePath);
    if (cacheStat.mtime < transcriptMtime) return false;
    const data = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    // The `host` check matters even though Codex/Claude session ids are
    // drawn from unrelated UUID spaces: without it, a stale Claude cache
    // entry that happened to share a path would be misread as a valid
    // (empty-looking) Codex summary instead of triggering re-analysis.
    return data.host === "codex" && data.cacheVersion === CODEX_CACHE_VERSION;
  } catch {
    return false;
  }
}

function writeCodexCache(summaryPath, timelinePath, data) {
  try {
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    fs.mkdirSync(path.dirname(timelinePath), { recursive: true });
    const { timeline, ...metadata } = data;
    metadata.cacheVersion = CODEX_CACHE_VERSION;
    writeFileAtomic(summaryPath, JSON.stringify(metadata));

    // Same 14 columns analyze-usage.js writes for Claude sessions (see
    // writeCache above) so build-report.js's readTimelineCsv() needs no
    // Codex-specific branch. cc5m has no Codex equivalent (one cache tier,
    // not two) and stays 0; the whole write goes into cc/cc1h.
    const header = "ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt,line,req";
    const lines = [header];
    let prevModel = null;
    for (const e of timeline) {
      const ts = Math.floor(new Date(e.ts).getTime() / 1000) || "";
      const model = e.model !== prevModel ? (e.model || "") : "";
      if (e.model) prevModel = e.model;
      lines.push([
        ts, model,
        e.noncachedInput, e.cacheWrite, 0, e.cacheWrite, e.cachedInput, e.output,
        0, // cost: always a safe 0, never NaN — "unknown" is a host-level fact, not a per-row one
        "", "", "",
        e.line, "",
      ].join(","));
    }
    writeFileAtomic(timelinePath, lines.join("\n") + "\n");
  } catch (err) {
    process.stderr.write(`Warning: failed to write Codex cache: ${err.message}\n`);
  }
}

/**
 * Read one normalized Codex session and derive its usage timeline.
 * `meta` is the entry from listCodexSessions() (sessionId, cwd, path, mtime, ...).
 */
async function analyzeCodexSession(meta) {
  const normalizedPath = normalizeCodexTranscript(meta.path, meta);
  const stream = fs.createReadStream(normalizedPath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const tracker = createSessionUsageTracker();
  const timeline = [];
  const rateLimitSamples = [];
  let firstTs = null;
  let lastTs = null;
  let firstUserMsg = null;
  let lastUserMsg = null;
  let userMsgs = 0;
  let asstMsgs = 0;
  let curModel = null; // set prospectively by codex_turn_context, applied to rows that follow
  let curPlan = null; // { key, raw } — plan_type is expected constant per session but tracked prospectively like model
  const modelCounts = {};
  let lineNum = 0;

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
    if (obj.timestamp) {
      if (!firstTs) firstTs = obj.timestamp;
      lastTs = obj.timestamp;
    }

    if (obj.type === "user" && !obj.isMeta) {
      userMsgs++;
      const text = obj.message && obj.message.content && obj.message.content[0] && obj.message.content[0].text;
      if (text) {
        if (!firstUserMsg) firstUserMsg = text.slice(0, 80);
        lastUserMsg = text.slice(0, 80);
      }
      continue;
    }
    if (obj.type === "assistant") { asstMsgs++; continue; }

    if (obj.type === "codex_turn_context") {
      if (obj.model) curModel = obj.model;
      continue;
    }

    if (obj.type !== "codex_token_count") continue;

    const { delta, diagnostic } = tracker.ingest(obj.totalTokenUsage, obj.lastTokenUsage);
    const { row, diagnostics } = deltaToUsageRow(delta);
    if (diagnostic) diagnostics.push(diagnostic);

    if (curModel) modelCounts[curModel] = (modelCounts[curModel] || 0) + 1;
    timeline.push({ ts: obj.timestamp, line: lineNum, model: curModel, ...row, diagnostics });

    if (obj.rateLimits) {
      if (obj.rateLimits.plan_type) curPlan = normalizeCodexPlan(obj.rateLimits.plan_type);
      const samples = extractRateLimitSamples(obj.rateLimits, meta.sessionId, lineNum, obj.timestamp, curPlan ? curPlan.key : null);
      rateLimitSamples.push(...samples);
    }
  }

  const totals = timeline.reduce((acc, e) => {
    acc.input += e.input; acc.cachedInput += e.cachedInput; acc.noncachedInput += e.noncachedInput;
    acc.cacheWrite += e.cacheWrite; acc.output += e.output; acc.reasoningOutput += e.reasoningOutput; acc.total += e.total;
    return acc;
  }, { input: 0, cachedInput: 0, noncachedInput: 0, cacheWrite: 0, output: 0, reasoningOutput: 0, total: 0 });

  const primaryModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    sessionId: meta.sessionId,
    isSubagent: meta.isSubagent === true,
    threadId: meta.threadId || meta.sessionId,
    agent: meta.agent || null,
    host: "codex",
    filePath: meta.path,
    cwd: meta.cwd,
    firstTs,
    lastTs,
    firstUserMsg,
    lastUserMsg,
    userMsgs,
    asstMsgs,
    model: primaryModel,
    plan: curPlan,
    // Claude-shaped view — this is what build-report.js's existing pipeline
    // (tokenBreakdown, windows, calendar) actually reads.
    tokens: {
      input: totals.noncachedInput,
      cacheCreation: totals.cacheWrite,
      cacheCreate5m: 0,
      cacheCreate1h: totals.cacheWrite,
      cacheRead: totals.cachedInput,
      output: totals.output,
    },
    // Codex-native totals, kept for anything that wants the authoritative
    // numbers (e.g. summary.totalTokens uses `total`, not a re-sum of the
    // mapped columns above, to avoid double-counting cached/reasoning).
    tokensCodex: totals,
    costUSD: 0,
    reqEntries: [],
    timeline,
    rateLimitSamples,
  };
}

async function mainCodex(opts) {
  const cutoff = computeCutoff(opts);
  // Codex sessions are scoped by session_meta.cwd, not by a hashed projectName
  // directory — --project (a hashed name, e.g. -Users-foo-bar) can't be
  // inverted back into the literal cwd, so list everything and filter by the
  // same projectNameFromCwd() hash both hosts already share.
  const allSessions = listCodexSessions(null, { includeSubagents: true });
  const sessions = opts.project
    ? allSessions.filter((m) => projectNameFromCwd(m.cwd || "unknown") === opts.project)
    : allSessions;

  // Codex cache lives in its own sub-tree (codex/), never beside Claude sessions.
  const codexPaths = forHost("codex");
  fs.mkdirSync(CODEX_BASE, { recursive: true });

  const results = [];
  let allRateLimitSamples = [];
  for (const meta of sessions) {
    if (meta.mtime < cutoff) continue;
    const projectName = projectNameFromCwd(meta.cwd || "unknown");
    const summaryPath = codexPaths.getSummaryPath(projectName, meta.sessionId);
    const timelinePath = codexPaths.getTimelinePath(projectName, meta.sessionId);

    if (!opts.force && isCodexCacheValid(summaryPath, meta.mtime)) {
      try {
        const cached = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
        results.push(cached);
        allRateLimitSamples.push(...(cached.rateLimitSamples || []));
        continue;
      } catch {}
    }

    const result = await analyzeCodexSession(meta);
    writeCodexCache(summaryPath, timelinePath, result);
    const { timeline, ...metadata } = result;
    results.push(metadata);
    allRateLimitSamples.push(...result.rateLimitSamples);
  }

  const mergedSamples = mergeRateLimitSamples(allRateLimitSamples, "codex");
  const canonicalRateLimits = selectCanonicalRateLimits(mergedSamples);

  const valid = results
    .filter((s) => s.firstTs && s.lastTs && new Date(s.firstTs) >= cutoff)
    .sort((a, b) => new Date(b.firstTs) - new Date(a.firstTs));

  const totalTokens = valid.reduce((s, x) => s + (x.tokensCodex ? x.tokensCodex.total : 0), 0);
  const dates = valid.filter((s) => s.firstTs).flatMap((s) => [s.firstTs, s.lastTs]).sort();
  const dateRange = dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : { from: null, to: null };

  const canonicalWindow = selectLongestRateLimitLane(canonicalRateLimits);
  const windowMinutes = canonicalWindow ? Number(canonicalWindow.windowMinutes) : 60;
  const windowSource = canonicalWindow ? "canonical_rate_limit" : "analytics_fallback";

  const subtaskCount = valid.filter((s) => s.isSubagent).length;
  const mainSessionCount = valid.length - subtaskCount;
  const output = {
    sessions: valid,
    rateLimitSamples: mergedSamples.map((s) => ({ ...s, mergedSessions: s.mergedSessions ? [...s.mergedSessions] : undefined })),
    canonicalRateLimits,
    windowSource,
    summary: {
      totalTokens,
      sessionCount: mainSessionCount,
      subtaskCount,
      dateRange,
      host: "codex",
      costKnownUSD: null,
      hasCostData: false,
      windowMinutes,
    },
  };

  process.stdout.write(JSON.stringify(output) + "\n");
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
