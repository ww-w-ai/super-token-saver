#!/usr/bin/env node
/**
 * report-limit.js — Standalone rate-limit reporter (zero LLM involvement)
 *
 * 1. Runs analyze-usage.js to ensure timeline CSVs exist
 * 2. Scans timeline CSVs for rate-limited windows
 * 3. Collects all rows within each 5h window, merges overlapping windows
 *    (2 and 3 run once per login account: each account gets its own windows and rows)
 * 4. Builds sessions.csv with hashed IDs and project mapping
 * 5. Merges ratelimit CSVs into one ratelimit.csv per account (dedup + sort)
 * 6. Uploads to GitHub gist + opens pre-filled Discussion URL — one report for all accounts
 * 7. Prints JSON summary to stdout
 *
 * Cache structure: ~/.claude/super-token-saver-data/{projectName}/{sessionId}/
 *   timeline.csv, ratelimit.csv, summary.json, subagents/{agentId}/...
 *
 * Codex (--host codex) takes another path after step 1: lib/report-limit-codex.js reads the
 * limit windows Codex reports. Steps 7–12 (zip, gist, Discussion, JSON) are lib/report-publish.js.
 *
 * Usage: node report-limit.js [--host claude|codex] [--plan <plan>] [--date <YYYY-MM-DD> | --blocked] [--dry-run]
 *   --host     claude (default) or codex
 *   --plan     pro|max100|max200|team|team_premium|enterprise|bedrock|foundry|vertex (Claude Code)
 *   (default)  every 5h window of the last 7 days, rate-limited or not
 *   --date     every 5h window overlapping that date
 *   --blocked  only rate-limited windows, across all cached data
 *   --dry-run  build the report and print it; no gist upload, no browser
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { buildGlobalTsMapper, assignWindows, FIVE_HOURS_S } = require('./lib/window-utils');
const { listProjects, listSessions, listSubagents, getTimelinePath, getSubagentTimelinePath, getRatelimitPath, getSummaryPath, CACHE_BASE: CACHE_DIR, migrateFromYYMM } = require('./lib/cache-paths');
const { dropReplayedRequests } = require('./lib/request-dedup');
const { loadAccountIndex, accountOf, listAccounts } = require('./lib/accounts');
const { PLAN_INFO, VALID_PLANS } = require('./lib/plan-info');
const { log, makeReportDir, accountHeading, toolVersion, pluginVersion, publishReport } = require('./lib/report-publish');
const { summarizeWindow, buildWindowTable, writeWindowFiles, isGistFile, roundCost } = require('./lib/report-window');

const SCRIPTS_DIR = __dirname;

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

const hostIdx = process.argv.indexOf('--host');
const host = hostIdx !== -1 ? process.argv[hostIdx + 1] : 'claude';
if (host !== 'claude' && host !== 'codex') {
  log('Invalid host: ' + host + '. Valid: claude, codex');
  process.exit(1);
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
  execFileSync('node', [path.join(SCRIPTS_DIR, 'analyze-usage.js'), '--host', host], {
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

// Codex states its limits outright; its report is built from those samples.
// A module-level return, not process.exit: exit can cut the JSON summary short on a pipe.
if (host === 'codex') {
  require('./lib/report-limit-codex').reportCodexLimits({ range, blockedOnly, dryRun });
  return;
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

// A limit belongs to one login account. With two or more accounts on record, every account
// gets its own section of the one report: its windows are drawn from its own resets and
// activity, and its rows and ratelimit.csv hold only its own requests. Accounts appear as
// "Account 1" (the current login), "Account 2", … — never as hashes, since the report is public.
// Rows with no account record count as the current login's.
const accountEntries = [];
for (const proj of projects) {
  for (const sess of listSessions(proj)) {
    try {
      const summary = JSON.parse(fs.readFileSync(getSummaryPath(proj, sess), 'utf8'));
      if (summary.accountChanges) accountEntries.push({ sessionId: sess, changes: summary.accountChanges });
    } catch { /* no summary: session keeps the global account at its time */ }
  }
}
const accountIndex = loadAccountIndex(accountEntries);
// null stands for "the only account": every row is its row, and file names carry no prefix.
const accounts = accountIndex.filtering ? listAccounts(accountIndex) : [null];

// Session tag → project, and subagent tag → main session. Shared by every account's section.
const sessionProjectMap = new Map();
const sessionParent = new Map();
for (const proj of projects) {
  for (const sess of listSessions(proj)) {
    sessionProjectMap.set(sess, proj);
    for (const agent of listSubagents(proj, sess)) {
      sessionProjectMap.set('agent-' + agent, proj);
      sessionParent.set('agent-' + agent, sess);
    }
  }
}

