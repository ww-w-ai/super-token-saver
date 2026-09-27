#!/usr/bin/env node
/**
 * report-limit.js — Standalone rate-limit reporter (zero LLM involvement)
 *
 * 1. Runs analyze-usage.js to ensure timeline CSVs exist
 * 2. Scans timeline CSVs for rate-limited windows
 * 3. Collects all rows within each 5h window, merges overlapping windows
 * 4. Builds sessions.csv with hashed IDs and project mapping
 * 5. Merges ratelimit CSVs into single ratelimit.csv (dedup + sort)
 * 6. Uploads to GitHub gist + opens pre-filled Discussion URL
 * 7. Prints JSON summary to stdout
 *
 * Cache structure: ~/.claude/super-token-saver-data/{projectName}/{sessionId}/
 *   timeline.csv, ratelimit.csv, summary.json, subagents/{agentId}/...
 *
 * Usage: node report-limit.js [--plan <plan>] [--date <YYYY-MM-DD> | --blocked] [--dry-run]
 *   --plan     pro|max100|max200|team|team_premium|enterprise|bedrock|foundry|vertex
 *   (default)  every 5h window of the last 7 days, rate-limited or not
 *   --date     every 5h window overlapping that date
 *   --blocked  only rate-limited windows, across all cached data
 *   --dry-run  build the report and print it; no gist upload, no browser
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { buildGlobalWindowMap, FIVE_HOURS_S } = require('./lib/window-utils');
const { listProjects, listSessions, listSubagents, getTimelinePath, getSubagentTimelinePath, getRatelimitPath, getSummaryPath, hashId, CACHE_BASE: CACHE_DIR, migrateFromYYMM } = require('./lib/cache-paths');
const { dropReplayedRequests } = require('./lib/request-dedup');
const { loadAccountIndex, isCurrentAccount } = require('./lib/accounts');
const { PLAN_INFO, VALID_PLANS } = require('./lib/plan-info');
const { fmtTokens, fmtDate, fmtTime } = require('./lib/format');

const SCRIPTS_DIR = __dirname;
const REPO = 'ww-w-ai/super-token-saver';
const WINDOW_SECS = FIVE_HOURS_S;

function log(msg) {
  process.stderr.write(msg + '\n');
}


// Parse --plan argument
let plan = null;
const planIdx = process.argv.indexOf('--plan');
if (planIdx !== -1 && process.argv[planIdx + 1]) {
  const val = process.argv[planIdx + 1];
  if (VALID_PLANS.includes(val)) {
    plan = val;
  } else {
    log('Invalid plan: ' + val + '. Valid: ' + VALID_PLANS.join(', '));
    process.exit(1);
  }
}

// Parse --date argument (report specific date, not just rate-limited windows)
let targetDate = null;
const dateIdx = process.argv.indexOf('--date');
if (dateIdx !== -1 && process.argv[dateIdx + 1]) {
  const val = process.argv[dateIdx + 1];
  const parsed = new Date(val + 'T00:00:00');
  if (isNaN(parsed.getTime())) {
    log('Invalid date: ' + val + '. Use YYYY-MM-DD format.');
    process.exit(1);
  }
  targetDate = parsed;
}

const blockedOnly = process.argv.includes('--blocked');
const dryRun = process.argv.includes('--dry-run');
if (blockedOnly && targetDate) {
  log('--blocked and --date cannot be combined.');
  process.exit(1);
}

// Range for the all-windows modes: the given date, or the last 7 days (one weekly-limit cycle).
const DEFAULT_RANGE_DAYS = 7;
const range = (() => {
  if (targetDate) {
    const start = Math.floor(targetDate.getTime() / 1000);
    return { start, end: start + 86400, label: targetDate.toISOString().slice(0, 10) };
  }
  const end = Math.floor(Date.now() / 1000);
  return { start: end - DEFAULT_RANGE_DAYS * 86400, end, label: 'last ' + DEFAULT_RANGE_DAYS + ' days' };
})();

// ── Step 1: Run analyze-usage.js to ensure timeline CSVs exist ──
log('Running analyze-usage.js to ensure timeline CSVs exist...');
try {
  execFileSync('node', [path.join(SCRIPTS_DIR, 'analyze-usage.js')], {
    stdio: ['pipe', 'pipe', 'inherit'],
    maxBuffer: 100 * 1024 * 1024,
  });
} catch (e) {
  // Exit 2 = UnknownModelError (structured stderr already emitted by analyze-usage.js).
  // Pass through so the skill LLM can handle it inline (update pricing JSON, re-run).
  if (e.status === 2) {
    process.exit(2);
  }
  log('Warning: analyze-usage.js failed, continuing with existing CSVs');
}

// ── Step 2: Scan timeline CSVs for rate-limited windows ─────────
if (!fs.existsSync(CACHE_DIR)) {
  log('No cache directory found. Run /usage-view first.');
  process.exit(1);
}

// Migrate old YYMM structure (idempotent)
migrateFromYYMM();

const projects = listProjects();
if (projects.length === 0) {
  log('No project directories found. Run /usage-view first.');
  process.exit(1);
}

// Map: winTs (string) -> { sessions: Set<sessionId> }
// Deduplicate: only take FIRST occurrence of limit_hit per unique win value
const windowMap = new Map();
// Track sessionId → projectName for sessions.csv
const sessionProjectMap = new Map();

// ── Step 2a: --blocked — rate-limited windows only, across all cached data ──
if (blockedOnly) {
  for (const proj of projects) {
    const sessions = listSessions(proj);
    for (const sess of sessions) {
      sessionProjectMap.set(sess, proj);
      const csvPath = getTimelinePath(proj, sess);
      if (!fs.existsSync(csvPath)) continue;
      const content = fs.readFileSync(csvPath, 'utf8').trim();
      if (!content) continue;
      const lines = content.split('\n');
      let prevWin = '';

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < 11) continue;
        const win = cols[9] !== '' ? cols[9] : prevWin;
        if (cols[9] !== '') prevWin = cols[9];
        const rl = cols[10] || '';
        if (rl.startsWith('limit_hit_5h') || rl.startsWith('limit_hit_unknown')) {
          if (!windowMap.has(win)) windowMap.set(win, { sessions: new Set(), hasUnknown: false });
          windowMap.get(win).sessions.add(sess);
          if (rl.startsWith('limit_hit_unknown')) windowMap.get(win).hasUnknown = true;
        }
      }

      // Also scan subagent timelines
      const agents = listSubagents(proj, sess);
      for (const agent of agents) {
        sessionProjectMap.set('agent-' + agent, proj);
        const agentCsvPath = getSubagentTimelinePath(proj, sess, agent);
        if (!fs.existsSync(agentCsvPath)) continue;
        const agentContent = fs.readFileSync(agentCsvPath, 'utf8').trim();
        if (!agentContent) continue;
        const agentLines = agentContent.split('\n');
        let agentPrevWin = '';
        for (let i = 1; i < agentLines.length; i++) {
          const cols = agentLines[i].split(',');
          if (cols.length < 11) continue;
          const win = cols[9] !== '' ? cols[9] : agentPrevWin;
          if (cols[9] !== '') agentPrevWin = cols[9];
          const rl = cols[10] || '';
          if (rl.startsWith('limit_hit_5h') || rl.startsWith('limit_hit_unknown')) {
            if (!windowMap.has(win)) windowMap.set(win, { sessions: new Set(), hasUnknown: false });
            windowMap.get(win).sessions.add('agent-' + agent);
            if (rl.startsWith('limit_hit_unknown')) windowMap.get(win).hasUnknown = true;
          }
        }
      }
    }
  }
}

// ── Step 2b: default and --date — every 5h window overlapping the range ──
// A 5h window overlaps the range if: winStart < rangeEnd AND winStart + 5h > rangeStart
// Scan rows in [rangeStart - 5h, rangeEnd) to catch windows starting before the range
if (!blockedOnly) {
  const dayStart = range.start;
  const dayEnd = range.end;
  const scanStart = dayStart - FIVE_HOURS_S; // catch windows starting up to 5h before midnight
  for (const proj of projects) {
    const sessions = listSessions(proj);
    for (const sess of sessions) {
      sessionProjectMap.set(sess, proj);
      const csvPath = getTimelinePath(proj, sess);
      if (!fs.existsSync(csvPath)) continue;
      const content = fs.readFileSync(csvPath, 'utf8').trim();
      if (!content) continue;
      const lines = content.split('\n');
      let prevWin = '';
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < 11) continue;
        const ts = Number(cols[0]);
        const win = cols[9] !== '' ? cols[9] : prevWin;
        if (cols[9] !== '') prevWin = cols[9];
        if (ts >= scanStart && ts < dayEnd) {
          const winTs = win || String(Math.floor(ts / 3600) * 3600);
          const winNum = Number(winTs);
          // Include if the 5h window overlaps the target date
          if (winNum < dayEnd && winNum + FIVE_HOURS_S > dayStart) {
            if (!windowMap.has(winTs)) windowMap.set(winTs, { sessions: new Set(), hasUnknown: false });
            windowMap.get(winTs).sessions.add(sess);
          }
        }
      }
      // Also index subagent sessions
      const agents = listSubagents(proj, sess);
      for (const agent of agents) {
        sessionProjectMap.set('agent-' + agent, proj);
      }
    }
  }
}

if (windowMap.size === 0) {
  if (blockedOnly) {
    log('No rate-limited windows found in cached data. Run /usage-view first to analyze all sessions, then try again.');
  } else {
    log('No data found for ' + range.label + '. Run /usage-view first.');
  }
  process.exit(0);
}

log('Found ' + windowMap.size + ' raw window(s) (' + (blockedOnly ? 'rate-limited only' : range.label) + ').');

// ── Step 3: Build 5h windows from all active hours + ratelimit data ──
// Uses buildGlobalWindowMap which scans ALL projects (account-wide).
const hourToWin = buildGlobalWindowMap();

// Regroup windowMap (keyed by hourFloor) → 5h window starts
const fiveHWindowMap = new Map(); // 5h winStart → { sessions, hasUnknown }
for (const [hourTs, info] of windowMap) {
  const h = Number(hourTs);
  const winStart = hourToWin.get(h) || h;
  if (!fiveHWindowMap.has(winStart)) fiveHWindowMap.set(winStart, { sessions: new Set(), hasUnknown: false });
  const target = fiveHWindowMap.get(winStart);
  for (const s of info.sessions) target.sessions.add(s);
  if (info.hasUnknown) target.hasUnknown = true;
}

const mergedWindows = [...fiveHWindowMap.keys()].sort((a, b) => a - b)
  .map(start => ({ start, end: start + FIVE_HOURS_S }));

log('After grouping: ' + mergedWindows.length + ' window(s).');

// ── Step 4: Load every timeline once, apply the report's exclusions ──
// Same rules as /usage-view: a replayed request (resume/fork copies) counts once,
// and with two or more login accounts on record only the current account's rows
// are sent — the limit being reported belongs to that account.
const rlTimeStart = Math.min(...mergedWindows.map(w => w.start));
const rlTimeEnd = Math.max(...mergedWindows.map(w => w.end));

const timelines = new Map(); // session tag → [{ ts, req, cols }]
const tagFile = new Map();   // session tag → timeline path
const tagParent = new Map(); // session tag → main session id (accounts are per main session)
const accountEntries = [];

function loadTimeline(filePath, tag) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) return;
  const lines = content.split('\n');
  const out = [];
  let prevModel = '';
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 11) continue;
    // Fill sparse model only (win is left as-is per original CSV)
    if (cols[1]) prevModel = cols[1]; else cols[1] = prevModel;
    const ts = Number(cols[0]);
    if (ts < rlTimeStart || ts >= rlTimeEnd) continue;
    out.push({ ts, req: cols[13] || '', cols });
  }
  if (out.length) { timelines.set(tag, out); tagFile.set(tag, filePath); }
}

for (const proj of projects) {
  for (const sess of listSessions(proj)) {
    try {
      const summary = JSON.parse(fs.readFileSync(getSummaryPath(proj, sess), 'utf8'));
      if (summary.accountChanges) accountEntries.push({ sessionId: sess, changes: summary.accountChanges });
    } catch { /* no summary: session keeps the global account at its time */ }
    loadTimeline(getTimelinePath(proj, sess), sess);
    tagParent.set(sess, sess);
    for (const agent of listSubagents(proj, sess)) {
      loadTimeline(getSubagentTimelinePath(proj, sess, agent), 'agent-' + agent);
      tagParent.set('agent-' + agent, sess);
    }
  }
}