function readCsvLines(csvPath) {
  if (!fs.existsSync(csvPath)) return [];
  const content = fs.readFileSync(csvPath, 'utf8').trim();
  return content ? content.split('\n') : [];
}

const isLimitHit = (rl) => rl.startsWith('limit_hit_5h') || rl.startsWith('limit_hit_unknown');

/**
 * The account's timeline rows in [start, end), with the same exclusions as /usage-view:
 * a replayed request (resume/fork copies) counts once, and another account's rows are left out.
 * Replays are judged across every account's timelines, before the account cut.
 * @returns {{rows: Array<{ts: number, req: string, cols: string[], tag: string}>, tagFile: Map<string, string>}}
 */
function loadAccountRows(keep, start, end) {
  const timelines = new Map(); // session tag → [{ ts, req, cols }]
  const tagFile = new Map();   // session tag → timeline path
  const tagParent = new Map(); // session tag → main session id (accounts are per main session)
  const loadTimeline = (filePath, tag) => {
    const lines = readCsvLines(filePath);
    const out = [];
    let prevModel = '';
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 11) continue;
      // Fill sparse model only (win is left as-is per original CSV)
      if (cols[1]) prevModel = cols[1]; else cols[1] = prevModel;
      const ts = Number(cols[0]);
      if (ts < start || ts >= end) continue;
      out.push({ ts, req: cols[13] || '', cols });
    }
    if (out.length) { timelines.set(tag, out); tagFile.set(tag, filePath); }
  };
  for (const proj of projects) {
    for (const sess of listSessions(proj)) {
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

  const rows = [];
  for (const [tag, list] of timelines) {
    for (const r of list) {
      if (keep(tagParent.get(tag), r.ts)) rows.push({ ...r, tag });
    }
  }
  rows.sort((a, b) => a.ts - b.ts);
  return { rows, tagFile };
}

/**
 * The account's /usage snapshots in [start, end). Concurrent sessions record the same
 * snapshots, so rows are merged, sorted, and kept only where the 5h or 7d % changes.
 * Another account's % would interleave with this one's and break that dedup.
 * ratelimit.csv only exists for sessions after setup-statusline; absence is normal.
 * @returns {string[]} CSV rows without header
 */
function mergeRatelimitRows(keep, start, end) {
  const allRows = new Set();
  for (const proj of projects) {
    for (const sess of listSessions(proj)) {
      const lines = readCsvLines(getRatelimitPath(proj, sess));
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue;
        const ts = Number(lines[i].split(',')[0]);
        if (ts >= start && ts < end && keep(sess, ts)) allRows.add(lines[i]);
      }
    }
  }
  const sorted = [...allRows].sort((a, b) => Number(a.split(',')[0]) - Number(b.split(',')[0]));
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
  // Fill the first row's missing reset values (the cut may start mid-stream)
  // from the nearest values anywhere in the sorted source rows.
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
  return deduped;
}

/**
 * One account's section: steps 2 to 4 of the pipeline, limited to that account.
 * Every row gets exactly one window, assigned the way /usage-view assigns it (the account's
 * own ratelimit windows, then 5h blocks for the rest), so no row is counted in two windows.
 * --blocked keeps windows holding a limit hit; otherwise windows overlapping the range.
 * A window overlapping the range starts less than 5h before it, so rows load from there.
 * @param {string|null} account hash, or null for the only account
 * @returns {{results: object[], ratelimitRows: string[]}}
 */
function buildAccountSection(account) {
  const keep = account === null ? () => true : (sess, ts) => accountOf(accountIndex, sess, ts) === account;
  const { rows, tagFile } = blockedOnly
    ? loadAccountRows(keep, -Infinity, Infinity)
    : loadAccountRows(keep, range.start - FIVE_HOURS_S, range.end);
  // An early reset ends the window where the next one starts (splitOverlaps): merged, one 5h
  // label held 9.5 h of requests. /usage-view splits the same way.
  const mapper = buildGlobalTsMapper(account === null ? undefined : keep, { splitOverlaps: true });
  assignWindows(rows, mapper.tsToWindow);
  const endOf = new Map(mapper.windows.map(w => [w.start, w.end]));
  const windowEnd = (start) => endOf.get(start) || start + FIVE_HOURS_S;

  const byWindow = new Map(); // window start → its rows, in ts order
  for (const r of rows) {
    if (!byWindow.has(r.win)) byWindow.set(r.win, []);
    byWindow.get(r.win).push(r);
  }
  const rlOf = (r) => r.cols[10] || '';
  const starts = [...byWindow.keys()].sort((a, b) => a - b).filter(start => blockedOnly
    ? byWindow.get(start).some(r => isLimitHit(rlOf(r)))
    : start < range.end && windowEnd(start) > range.start);
  if (starts.length === 0) return { results: [], ratelimitRows: [] };

  const results = starts.map(start => {
    const kept = byWindow.get(start);
    const hasUnknown = kept.some(r => rlOf(r).startsWith('limit_hit_unknown'));
    return summarizeWindow(start, windowEnd(start), kept, tagFile, hasUnknown);
  });
  return { results, ratelimitRows: mergeRatelimitRows(keep, starts[0], windowEnd(starts[starts.length - 1])) };
}