const replayedRows = dropReplayedRequests(timelines);
if (replayedRows > 0) log('Dropped ' + replayedRows + ' replayed request row(s) (resumed or forked sessions).');

const accountIndex = loadAccountIndex(accountEntries);
const allTimelineRows = [];
let otherAccountRows = 0;
for (const [tag, list] of timelines) {
  for (const r of list) {
    if (!isCurrentAccount(accountIndex, tagParent.get(tag), r.ts)) { otherAccountRows++; continue; }
    allTimelineRows.push({ ...r, tag });
  }
}
if (otherAccountRows > 0) log('Excluded ' + otherAccountRows + ' row(s) from other login accounts.');
allTimelineRows.sort((a, b) => a.ts - b.ts);

// ── Step 4b: Aggregate each window from the kept rows ──
const results = [];
const fmtD = fmtDate;
const fmtT = fmtTime;

for (const merged of mergedWindows) {
  const winStart = merged.start;
  const winEnd = merged.end;
  const kept = allTimelineRows.filter(r => r.ts >= winStart && r.ts < winEnd);
  if (kept.length === 0) continue; // every row was a replay or another account's

  const hasUnknown = fiveHWindowMap.get(winStart)?.hasUnknown || false;
  const touchedFiles = { timeline: new Set(kept.map(r => tagFile.get(r.tag))) };
  const windowSessions = new Set(kept.map(r => r.tag));
  let sumInput = 0, sumOutput = 0, sumCacheWrite = 0, sumCacheRead = 0;
  const rows = kept.map(r => {
    sumInput += Number(r.cols[2]) || 0;
    sumOutput += Number(r.cols[7]) || 0;
    sumCacheWrite += Number(r.cols[3]) || 0; // cc is the total; cc5m/cc1h are its split
    sumCacheRead += Number(r.cols[6]) || 0;
    return [...r.cols, r.tag].join(',');
  });

  const startD = new Date(winStart * 1000);
  const endD = new Date(winEnd * 1000);
  const totalCost = rows.reduce((s, r) => s + Number(r.split(',')[8]), 0);

  // ── Compute aggregate metrics for rate limit analysis ──
  // Parse rows into structured data for analysis
  const parsedRows = rows.map(r => {
    const c = r.split(',');
    return {
      ts: Number(c[0]), model: c[1], input: Number(c[2]) || 0,
      cc: Number(c[3]) || 0, cc5m: Number(c[4]) || 0, cc1h: Number(c[5]) || 0,
      cr: Number(c[6]) || 0, out: Number(c[7]) || 0, cost: Number(c[8]) || 0,
      rl: c[10] || '', session: c[c.length - 1],
    };
  });

  // Max concurrent sessions (distinct sessions in same second)
  const tsSessions = new Map();
  for (const r of parsedRows) {
    if (!tsSessions.has(r.ts)) tsSessions.set(r.ts, new Set());
    tsSessions.get(r.ts).add(r.session);
  }
  const maxConcurrent = Math.max(...[...tsSessions.values()].map(s => s.size));

  // Per-session cache read max (peak context size)
  const sessionCrMax = new Map();
  for (const r of parsedRows) {
    const prev = sessionCrMax.get(r.session) || 0;
    if (r.cr > prev) sessionCrMax.set(r.session, r.cr);
  }
  const maxCrPerSession = Math.max(...sessionCrMax.values(), 0);

  // Cumulative totals at limit_hit (sum up to and including last row)
  let cumInput = 0, cumOutput = 0, cumCc5m = 0, cumCc1h = 0, cumCr = 0, cumCost = 0;
  for (const r of parsedRows) {
    cumInput += r.input; cumOutput += r.out;
    cumCc5m += r.cc5m; cumCc1h += r.cc1h;
    cumCr += r.cr; cumCost += r.cost;
  }

  // Active duration (first row to last row)
  const firstTs = parsedRows.length > 0 ? parsedRows[0].ts : winStart;
  const lastTs = parsedRows.length > 0 ? parsedRows[parsedRows.length - 1].ts : winEnd;
  const activeDurationMin = Math.round((lastTs - firstTs) / 60);

  // Distinct models used
  const modelsUsed = [...new Set(parsedRows.map(r => r.model).filter(Boolean))];

  const metrics = {
    maxConcurrentSessions: maxConcurrent,
    maxCrPerSession,
    cumInput, cumOutput, cumCc5m, cumCc1h, cumCr,
    cumCost: Math.round(cumCost * 100) / 100,
    activeDurationMin,
    modelsUsed,
  };

  results.push({
    winTs: String(winStart),
    winStart,
    winEnd,
    date: fmtD(startD),
    start: fmtT(startD),
    end: fmtT(endD),
    sessions: windowSessions.size,
    requests: rows.length,
    cost: Math.round(totalCost * 100) / 100,
    input: sumInput,
    output: sumOutput,
    cacheWrite: sumCacheWrite,
    cacheRead: sumCacheRead,
    metrics,
    csvHeader: 'ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt,line,req,session',
    csvRows: rows,
    touchedFiles,
    hasUnknown,
  });
}

if (results.length === 0) {
  log('No rows left for ' + (blockedOnly ? 'the rate-limited windows' : range.label) + ' after removing replayed requests and other login accounts.');
  process.exit(0);
}

// ── Step 5: Build session index & write per-window CSV files ────
const reportDir = path.join(os.tmpdir(), 'report-limit-' + new Date().toISOString().replace(/[:.]/g, '').slice(0, 19));
fs.mkdirSync(reportDir, { recursive: true });
log('Report directory: ' + reportDir);

// Build global session and model indexes (sequential 1-based numbers)
const sessionIndex = new Map();
const modelIndex = new Map();
let sessionCounter = 0;
let modelCounter = 0;

for (const w of results) {
  for (const row of w.csvRows) {
    const cols = row.split(',');
    const sessionId = cols[cols.length - 1];
    if (!sessionIndex.has(sessionId)) sessionIndex.set(sessionId, ++sessionCounter);
    const model = cols[1];
    if (model && !modelIndex.has(model)) modelIndex.set(model, ++modelCounter);
  }
}

// Determine parent for agent sessions
// Agent sessions detected by subagent dir structure (proj/sess/subagents/agent/)
const sessionParent = new Map(); // sessionId -> parent sessionId or ''

for (const proj of projects) {
  const projSessions = listSessions(proj);
  for (const sess of projSessions) {
    const agents = listSubagents(proj, sess);
    for (const agent of agents) {
      sessionParent.set('agent-' + agent, sess);
    }
  }
}