// ── Steps 2–4: one section per account ──
const sections = [];
accounts.forEach((account, i) => {
  const label = account === null ? null : i + 1; // 1 = current login (listAccounts puts it first)
  const section = buildAccountSection(account);
  log((label ? 'Account ' + label + (label === 1 ? ' (current login)' : '') + ': ' : '')
    + section.results.length + ' window(s) (' + (blockedOnly ? 'rate-limited only' : range.label) + ').');
  if (section.results.length > 0) sections.push({ label, filePrefix: label ? 'account' + label + '-' : '', ...section });
});

if (sections.length === 0) {
  if (blockedOnly) {
    log('No rate-limited windows found in cached data. Run /usage-view first to analyze all sessions, then try again.');
  } else {
    log('No data found for ' + range.label + '. Run /usage-view first.');
  }
  process.exit(0);
}
const results = sections.flatMap(s => s.results);

// ── Step 5: Build session index & write per-window CSV files ────
const reportDir = makeReportDir();

writeWindowFiles(reportDir, sections, { sessionProjectMap, sessionParent });

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

for (const section of sections) {
  if (section.ratelimitRows.length === 0) continue;
  fs.writeFileSync(path.join(reportDir, section.filePrefix + 'ratelimit.csv'),
    'ts,5h,5h_reset,7d,7d_reset,alert,version\n' + section.ratelimitRows.join('\n') + '\n');
}

// ── Step 9: Discussion title and window tables ──
const totalCostAll = roundCost(results.reduce((s, w) => s + w.cost, 0));
const today = new Date();
const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

// Discussion title (short — details go in body)
const title = '\u{1F480} Rate Limit Report (' + results.length + ' window' + (results.length > 1 ? 's' : '')
  + (sections.length > 1 ? ', ' + sections.length + ' accounts' : '') + ') \u2014 $' + totalCostAll;

// Discussion body — one window table (usage + metrics) per account
const planLabel = plan ? PLAN_INFO[plan].label : 'unknown';
const unknownNote = results.some(w => w.hasUnknown)
  ? '\n\n> **Note:** Some rows contain `limit_hit_unknown` — the rate limit type could not be classified. Most likely 5h window limits, but may be weekly. Data is scoped to 5h windows regardless.'
  : '';

// ── Steps 7–12: zip, gist, Discussion, JSON summary ──
publishReport({
  reportDir,
  dryRun,
  title,
  isGistFile,
  buildBody: (rawDataLine) => '## Rate Limit Data Point\n\n'
    + sections.map(s => (s.label ? '### ' + accountHeading(s.label) + '\n\n' : '') + buildWindowTable(s.results)).join('\n') + '\n'
    + '## Raw Data\n'
    + rawDataLine + '\n\n'
    + '## Context\n'
    + (sections[0].label
      ? '- Plan: ' + planLabel + ' (Account 1, current login; other accounts not given)\n'
        + '- Accounts: each has its own 5h windows and rows; files are prefixed `accountN-`\n'
      : '- Plan: ' + planLabel + '\n')
    + '- Claude Code version: ' + toolVersion('claude') + '\n'
    + '- super-token-saver version: ' + pluginVersion() + '\n'
    + '- Date: ' + dateStr
    + unknownNote,
  summary: {
    host: 'claude',
    accounts: sections.map(s => ({
      account: s.label,
      windows: s.results.length,
      cost: roundCost(s.results.reduce((sum, w) => sum + w.cost, 0)),
      ratelimitRows: s.ratelimitRows.length,
    })),
    windows: sections.flatMap(s => s.results.map(w => ({
      account: s.label,
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
    }))),
    totalCost: totalCostAll,
  },
});