// Write sessions.csv with hashed IDs and project column
let sessionsCsv = 'num,id,project,type,parent\n';
for (const [sid, num] of sessionIndex) {
  const type = sid.startsWith('agent-') ? 'agent' : 'main';
  const parentSid = sessionParent.get(sid) || '';
  const parentNum = parentSid ? String(sessionIndex.get(parentSid) || '') : '';
  const proj = sessionProjectMap.get(sid) || '_unknown';
  sessionsCsv += num + ',' + hashId(sid) + ',' + hashId(proj) + ',' + type + ',' + parentNum + '\n';
}
fs.writeFileSync(path.join(reportDir, 'sessions.csv'), sessionsCsv);

// Write models.csv
let modelsCsv = 'num,model\n';
for (const [model, num] of modelIndex) {
  modelsCsv += num + ',' + model + '\n';
}
fs.writeFileSync(path.join(reportDir, 'models.csv'), modelsCsv);

// Write per-window CSV files with numeric session and model IDs
for (const w of results) {
  const mappedRows = w.csvRows.map(row => {
    const cols = row.split(',');
    const sessionId = cols[cols.length - 1];
    cols[cols.length - 1] = String(sessionIndex.get(sessionId) || 0);
    cols[1] = String(modelIndex.get(cols[1]) || 0);
    return cols.join(',');
  });
  const csvContent = w.csvHeader + '\n' + mappedRows.join('\n') + '\n';
  const fileName = 'window-' + w.date + '-' + w.start.replace(':', '') + '.csv';
  fs.writeFileSync(path.join(reportDir, fileName), csvContent);
}

// ── Step 6: Copy relevant timeline and ratelimit CSVs ───────────
// NOTE: timeline.csv copy is legacy (zip-only, not uploaded to gist).
// All sessions share the filename "timeline.csv" so only the first is copied.
// If reviving this feature, must rename files (e.g. timeline-{sessionHash}.csv)
// and validate that the merged output covers all windows correctly.
for (const w of results) {
  for (const f of w.touchedFiles.timeline) {
    const dest = path.join(reportDir, path.basename(f));
    if (!fs.existsSync(dest)) fs.copyFileSync(f, dest);
  }
}

// Merge ratelimit CSVs from ALL projects, current login account only (another
// account's % would interleave with this one's and break the change-only dedup).
// ratelimit.csv only exists for sessions after setup-statusline; absence is normal.
// Multiple concurrent sessions record the same /usage snapshots, so we merge all
// source files, sort by timestamp, and keep only the first row where % changes.
const allRows = new Set();
for (const proj of projects) {
  const sessions = listSessions(proj);
  for (const sess of sessions) {
    const rlPath = getRatelimitPath(proj, sess);
    if (!fs.existsSync(rlPath)) continue;
    const content = fs.readFileSync(rlPath, 'utf8').trim();
    if (!content) continue;
    const lines = content.split('\n');
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i]) continue;
      const ts = Number(lines[i].split(',')[0]);
      if (ts >= rlTimeStart && ts < rlTimeEnd && isCurrentAccount(accountIndex, sess, ts)) allRows.add(lines[i]);
    }
  }
}

if (allRows.size > 0) {
  const sorted = [...allRows].sort((a, b) => Number(a.split(',')[0]) - Number(b.split(',')[0]));
  // Dedup: keep only rows where 5h or 7d % changed from previous
  const deduped = [];
  let prev5h = null, prev7d = null;
  for (const row of sorted) {
    const cols = row.split(',');
    const cur5h = cols[1] !== '' ? cols[1] : null;
    const cur7d = cols[3] !== '' ? cols[3] : null;
    if (cur5h !== prev5h || cur7d !== prev7d) {
      deduped.push(row);
      if (cur5h !== null) prev5h = cur5h;
      if (cur7d !== null) prev7d = cur7d;
    }
  }
  // Fill first row's missing reset values (window cut may start mid-stream)
  // Scan ALL sorted source rows (not just before firstTs) for nearest reset values
  if (deduped.length > 0) {
    const cols = deduped[0].split(',');
    if (!cols[2] || !cols[4]) {
      let best5h = '', best7d = '';
      for (const row of sorted) {
        const rc = row.split(',');
        if (rc[2]) best5h = rc[2];
        if (rc[4]) best7d = rc[4];
        if (best5h && best7d) break;
      }
      if (!cols[2] && best5h) cols[2] = best5h;
      if (!cols[4] && best7d) cols[4] = best7d;
      deduped[0] = cols.join(',');
    }
  }
  if (deduped.length > 0) {
    fs.writeFileSync(path.join(reportDir, 'ratelimit.csv'),
      'ts,5h,5h_reset,7d,7d_reset,alert,version\n' + deduped.join('\n') + '\n');
  }
}

// ── Step 7: Compress files into zip ─────────────────────────────
const zipFile = reportDir + '.zip';
let zipCreated = false;
try {
  const allFiles = fs.readdirSync(reportDir).filter(f => f.endsWith('.csv')).map(f => path.join(reportDir, f));
  if (allFiles.length > 0) {
    execFileSync('zip', ['-j', zipFile].concat(allFiles), {
      stdio: 'pipe',
      timeout: 30000,
    });
    zipCreated = true;
    log('Zip created: ' + zipFile);
  }
} catch (e) {
  log('Warning: zip compression failed — ' + e.message);
}

// ── Step 8: Try uploading zip to GitHub gist ────────────────────
let gistUrl = null;
let ghAuthenticated = false;
try {
  execFileSync('gh', ['auth', 'status'], { stdio: 'pipe' });
  ghAuthenticated = true;
} catch (e) {
  log('GitHub CLI not authenticated. Run "gh auth login" to authenticate.');
}

if (ghAuthenticated && !dryRun) {
  try {
    // Gist only supports text files — upload window + ratelimit CSVs
    const gistFiles = fs.readdirSync(reportDir)
      .filter(f => (f.startsWith('window-') || f === 'ratelimit.csv' || f === 'sessions.csv' || f === 'models.csv') && f.endsWith('.csv'))
      .map(f => path.join(reportDir, f));
    if (gistFiles.length > 0) {
      const result = execFileSync('gh', ['gist', 'create', '--public'].concat(gistFiles), {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000,
      }).trim();
      if (result.startsWith('http')) {
        gistUrl = result;
        log('Gist created: ' + gistUrl);
      }
    }
  } catch (e) {
    log('Gist upload failed: ' + (e.stderr ? e.stderr.toString().trim() : e.message));
  }
}

// ── Step 9: Build Discussion URL ────────────────────────────────

// Get Claude Code version
let ccVersion = 'unknown';
try {
  ccVersion = execFileSync('claude', ['--version'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
} catch (e) { /* ignore */ }

const windowList = results.map(w => w.date + ' ' + w.start + '-' + w.end).join(', ');
const totalCostAll = Math.round(results.reduce((s, w) => s + w.cost, 0) * 100) / 100;
const totalRequests = results.reduce((s, w) => s + w.requests, 0);
const totalSessions = new Set(results.flatMap(w => [...w.touchedFiles.timeline].map(f => path.basename(f)))).size;
const totalInput = results.reduce((s, w) => s + w.input, 0);
const totalOutput = results.reduce((s, w) => s + w.output, 0);
const totalCacheWrite = results.reduce((s, w) => s + w.cacheWrite, 0);
const totalCacheRead = results.reduce((s, w) => s + w.cacheRead, 0);
const today = new Date();
const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

// Discussion title (short — details go in body)
const title = '\u{1F480} Rate Limit Report (' + results.length + ' window' + (results.length > 1 ? 's' : '') + ') \u2014 $' + totalCostAll;

// Discussion body — unified window table (usage + metrics)
function buildWindowTable() {
  let table = '| Window | Duration | Cost | Reqs | Sessions | Peak Concurrent | Max Ctx/Session | Output | Cache Write (5m/1h) | Cache Read | Models |\n'
    + '|--------|----------|------|------|----------|-----------------|-----------------|--------|---------------------|------------|--------|\n';
  for (const w of results) {
    const m = w.metrics;
    table += '| ' + w.date + ' ' + w.start + '-' + w.end
      + ' | ' + m.activeDurationMin + 'min'
      + ' | $' + w.cost
      + ' | ' + w.requests
      + ' | ' + w.sessions
      + ' | ' + m.maxConcurrentSessions
      + ' | ' + fmtTokens(m.maxCrPerSession)
      + ' | ' + fmtTokens(w.output)
      + ' | ' + fmtTokens(m.cumCc5m) + ' / ' + fmtTokens(m.cumCc1h)
      + ' | ' + fmtTokens(w.cacheRead)
      + ' | ' + m.modelsUsed.length
      + ' |\n';
  }
  table += '| **Total** | '
    + ' | **$' + totalCostAll
    + '** | **' + totalRequests
    + '** | **' + totalSessions
    + '** | '
    + ' | '
    + ' | **' + fmtTokens(totalOutput)
    + '** | '
    + ' | **' + fmtTokens(totalCacheRead)
    + '** | |\n';
  return table;
}

const rawDataSection = gistUrl
  ? '\u{1F4CE} ' + gistUrl
  : (zipCreated
    ? '\u{1F4CE} Please attach: `' + zipFile + '`'
    : '\u{1F4CE} Please attach CSV files from: `' + reportDir + '/`');

let body = '## Rate Limit Data Point\n\n'
  + buildWindowTable() + '\n'
  + '## Raw Data\n'
  + rawDataSection + '\n\n'
  + '## Context\n'
  + '- Plan: ' + (plan ? PLAN_INFO[plan].label : 'unknown') + '\n'
  + '- Claude Code version: ' + ccVersion + '\n'
  + '- Date: ' + dateStr;

// Note about unknown rate limit types (only if any window has them)
if (results.some(w => w.hasUnknown)) {
  body += '\n\n> **Note:** Some rows contain `limit_hit_unknown` — the rate limit type could not be classified. Most likely 5h window limits, but may be weekly. Data is scoped to 5h windows regardless.';
}

// Sanitize: replace $HOME with ~, redact API keys
const homeDir = os.homedir();
const homeRegex = new RegExp(homeDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
body = body.replace(homeRegex, '~');
body = body.replace(/sk-ant-[a-zA-Z0-9_-]{20,}/g, '[REDACTED]');
body = body.replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED]');
body = body.replace(/(API_KEY|SECRET|TOKEN|PASSWORD)\s*=\s*\S+/gi, '$1=[REDACTED]');

// ── Step 10: Open Discussion URL in browser ────────────────────
const discussionUrl = 'https://github.com/' + REPO + '/discussions/new'
  + '?category=rate-limits'
  + '&title=' + encodeURIComponent(title)
  + '&body=' + encodeURIComponent(body);

let discussionOpened = false;
if (dryRun) {
  log('--dry-run: nothing uploaded or opened.\n\n# ' + title + '\n\n' + body + '\n\nDiscussion URL length: ' + discussionUrl.length);
} else {
  try {
    execFileSync('open', [discussionUrl], { stdio: 'pipe' });
    discussionOpened = true;
    log('Discussion opened in browser.');
  } catch (e) {
    log('Could not open browser. Discussion URL:\n' + discussionUrl);
  }
}

// ── Step 11: If gist failed, open containing directory in Finder ────────────
if (!gistUrl && !dryRun) {
  const openTarget = zipCreated ? path.dirname(zipFile) : reportDir;
  try {
    execFileSync('open', [openTarget], { stdio: 'pipe' });
    log('Opened directory in Finder: ' + openTarget);
  } catch (e) {
    log('Could not open Finder. Files at: ' + openTarget);
  }
}

// ── Step 12: Print JSON summary to stdout ───────────────────────
const summary = {
  windows: results.map(w => ({
    date: w.date,
    start: w.start,
    end: w.end,
    cost: w.cost,
    requests: w.requests,
    sessions: w.sessions,
    input: w.input,
    output: w.output,
    cacheWrite: w.cacheWrite,
    cacheRead: w.cacheRead,
    metrics: w.metrics,
  })),
  totalCost: totalCostAll,
  ghAuthenticated: ghAuthenticated,
  gistUrl: gistUrl,
  zipFile: zipCreated ? zipFile : null,
  reportDir: reportDir,
  discussionOpened: discussionOpened,
  dryRun: dryRun,
  discussionUrlLength: discussionUrl.length,
};

console.log(JSON.stringify(summary, null, 2));
