#!/usr/bin/env node
/**
 * build-report.js — HTML dashboard builder
 *
 * Reads analyze-usage.js output (JSON) + timeline CSVs + ratelimit CSVs,
 * constructs REPORT_DATA, and injects it into the template.html dashboard.
 * Also generates an AI analysis prompt for LLM-powered insights.
 *
 * Win correction: Uses actual 5h window boundaries from ratelimit CSVs
 * (5h_reset column) to correct hourFloor-based wins in timeline CSVs.
 *
 * v1.4.0 compact-timeline-separation — user-turn aggregation:
 *   1. compact.txt (preprocess.js) supplies user-side markers only
 *   2. timeline.csv (analyze-usage.js) supplies per-API-call cost + markers
 *   3. buildAlertsFromUserTurns joins the two streams by JSONL line number,
 *      aggregating ALL assistant rows between user line Lu and Lu+1 into a
 *      single alert with totalCost, turnCount, and turnBreakdown. This fixes
 *      the nearest-timestamp 1:1 underreporting bug for tool-heavy turns.
 *   4. generateMissingCompacts now checks mtime (not just existence) so
 *      stale compact.txt from mid-session runs is regenerated.
 *
 * ALERT_LINE_RE: Simplified regex — all markers captured as one group,
 * then parsed individually via string matching.
 *
 * Usage: node build-report.js [options]
 *   --data <path>           analyze-usage.js JSON output (required unless --import-data)
 *   --output <path>         Output HTML file path (required)
 *   --current               Current 5-hour window mode (session detail pre-opened)
 *   --ai-data <path>        AI analysis JSON to inject into report
 *   --export-prompt <path>  Export AI analysis prompt to file (for agent consumption)
 *   --export-data <path>    Export REPORT_DATA as JSON (for --import-data)
 *   --import-data <path>    Import pre-built REPORT_DATA instead of building from CSVs
 *   --locale <code>         Force locale (default: system language → en fallback)
 *   --plan <plan>           Plan tier for AI prompt context (pro|max100|max200|...)
 *   --project <name>        Project name (hashed CWD) to scope report to single project
 *
 * Input:
 *   - analyze-usage.js JSON output (--data)
 *   - ~/.claude/super-token-saver-data/{projectName}/{sessionId}/timeline.csv   (per-API-call data)
 *   - ~/.claude/super-token-saver-data/{projectName}/{sessionId}/ratelimit.csv  (statusline rate limit logs)
 *   - skills/usage-view/template.html                              (dashboard template)
 *   - locales/{code}.json                                          (i18n strings)
 *
 * Output:
 *   - Self-contained HTML file with inline CSS/JS, Chart.js CDN
 *   - REPORT_DATA object: windows (5h buckets), calendar, cost/token aggregates
 *     - windows[].rlHours: hours within window where limit_hit occurred (renders as skulls on calendar)
 *     - windows[].alertMessages: from ratelimit CSVs (5h threshold crossings)
 *
 * v1.4.1: report-limit fixes, hourly avg by active days, cache read alert i18n
 * v1.4.2: bubble chart, model colors, price lines, dual avg
 * v1.4.3: partial-hour normalization, DOW boundary merge, cost thresholds centralized
 * v1.4.4: Korean text translated, LLM prompt accuracy improvements
 *
 * Supported locales (23): en ko ja zh es fr de pt it ru ar hi bn id ms th vi tr pl nl he sv no
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { buildGlobalWindowMap, buildGlobalTsMapper, FIVE_HOURS_S } = require('./lib/window-utils');
const { forHost, migrateFromYYMM, extractProjectName, projectNameFromCwd, CACHE_BASE: CACHE_DIR } = require('./lib/cache-paths');
const { PLAN_INFO: PLAN_INFO_ALL, CODEX_PLAN_INFO, resolveCodexPlanChoice } = require('./lib/plan-info');
const { round2 } = require('./lib/format');
const { SUPPORTED_LOCALES, resolveLocale } = require('./lib/locale');
const { MODEL_PRICING, DEFAULT_PRICING, getRates } = require('./lib/pricing');
const { selectLongestRateLimitLane, clusterUsagePointsByModel, computeCodexCreditEquivalent } = require('./lib/codex-usage');
const _subagentSep = /[/\\]subagents[/\\]/;
function isSubagentSession(session) {
  return !!(session && (session.isSubagent === true || (session.filePath && _subagentSep.test(session.filePath))));
}
const TEMPLATE_PATH = path.join(__dirname, '..', 'skills', 'usage-view', 'template.html');
const LOCALES_DIR = path.join(__dirname, '..', 'locales');
const CODEX_CREDIT_PRICING_PATH = path.join(__dirname, 'codex-credit-pricing.json');

// ── Cost thresholds (used in alerts + AI prompt) ────────────────
const TURN_COST_WARN = 0.80;   // per-user-turn cost warning
const TURN_COST_DANGER = 2.50; // per-user-turn cost danger
const DEFAULT_COST_FILTER = 0.80; // calendar detail panel default filter

// ── Args ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let dataPath = null, outputPath = null, currentMode = false, aiDataPath = null, exportPromptPath = null, exportDataPath = null, importDataPath = null, localeArg = null, planArg = null, projectFilter = null, privateMode = false, hostArg = 'claude';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--data' && args[i + 1]) { dataPath = args[++i]; }
  else if (args[i] === '--output' && args[i + 1]) { outputPath = args[++i]; }
  else if (args[i] === '--current') { currentMode = true; }
  else if (args[i] === '--ai-data' && args[i + 1]) { aiDataPath = args[++i]; }
  else if (args[i] === '--export-prompt' && args[i + 1]) { exportPromptPath = args[++i]; }
  else if (args[i] === '--export-data' && args[i + 1]) { exportDataPath = args[++i]; }
  else if (args[i] === '--import-data' && args[i + 1]) { importDataPath = args[++i]; }
  else if (args[i] === '--locale' && args[i + 1]) { localeArg = args[++i]; }
  else if (args[i] === '--plan' && args[i + 1]) { planArg = args[++i]; }
  else if (args[i] === '--project' && args[i + 1]) { projectFilter = args[++i]; }
  else if (args[i] === '--private') { privateMode = true; }
  else if (args[i] === '--host' && args[i + 1]) { hostArg = args[++i]; }
}

// Codex has no pricing table and no fixed 5h window — everything else
// (charts, calendar, session detail, i18n, privacy mode) is the same
// pipeline and the same template.html as Claude Code. `isCodex` gates only
// the handful of spots below that are genuinely host-specific: skip
// Anthropic-pricing math, use a dynamic rate-limit window instead of
// FIVE_HOURS_S, and mark cost as absent rather than zero in REPORT_DATA.
const isCodex = hostArg === 'codex';
// Every cache lookup below goes through the host's own sub-tree.
const hostPaths = forHost(isCodex ? 'codex' : 'claude');

// Every cost figure in this file is computed by multiplying raw token counts
// by getRates(model) — Codex model ids (e.g. "gpt-5.6-sol") aren't in
// MODEL_PRICING, so getRates() would silently fall back to DEFAULT_PRICING
// (Anthropic rates) and multiply real Codex token counts by them, fabricating
// a dollar figure the contract explicitly forbids. Routing every call site
// through this one function means "isCodex → zero rates" is a single choke
// point instead of an `if` at each of the ~6 places cost gets computed.
const ZERO_RATES = { input: 0, output: 0, cacheCreate5m: 0, cacheCreate1h: 0, cacheRead: 0, contextWindow: DEFAULT_PRICING.contextWindow };
function ratesFor(model) { return isCodex ? ZERO_RATES : getRates(model); }
function usageTokens(row) { return (row.input || 0) + (row.cc5m || 0) + (row.cc1h || 0) + (row.cr || 0) + (row.out || 0); }
function detailUsageTokens(row) { return (row.input || 0) + (row.cache5m || 0) + (row.cache1h || 0) + (row.cacheRead || 0) + (row.output || 0); }

const resolvedLocale = resolveLocale(localeArg);
let localeData;
try {
  localeData = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, resolvedLocale + '.json'), 'utf8'));
} catch (e) {
  localeData = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'));
}
// Force technical content to English (prevents mixed-language bidi issues in charts/tables/alerts)
// Only section headings (header.title, token.detail, token.costRatio, chart titles, calendar.title, ai.*) stay localized
if (resolvedLocale !== 'en') {
  const en = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'));
  // Token data labels — appear in charts & tables
  Object.assign(localeData.token, {
    cache1hTier: en.token.cache1hTier, cache5mTier: en.token.cache5mTier
  });
  // Chart data labels (day names, avg/max, hour suffix, legend, efficiency notes)
  Object.assign(localeData.chart, {
    hourSuffix: en.chart.hourSuffix,
  });
  // Alert & session: use bidi marks in locale files instead (he.json, ar.json)
}

// Bidi post-processor: wrap English terms with LRM/RLM in RTL text
const isRTL = localeData.meta && localeData.meta.direction === 'rtl';
function addBidiMarks(text) {
  if (!isRTL || typeof text !== 'string') return text;
  // Match: /commands, English words (incl. hyphenated/dotted like super-token-saver, c0d.run)
  return text.replace(/(\/[\w-]+|[A-Za-z][\w.-]*(?:\s+[A-Za-z][\w.-]*)*)/g, '\u200E$1\u200F');
}
function addBidiToAI(aiAnalysis) {
  if (!aiAnalysis) return;
  for (const key of ['section1', 'section2', 'section3', 'section4']) {
    if (typeof aiAnalysis[key] === 'string') {
      aiAnalysis[key] = addBidiMarks(aiAnalysis[key]);
    }
  }
}

if ((!dataPath && !importDataPath) || !outputPath) {
  console.error('Usage: node build-report.js --data <results.json> --output <report.html>');
  process.exit(1);
}

// ── i18n injection helper ──────────────────────────────────────
function injectI18N(html) {
  const i18nStart = '/*<!-- I18N_START -->*/';
  const i18nEnd = '/*<!-- I18N_END -->*/';
  const si = html.indexOf(i18nStart);
  const ei = html.indexOf(i18nEnd);
  if (si === -1 || ei === -1) return html;
  return html.slice(0, si) +
    i18nStart + '\nconst I18N = ' + JSON.stringify(localeData, null, 0) + ';\n' + i18nEnd +
    html.slice(ei + i18nEnd.length);
}

function injectHtmlLang(html) {
  const dir = localeData.meta && localeData.meta.direction === 'rtl' ? ' dir="rtl"' : '';
  return html.replace(/<html lang="[^"]*"[^>]*>/, `<html lang="${resolvedLocale}"${dir}>`);
}

// ── Helpers ─────────────────────────────────────────────────────
function fsd(d) { return (d.getMonth() + 1) + '/' + d.getDate(); }
function fsdKey(d) { return d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0'); }
function ft(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function ym(ts) { const d = new Date(ts); return String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0'); }
function getParentId(filePath) {
  if (!filePath || !_subagentSep.test(filePath)) return null;
  return path.basename(filePath.split(_subagentSep)[0] + '.jsonl', '.jsonl');
}

function isProgrammatic(session) {
  if (isSubagentSession(session)) return false;
  if (session.userMsgs !== 1) return false;
  if (!session.firstUserMsg) return true;
  const patterns = [/^You are generating/, /^Read the /, /^Run the /, /^CRITICAL:/, /^Write the word/, /^Compare the /, /^This session is being continued/];
  return patterns.some(p => p.test(session.firstUserMsg));
}

// Acompact: auto-compact runs as a separate subagent under the parent session's
// subagents/ dir. Its directory name starts with "acompact-" (no "agent-" prefix).
// The transcript file name is agent-acompact-<id>.jsonl.
function isAcompactAgent(agentDirName) {
  return !!(agentDirName && agentDirName.startsWith('acompact-'));
}
function isAcompactSessionId(sessionId) {
  return !!(sessionId && (sessionId.startsWith('agent-acompact-') || sessionId.startsWith('acompact-')));
}

// ── Import mode: skip all processing, just inject into template ─
if (importDataPath) {
  const reportData = JSON.parse(fs.readFileSync(importDataPath, 'utf8'));
  if (aiDataPath) {
    try {
      const aiAnalysis = JSON.parse(fs.readFileSync(aiDataPath, 'utf8'));
      if (aiAnalysis.section1 || aiAnalysis.section2 || aiAnalysis.section3 || aiAnalysis.section4) {
        addBidiToAI(aiAnalysis);
        reportData.aiAnalysis = aiAnalysis;
        const count = [aiAnalysis.section1, aiAnalysis.section2, aiAnalysis.section3, aiAnalysis.section4].filter(Boolean).length;
        console.error('AI analysis: ' + count + ' sections loaded from ' + aiDataPath);
      }
    } catch (e) {
      console.error('AI analysis: failed to read ' + aiDataPath + ' - ' + e.message);
    }
  }
  let template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  template = injectI18N(template);
  template = injectHtmlLang(template);
  const marker_start = '/*<!-- REPORT_DATA_START -->*/';
  const marker_end = '/*<!-- REPORT_DATA_END -->*/';
  const startIdx = template.indexOf(marker_start);
  const endRaw = template.indexOf(marker_end);
  if (startIdx === -1 || endRaw === -1) {
    console.error('Error: REPORT_DATA markers not found in template');
    process.exit(1);
  }
  const endIdx = endRaw + marker_end.length;
  const jsonStr = JSON.stringify(reportData, null, 0).replace(/<\//g, '<\\/');
  const output = template.slice(0, startIdx) +
    marker_start + '\nconst REPORT_DATA = ' + jsonStr + ';\n' + marker_end +
    template.slice(endIdx);
  fs.writeFileSync(outputPath, output);
  console.error(`Report written to ${outputPath} (${output.length} bytes)`);
  process.exit(0);
}

// ── Load data ───────────────────────────────────────────────────
const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Window length used for the same grouping/calendar/"current mode" code that
// buckets Claude sessions into 5h windows. Claude's value never changes
// (FIVE_HOURS_S, byte-identical to before this file knew Codex existed);
// Codex's is carried as data (analyze-usage.js --host codex resolves it from
// the session's own rate_limits.primary.window_minutes, see summary.windowMinutes)
// rather than assumed — this is the one constant CODEX-PORT-BACKLOG.md calls
// out as the assumption that has to break first.
const canonicalScopeLane = isCodex ? selectLongestRateLimitLane(raw.canonicalRateLimits) : null;
const canonicalPrimaryMinutes = canonicalScopeLane ? Number(canonicalScopeLane.windowMinutes) : null;
const rateLimitWindowMinutes = Number(raw.rateLimitWindowMinutes) > 0
  ? Number(raw.rateLimitWindowMinutes)
  : (canonicalPrimaryMinutes > 0 ? canonicalPrimaryMinutes : null);
const calendarWindowMinutes = isCodex
  ? (Number(raw.calendarWindowMinutes) > 0 ? Number(raw.calendarWindowMinutes)
    : (Number(raw.summary && raw.summary.windowMinutes) > 0 && Number(raw.summary.windowMinutes) <= 1440 ? Number(raw.summary.windowMinutes) : 60))
  : FIVE_HOURS_S / 60;
const calendarWindowSource = isCodex
  ? (raw.calendarWindowSource || (rateLimitWindowMinutes && rateLimitWindowMinutes <= 1440 ? 'canonical_rate_limit' : 'analytics_fallback'))
  : 'claude_rate_limit';
const WINDOW_SECONDS = calendarWindowMinutes * 60;

// ── Read all timeline CSVs ──────────────────────────────────────
// CSV header: ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl
// sessionId may be passed with project context via _sessionProjectMap
const _sessionProjectMap = new Map(); // sessionId|agentId → { proj, parentSessionId? }

// Acompact cost attribution:
//   acompactCostByParent: Map<parentSessionId, Map<ctxSize, {cost, input, cc5m, cc1h, cr, out, callCount}>>
// Populated BEFORE main parent timelines are read so that compact:auto:<ctx> marker
// rows in parent timeline.csv can be enriched with the acompact subagent's total.
const acompactCostByParent = new Map();
// Fallback: parentSessionId -> [{firstTs, lastTs, totals, agentDirName}] for acompact
// subagents whose ctxSize couldn't be extracted. These are matched to parent marker
// rows by timestamp proximity during readTimelineCsv enrichment.
const acompactByParentNoCtx = new Map();

// ── Universal subagent cost dedup (v1.4.x) ─────────────────────
// CC's runForkedAgent writes parent conversation history into the subagent's
// sidechain. Replayed rows retain their ORIGINAL requestId, causing cost
// double-counting when subagents are summed. We drop any subagent timeline row
// whose requestId already appears in its parent's timeline. Handles acompact,
// aside_question, agentSummary, worktree forks uniformly.
// parentReqIdSets: Map<parentSessionId, Set<reqId>>  — populated lazily.
const parentReqIdSets = new Map();
function getParentReqIds(parentSessionId) {
  if (parentReqIdSets.has(parentSessionId)) return parentReqIdSets.get(parentSessionId);
  const info = _sessionProjectMap.get(parentSessionId);
  if (!info) { parentReqIdSets.set(parentSessionId, null); return null; }
  const csvPath = hostPaths.getTimelinePath(info.proj, parentSessionId);
  if (!csvPath || !fs.existsSync(csvPath)) { parentReqIdSets.set(parentSessionId, null); return null; }
  const set = new Set();
  try {
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n');
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 14) continue;
      const req = cols[13];
      if (req) set.add(req);
    }
  } catch {}
  parentReqIdSets.set(parentSessionId, set);
  return set;
}

function readTimelineCsv(sessionId) {
  // New structure: look up project from _sessionProjectMap
  const info = _sessionProjectMap.get(sessionId);
  if (!info) return [];
  let csvPath = null;
  if (info.parentSessionId) {
    // Subagent: timeline lives under parent session's subagents/ dir
    // Use agentDirName (without "agent-" prefix) for the actual directory path
    csvPath = hostPaths.getSubagentTimelinePath(info.proj, info.parentSessionId, info.agentDirName);
  } else {
    csvPath = hostPaths.getTimelinePath(info.proj, sessionId);
  }
  if (!csvPath || !fs.existsSync(csvPath)) return [];
  const content = fs.readFileSync(csvPath, 'utf8').trim();
  const lines = content.split('\n');
  if (lines.length < 2) return [];

  const rows = [];
  let prevModel = '';
  let prevWin = '';
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 11) continue;
    const model = cols[1] || prevModel;
    const win = cols[9] || prevWin;
    if (cols[1]) prevModel = cols[1];
    if (cols[9]) prevWin = cols[9];
    rows.push({
      ts: Number(cols[0]),
      model,
      input: Number(cols[2]),
      cc: Number(cols[3]),
      cc5m: Number(cols[4]),
      cc1h: Number(cols[5]),
      cr: Number(cols[6]),
      out: Number(cols[7]),
      cost: Number(cols[8]),
      win: Number(win),
      rl: cols[10] || '',
      evt: cols[11] || '',
      // v10: line column — no markers column (all event info lives in evt + rl).
      line: cols[12] ? Number(cols[12]) : 0,
      // v11: req column — API requestId used for universal subagent cost dedup.
      req: cols[13] || ''
    });
  }

  // Universal subagent cost dedup: drop rows whose requestId already appears
  // in the parent session's timeline. Zero-cost rows (events like compact
  // markers, rate limits) are ALWAYS kept since they have no req. Independent
  // subagents have 0 reqId overlap → no-op. Replay forks (acompact, aside_q,
  // worktree) retain only their NEW calls.
  if (info.parentSessionId) {
    const parentSet = getParentReqIds(info.parentSessionId);
    if (parentSet && parentSet.size > 0) {
      const kept = [];
      for (const r of rows) {
        if (r.req && parentSet.has(r.req)) continue;
        kept.push(r);
      }
      rows.length = 0;
      for (const r of kept) rows.push(r);
    }
  }

  // Enrich parent timeline rows: merge acompact subagent cost into
  // compact:auto:<ctxSize> marker rows (which have cost=0 in the parent).
  // Only runs for non-subagent reads. Subagent timelines are parsed as-is.
  if (!info.parentSessionId) {
    const byCtx = acompactCostByParent.get(sessionId);
    const noCtxList = acompactByParentNoCtx.get(sessionId);
    const usedNoCtx = new Set();
    const markerRe = /^compact:(?:auto|manual):(\d+)/;

    function mergeAgg(row, agg) {
      row.input += agg.input;
      row.cc += (agg.cc5m + agg.cc1h);
      row.cc5m += agg.cc5m;
      row.cc1h += agg.cc1h;
      row.cr += agg.cr;
      row.out += agg.out;
      row.cost += agg.cost;
      row.model = row.model || agg.model;
      row.mergedFromAcompact = true;
      row.acompactCallCount = (row.acompactCallCount || 0) + agg.callCount;
      row.acompactCost = (row.acompactCost || 0) + agg.cost;
    }

    // Pass 1: ctxSize-keyed exact match
    for (const row of rows) {
      if (!row.evt) continue;
      const m = row.evt.match(markerRe);
      if (!m) continue;
      if (byCtx) {
        const ctxSize = Number(m[1]);
        const agg = byCtx.get(ctxSize);
        if (agg) { mergeAgg(row, agg); continue; }
      }
    }

    // Pass 2: timestamp-proximity fallback for acompact agents with no ctxSize.
    // For each unmerged compact:auto row, pick the nearest no-ctx acompact
    // whose firstTs is within ±5min of the marker row's ts.
    if (noCtxList && noCtxList.length > 0) {
      for (const row of rows) {
        if (row.mergedFromAcompact) continue;
        if (!row.evt || !markerRe.test(row.evt)) continue;
        let bestIdx = -1, bestDelta = Infinity;
        for (let i = 0; i < noCtxList.length; i++) {
          if (usedNoCtx.has(i)) continue;
          const entry = noCtxList[i];
          const delta = Math.abs((entry.firstTs || 0) - row.ts);
          if (delta < bestDelta) { bestDelta = delta; bestIdx = i; }
        }
        if (bestIdx >= 0 && bestDelta <= 600) {
          mergeAgg(row, noCtxList[bestIdx]);
          usedNoCtx.add(bestIdx);
        }
      }
      // Pass 3: any remaining unmatched no-ctx entries — attach to the closest
      // real timeline row by timestamp (any row, not just compact markers).
      // This preserves cost totals even when the parent has no marker row.
      for (let i = 0; i < noCtxList.length; i++) {
        if (usedNoCtx.has(i)) continue;
        const entry = noCtxList[i];
        if (!entry.firstTs) continue;
        let bestIdx = -1, bestDelta = Infinity;
        for (let r = 0; r < rows.length; r++) {
          const delta = Math.abs(rows[r].ts - entry.firstTs);
          if (delta < bestDelta) { bestDelta = delta; bestIdx = r; }
        }
        if (bestIdx >= 0) {
          mergeAgg(rows[bestIdx], entry);
          usedNoCtx.add(i);
        }
      }
    }
  }
  return rows;
}

// Read a subagent's timeline.csv and return {ctxSize, model, totals}.
// Used for acompact attribution: aggregates the subagent's deduped cost and
// attaches it to the parent session's compact:auto:<ctxSize> marker row so
// the dashboard shows "compact summary call: $X.XX" on the compact event.
//
// v1.4.x: universal subagent cost dedup runs via parent reqId filtering in
// readTimelineCsv. Here we apply the same filter to eliminate parent-replay
// rows (CC's runForkedAgent writes FULL parent history into acompact sidechain).
// Remaining rows = genuinely new calls (usually the single summary call).
function readAcompactAggregate(proj, parentSessionId, agentDirName) {
  const csvPath = hostPaths.getSubagentTimelinePath(proj, parentSessionId, agentDirName);
  if (!csvPath || !fs.existsSync(csvPath)) return null;
  const content = fs.readFileSync(csvPath, 'utf8').trim();
  const lines = content.split('\n');
  if (lines.length < 2) return null;
  const parentSet = getParentReqIds(parentSessionId);
  let ctxSize = null;
  let model = '';
  let firstTs = null, lastTs = null;
  const markerRe = /^compact:(?:auto|manual):(\d+)/;
  let input = 0, cc5m = 0, cc1h = 0, cr = 0, out = 0, cost = 0, callCount = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 11) continue;
    const evt = cols[11] || '';
    if (ctxSize === null) {
      const m = evt.match(markerRe);
      if (m) ctxSize = Number(m[1]);
    }
    if (cols[1]) model = cols[1];
    const ts = Number(cols[0]);
    if (ts) {
      if (firstTs === null || ts < firstTs) firstTs = ts;
      if (lastTs === null || ts > lastTs) lastTs = ts;
    }
    const req = cols[13] || '';
    // Drop parent-replay rows via reqId dedup.
    if (req && parentSet && parentSet.has(req)) continue;
    const rowCost = Number(cols[8]) || 0;
    const rowInput = Number(cols[2]) || 0;
    if (rowCost <= 0 && rowInput <= 0) continue; // skip event-only rows
    input += rowInput;
    cc5m += Number(cols[4]) || 0;
    cc1h += Number(cols[5]) || 0;
    cr += Number(cols[6]) || 0;
    out += Number(cols[7]) || 0;
    cost += rowCost;
    callCount++;
  }
  if (callCount === 0) return { ctxSize, model, totals: null, firstTs, lastTs };
  return {
    ctxSize,
    model,
    totals: { input, cc5m, cc1h, cr, out, cost, callCount },
    firstTs,
    lastTs,
  };
}

// Sessions the analyzer could not see because their transcript is gone, but
// whose analysis is still cached, are counted from the cache. Claude Code
// deletes transcripts after its retention period (and some vanish earlier);
// the spend happened either way, and summary.json is the same object the
// analyzer would have returned. Scoped to the report's own date range so a
// stale cache cannot widen the period.
{
  const known = new Set(raw.sessions.map((s) => s.sessionId));
  const fromTs = raw.summary && raw.summary.dateRange && raw.summary.dateRange.from
    ? new Date(raw.summary.dateRange.from).getTime() : 0;
  const wantHost = isCodex ? 'codex' : 'claude';
  const readSummary = (p) => {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
  };
  const accept = (s) => s && s.sessionId && !known.has(s.sessionId)
    && (s.host || 'claude') === wantHost
    && s.tokens && (!fromTs || !s.lastTs || new Date(s.lastTs).getTime() >= fromTs);
  let added = 0;
  const projects = projectFilter ? [projectFilter] : hostPaths.listProjects();
  for (const proj of projects) {
    for (const sess of hostPaths.listSessions(proj)) {
      if (known.has(sess) || isAcompactSessionId(sess)) continue;
      const s = readSummary(hostPaths.getSummaryPath(proj, sess));
      if (!accept(s)) continue;
      raw.sessions.push(s); known.add(s.sessionId); added++;
      for (const agent of hostPaths.listSubagents(proj, sess)) {
        if (isAcompactAgent(agent)) continue;
        const a = readSummary(hostPaths.getSubagentSummaryPath(proj, sess, agent));
        if (!accept(a)) continue;
        raw.sessions.push(a); known.add(a.sessionId); added++;
      }
    }
  }
  if (added) process.stderr.write(`[build-report] ${added} cache-only session(s) counted (transcript no longer on disk)\n`);
}

// Build session lookup
const sessionMap = new Map();
for (const s of raw.sessions) {
  sessionMap.set(s.sessionId, s);
}

// Migrate old YYMM structure (idempotent)
migrateFromYYMM();

// Populate _sessionProjectMap by scanning new project/session structure
{
  const projects = projectFilter ? [projectFilter] : hostPaths.listProjects();
  for (const proj of projects) {
    const sessions = hostPaths.listSessions(proj);
    for (const sess of sessions) {
      _sessionProjectMap.set(sess, { proj });
      // Also map subagent IDs with parent session reference
      // hostPaths.listSubagents() returns directory names (e.g. "a3f8c62d612b97b5a")
      // but raw.sessions uses "agent-{id}" as sessionId — map both forms
      const agents = hostPaths.listSubagents(proj, sess);
      for (const agent of agents) {
        const info = { proj, parentSessionId: sess, agentDirName: agent };
        _sessionProjectMap.set(agent, info);
        _sessionProjectMap.set('agent-' + agent, info);

        // Acompact aggregation: for each acompact-* subagent, sum its timeline
        // totals and key by (parentSessionId, ctxSize) so readTimelineCsv can
        // merge this into the parent's compact:auto:<ctxSize> marker row.
        if (isAcompactAgent(agent)) {
          const agg = readAcompactAggregate(proj, sess, agent);
          if (agg && agg.totals && agg.totals.callCount > 0) {
            const entry = {
              input: agg.totals.input,
              cc5m: agg.totals.cc5m,
              cc1h: agg.totals.cc1h,
              cr: agg.totals.cr,
              out: agg.totals.out,
              cost: agg.totals.cost,
              callCount: agg.totals.callCount,
              model: agg.model,
              agentDirName: agent,
              firstTs: agg.firstTs,
              lastTs: agg.lastTs
            };
            if (agg.ctxSize !== null) {
              if (!acompactCostByParent.has(sess)) acompactCostByParent.set(sess, new Map());
              const byCtx = acompactCostByParent.get(sess);
              const existing = byCtx.get(agg.ctxSize);
              if (!existing || agg.totals.cost > existing.cost) byCtx.set(agg.ctxSize, entry);
            } else {
              // Fallback: no ctxSize — match by timestamp proximity later
              if (!acompactByParentNoCtx.has(sess)) acompactByParentNoCtx.set(sess, []);
              acompactByParentNoCtx.get(sess).push(entry);
            }
          }
        }
      }
    }
  }
}

// Authoritative project for every analyzed session: the transcript path, which is
// the same rule analyze-usage.js used to choose the cache dir. The directory scan
// above is last-project-wins, and statusline-logger.sh creates
// {proj}/{sid}/ratelimit.csv under every cwd a session `cd`s into, so a session
// that moved across worktrees was mapped to a dir with no timeline.csv and its
// entire cost vanished from the --all report (97 sessions, $7.2K over 26 days).
for (const s of raw.sessions) {
  if (isCodex) {
    // Codex: filePath is the rollout under CODEX_HOME (no /projects/ segment);
    // analyze-usage keys its cache dir by the hashed cwd, and every Codex
    // rollout — subagents included — is its own top-level session dir.
    // A summary without cwd (should not happen) keeps whatever the directory scan found.
    if (s.cwd) _sessionProjectMap.set(s.sessionId, { proj: projectNameFromCwd(s.cwd) });
    continue;
  }
  if (!s.filePath) continue;
  const proj = extractProjectName(s.filePath);
  if (!proj) continue;
  if (_subagentSep.test(s.filePath)) {
    const parentSessionId = path.basename(s.filePath.split(_subagentSep)[0]);
    const base = path.basename(s.filePath, '.jsonl');
    const agentDirName = base.startsWith('agent-') ? base.slice(6) : base;
    const info = { proj, parentSessionId, agentDirName };
    _sessionProjectMap.set(agentDirName, info);
    _sessionProjectMap.set('agent-' + agentDirName, info);
  } else {
    _sessionProjectMap.set(s.sessionId, { proj });
  }
}

// Collect all timeline rows, keyed by sessionId
// Skip acompact subagent sessions — their cost is now attributed to the
// parent's compact:auto marker row (merged in readTimelineCsv).
const allTimelines = new Map();
for (const s of raw.sessions) {
  if (isAcompactSessionId(s.sessionId)) continue;
  const rows = readTimelineCsv(s.sessionId);
  if (rows.length > 0) allTimelines.set(s.sessionId, rows);
}

// Flatten all rows for aggregation
const allRows = [];
for (const [, rows] of allTimelines) {
  for (const row of rows) allRows.push(row);
}

// ── Scan compact caches for alert messages ─────────────────────
// Simplified format: [L{n} User HH:MM:SS]{allMarkers} {text}
// Groups: 1=lineNum, 2=time (HH:MM or HH:MM:SS, optionally prefixed MM-DDT), 3=allMarkers (entire marker string), 4=text
// v1.4.0 compact-timeline-separation: compact.txt holds ONLY user-side markers:
//   @ / @@ (startup/clear)  + / ++ (manual/auto compact)  ~ (reload-plugins)
//   ! (model-change)        ^ / ^^ (/continue skill)
// Cost * / **, ctx # / ##, heuristic ?, rate-limit % are in timeline.csv's
// `markers` column and joined here by buildAlertsFromUserTurns.
// v6 compact format: [Session:{sid8} {ISO} L{lineNum}]{markers} User: "{text}"
// Groups: 1=ISO timestamp, 2=lineNum, 3=markers, 4=text (may contain inner quotes)
const ALERT_LINE_RE = /^\[Session:\w+ (\S+) L(\d+)\]([^\s]*)\s+User:\s*"(.*)/;

const { execFile } = require('child_process');
const PREPROCESS_PATH = path.join(__dirname, 'preprocess.js');
const PARALLEL_LIMIT = 5;

// Ensure compact caches are fresh. preprocess.js self-manages (version + mtime
// check, skip if fresh, write to cache if stale). We just call it for each session.
function ensureCompactCaches(sessionIds) {
  const tasks = [];
  for (const sid of sessionIds) {
    const sess = sessionMap.get(sid);
    if (!sess) continue;
    if (isSubagentSession(sess)) continue;
    if (!sess.filePath || !fs.existsSync(sess.filePath)) continue;
    tasks.push(sess.filePath);
  }
  if (tasks.length === 0) return Promise.resolve();

  let idx = 0;
  let running = 0;
  return new Promise((resolve) => {
    function next() {
      while (running < PARALLEL_LIMIT && idx < tasks.length) {
        const fp = tasks[idx++];
        running++;
        execFile('node', [PREPROCESS_PATH, fp], { timeout: 30000 }, () => {
          running--;
          if (idx >= tasks.length && running === 0) resolve();
          else next();
        });
      }
    }
    next();
  });
}

function readCompactAlerts(sessionId) {
  const sess = sessionMap.get(sessionId);
  if (!sess) return [];
  const info = _sessionProjectMap.get(sessionId);
  if (!info) return [];
  const compactPath = hostPaths.getCompactPath(info.proj, sessionId, false);
  if (!fs.existsSync(compactPath)) return [];

  // Old-format compacts are regenerated by generateMissingCompacts (version check).
  const content = fs.readFileSync(compactPath, 'utf8');
  const lines = content.split('\n');
  const alerts = [];

  // v1.4.0 compact-timeline-separation: compact.txt now holds only USER-SIDE
  // markers (@ @@ + ++ ~ ! ^ ^^). We emit ONE alert per USER line (even unmarked
  // ones) so that buildAlertsFromUserTurns can attach aggregated cost data from
  // timeline.csv. Unmarked user turns with no interesting cost aggregation are
  // filtered out inside buildAlertsFromUserTurns (it returns a pruned list).
  for (const line of lines) {
    const m = ALERT_LINE_RE.exec(line);
    if (!m) continue;
    // v6 groups: 1=ISO timestamp, 2=lineNum, 3=markers, 4=text (trailing quote stripped)
    const markers = m[3] || '';
    const sessionMark = (markers.match(/@{1,2}/) || [''])[0];
    const compactMark = (markers.match(/\+{1,2}/) || [''])[0];
    const reloadMark = markers.includes('~') ? '~' : '';
    const modelMark = markers.includes('!') ? '!' : '';
    const contMark = (markers.match(/\^{1,2}/) || [''])[0];
    const text = (m[4] || '').replace(/"$/, '');

    const alertTypes = [];
    if (compactMark === '+') alertTypes.push('compact-manual');
    else if (compactMark === '++') alertTypes.push('compact-auto');
    if (reloadMark === '~') alertTypes.push('reload-plugins');
    if (modelMark === '!') alertTypes.push('model-change');
    if (contMark === '^') alertTypes.push('continue-1');
    else if (contMark === '^^') alertTypes.push('continue-n');
    if (sessionMark === '@') alertTypes.push('startup');
    else if (sessionMark === '@@') alertTypes.push('clear');

    alerts.push({
      sessionId,
      lineNum: Number(m[2]),
      time: m[1],
      markers: markers,
      text: text.slice(0, 300),
      alertType: alertTypes.join('+') || 'info',
      tokens: null,
      isInfoOnly: true,
      turnBreakdown: null,
      hasUserSideMarker: alertTypes.length > 0
    });
  }
  return alerts;
}

// v1.4.0 compact-timeline-separation — per user-turn aggregation.
//
// Joins user-side alerts (from compact.txt, via readCompactAlerts) with
// timeline.csv rows that fall into the same user turn (line-number range).
//
// For a user alert at JSONL line Lu, aggregates ALL timeline rows with
// row.line in [Lu+1, nextUserLine-1]. Total cost/tokens and the union of
// assistant-side markers are applied to the alert.
//
// This replaces the old nearest-timestamp 1:1 match that underreported
// multi-turn prompts (see docs/01-plan/features/compact-timeline-separation.plan.md).
// Per-session user turn aggregation cache.
// Key: sessionId. Value: Map<lineNum, turnAggregate> where turnAggregate has
// the aggregated tokens/cost/flags for one user turn.
// Single source of truth shared by buildAlertsFromUserTurns (alerts/badges) and
// buildContextCostScatters (per-user-turn chart). Computed once per session.
const _sessionUserTurnCache = new Map();

function computeSessionUserTurns(sessionId, userAlerts, timelineRows) {
  if (_sessionUserTurnCache.has(sessionId)) return _sessionUserTurnCache.get(sessionId);
  if (!userAlerts || userAlerts.length === 0 || !timelineRows || timelineRows.length === 0) {
    _sessionUserTurnCache.set(sessionId, { sortedAlerts: userAlerts || [], aggregates: new Map() });
    return _sessionUserTurnCache.get(sessionId);
  }
  const sortedAlerts = userAlerts.slice().sort((a, b) => a.lineNum - b.lineNum);
  const turnIdx = new Map();
  for (const a of sortedAlerts) turnIdx.set(a.lineNum, []);

  // For each timeline row, find the user alert that owns its turn via binary search.
  // Special case: compact:auto marker rows (merged from acompact) are emitted at
  // the line BEFORE the triggering user turn. Attribute them to the NEXT user
  // alert (the continuation prompt) so acompact cost shows up on the right turn.
  for (const row of timelineRows) {
    let rline = row.line || 0;
    if (rline <= 0) continue;
    if (row.mergedFromAcompact) rline = rline + 1;
    let lo = 0, hi = sortedAlerts.length - 1, found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (sortedAlerts[mid].lineNum <= rline) { found = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    if (found < 0) continue;
    turnIdx.get(sortedAlerts[found].lineNum).push(row);
  }

  const aggregates = new Map();
  for (const alert of sortedAlerts) {
    const rows = turnIdx.get(alert.lineNum) || [];
    if (rows.length === 0) continue;
    const agg = { input: 0, cc: 0, cc5m: 0, cc1h: 0, cr: 0, out: 0, cost: 0 };
    let hasCtxWarn = false, hasCtxDanger = false, hasHeuristic = false;
    const rlTypes = new Set();
    const breakdown = [];
    let acompactCostSum = 0, acompactCallSum = 0;
    let firstCtx = null;
    let maxCrRow = null; // track single API call with largest cache read
    let apiCallCount = 0;
    for (const row of rows) {
      if (row.mergedFromAcompact) {
        acompactCostSum += row.acompactCost || 0;
        acompactCallSum += row.acompactCallCount || 0;
      }
      if (row.cost > 0 || row.input > 0) {
        apiCallCount++;
        if (firstCtx === null) {
          firstCtx = (row.input || 0) + (row.cc || 0) + (row.cr || 0);
        }
        agg.input += row.input || 0;
        agg.cc += row.cc || 0;
        agg.cc5m += row.cc5m || 0;
        agg.cc1h += row.cc1h || 0;
        agg.cr += row.cr || 0;
        agg.out += row.out || 0;
        agg.cost += row.cost || 0;
        // Track the single API call with the largest context (input + cc + cr)
        const rowCtx = (row.input || 0) + (row.cc || 0) + (row.cr || 0);
        if (!maxCrRow || rowCtx > maxCrRow.ctx) {
          maxCrRow = { ctx: rowCtx, cr: row.cr || 0, cost: row.cost || 0 };
        }
        breakdown.push({ line: row.line, ts: row.ts, cost: row.cost, evt: row.evt || '', rl: row.rl || '', model: row.model || '' });
      }
      const evt = row.evt || '';
      if (evt.includes('ctx_danger')) hasCtxDanger = true;
      else if (evt.includes('ctx_warn')) hasCtxWarn = true;
      if (evt.includes('heuristic_resume')) hasHeuristic = true;
      if (row.rl) {
        const m = row.rl.match(/^limit_hit_(5h|weekly|opus|sonnet|extra|unknown)/);
        if (m) rlTypes.add(m[1]);
      }
    }
    aggregates.set(alert.lineNum, {
      alert, agg, hasCtxWarn, hasCtxDanger, hasHeuristic, rlTypes,
      breakdown, acompactCostSum, acompactCallSum, firstCtx, apiCallCount, maxCrRow
    });
  }
  const result = { sortedAlerts, aggregates };
  _sessionUserTurnCache.set(sessionId, result);
  return result;
}

function buildAlertsFromUserTurns(sessionId, userAlerts, timelineRows) {
  if (!userAlerts || userAlerts.length === 0) return userAlerts || [];
  if (!timelineRows || timelineRows.length === 0) {
    return userAlerts.filter(a => a.hasUserSideMarker);
  }
  const { sortedAlerts, aggregates } = computeSessionUserTurns(sessionId, userAlerts, timelineRows);

  for (const alert of sortedAlerts) {
    const turn = aggregates.get(alert.lineNum);
    if (!turn) continue;
    const { agg, hasCtxWarn, hasCtxDanger, hasHeuristic, rlTypes, breakdown, acompactCostSum, acompactCallSum, apiCallCount, maxCrRow } = turn;

    // Per-user-turn aggregated cost thresholds (higher than per-row because a
    // single user prompt can fan out to many assistant turns; $0.80/$2.50 cuts
    // noise vs the per-row $0.50/$1.00 banding).
    // TURN_COST_WARN, TURN_COST_DANGER defined at file top
    let hasCostWarn = false, hasCostDanger = false;
    if (agg.cost >= TURN_COST_DANGER) hasCostDanger = true;
    else if (agg.cost >= TURN_COST_WARN) hasCostWarn = true;

    const types = alert.alertType === 'info' ? [] : alert.alertType.split('+');
    if (hasCostDanger) types.push('cost-danger');
    else if (hasCostWarn) types.push('cost-warn');
    if (hasCtxDanger) types.push('ctx-danger');
    else if (hasCtxWarn) types.push('ctx-warn');
    if (hasHeuristic) types.push('resume-heuristic');
    for (const rl of rlTypes) types.push('rate-limit-' + rl);
    if (types.length > 0) {
      alert.alertType = types.join('+');
      if (hasCostWarn || hasCostDanger || hasCtxWarn || hasCtxDanger || rlTypes.size > 0) {
        alert.isInfoOnly = false;
      }
    }

    alert.tokens = {
      input: agg.input,
      cc: agg.cc,
      cc5m: agg.cc5m,
      cc1h: agg.cc1h,
      cr: agg.cr,
      out: agg.out,
      cost: Math.round(agg.cost * 10000) / 10000
    };
    alert.apiCallCount = apiCallCount;
    if (maxCrRow) {
      alert.peak = { ctx: maxCrRow.ctx, cr: maxCrRow.cr, cost: Math.round(maxCrRow.cost * 10000) / 10000 };
    }
    alert.turnBreakdown = breakdown;
    alert.turnCount = breakdown.length;
    if (acompactCostSum > 0) {
      alert.acompactCost = Math.round(acompactCostSum * 10000) / 10000;
      alert.acompactCallCount = acompactCallSum;
    }

    // Build short-form badge string from aggregated evt/rl state for template
    // rendering. alert.markers originally held compact.txt user-side markers
    // only; we append the assistant-side display badges here.
    const rlBadgeMap = { '5h':'%5', 'weekly':'%W', 'opus':'%O', 'sonnet':'%S', 'extra':'%X', 'unknown':'%%' };
    const assistMarks = [];
    if (hasCostDanger) assistMarks.push('**');
    else if (hasCostWarn) assistMarks.push('*');
    if (hasCtxDanger) assistMarks.push('##');
    else if (hasCtxWarn) assistMarks.push('#');
    if (hasHeuristic) assistMarks.push('?');
    for (const rl of rlTypes) assistMarks.push(rlBadgeMap[rl] || '%%');
    if (assistMarks.length > 0) {
      alert.markers = (alert.markers || '') + assistMarks.join('');
    }

    // Build readable prefix from both user-side and assistant-side markers.
    // Dual-encoding: short-form markers stay in alert.markers for rule-based
    // processing; readablePrefix provides human/LLM-readable labels for display.
    const prefixParts = [];
    // Re-parse user-side markers from alert.markers (set by readCompactAlerts)
    const um = alert.markers || '';
    if (um.includes('@@')) prefixParts.push('/clear');
    else if (um.includes('@')) prefixParts.push('(session start)');
    if (um.includes('++')) prefixParts.push('(autocompact)');
    else if (um.includes('+')) prefixParts.push('/compact');
    if (um.includes('~')) prefixParts.push('/reload-plugins');
    if (um.includes('!')) prefixParts.push('/model');
    if (um.includes('^^')) prefixParts.push('/continue (multi)');
    else if (um.includes('^') && !um.includes('^^')) prefixParts.push('/continue');
    // Assistant-side markers (from aggregated timeline data)
    if (hasCostDanger) prefixParts.push('💸$2.50+');
    else if (hasCostWarn) prefixParts.push('💸$0.80+');
    if (hasCtxDanger) prefixParts.push('📏ctx70%+');
    else if (hasCtxWarn) prefixParts.push('📏ctx35%+');
    if (hasHeuristic) prefixParts.push('?resume');
    for (const rl of rlTypes) {
      prefixParts.push('%' + ({ '5h':'5h', 'weekly':'W', 'opus':'O', 'sonnet':'S', 'extra':'X' }[rl] || rl));
    }
    if (prefixParts.length > 0) {
      alert.readablePrefix = prefixParts.join(' & ');
    }
  }

  // Prune: keep an alert if it has a user-side marker OR if aggregation
  // produced a cost/ctx/heuristic/rate-limit marker (isInfoOnly=false).
  // Unmarked turns with no interesting cost would otherwise flood the dashboard.
  return sortedAlerts.filter(a => a.hasUserSideMarker || a.isInfoOnly === false);
}

// Deprecated — replaced by buildAlertsFromUserTurns. Kept as a no-op shim
// because the window-building loop calls this per-alert; enrichment now
// happens in a single batch call earlier in the pipeline.
function matchAlertWithTimeline(_alert, _timelineRows) {
  // No-op: alerts are already enriched by buildAlertsFromUserTurns.
  return;
}

// Build context-vs-cost analysis data:
//   perAssistant    — scatter of every API call with cost >= $1 (shows clear slope)
//   perUserTurn     — scatter of every user turn with aggregated cost >= $4
//                     (shows the same pattern at turn-level granularity)
// dominantBreakdown — counts of $1+ API calls by dominant cost contributor,
//                     used by the AI prompt to highlight that cache_write drives
//                     nearly 100% of expensive calls.
//
// Each point carries marker badge, time, sid, text, token breakdown.
function buildContextCostScatters(allTimelines, sessionMap) {
  const USER_TURN_COST_FLOOR = 0;
  const points = [];        // per assistant API call
  const userTurnPoints = [];  // per user turn (aggregated)
  // Dominant-type counts across ALL $1+ calls (used by AI prompt, not chart).
  const dominantBreakdown = { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 };
  let maxX = 0;

  // Compose a short badge string from evt + rl for display (mirrors template.html).
  function evtRlToBadge(evt, rl) {
    const parts = (evt || '').split('|').filter(Boolean);
    let s = '';
    if (parts.indexOf('cost_danger') >= 0) s += '**';
    else if (parts.indexOf('cost_warn') >= 0) s += '*';
    if (parts.indexOf('ctx_danger') >= 0) s += '##';
    else if (parts.indexOf('ctx_warn') >= 0) s += '#';
    if (parts.indexOf('heuristic_resume') >= 0) s += '?';
    if (rl) {
      const m = rl.match(/^limit_hit_(5h|weekly|opus|sonnet|extra|unknown)/);
      if (m) {
        const map = { '5h':'%5','weekly':'%W','opus':'%O','sonnet':'%S','extra':'%X','unknown':'%%' };
        s += map[m[1]] || '%%';
      }
    }
    return s;
  }

  // Format MM-DD HH:MM from epoch seconds (local time).
  function fmtLocalTime(epochSec) {
    if (!epochSec) return '';
    const d = new Date(epochSec * 1000);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${mm}-${dd} ${hh}:${mi}`;
  }

  for (const [sessionId, rows] of allTimelines) {
    const sess = sessionMap.get(sessionId);
    if (!sess) continue;
    const shortSid = sessionId.replace(/^agent-/, '').slice(0, 8);

    // For per-assistant tooltips we want the enclosing user prompt's text
    // so the user can see "what prompt triggered this expensive call".
    // Subagents have no compact.txt → we'll fall back to the row's own data.
    const isSubagent = isSubagentSession(sess);
    let sortedUsers = [];
    let userAlerts = [];
    if (!isSubagent) {
      userAlerts = readCompactAlerts(sessionId) || [];
      sortedUsers = userAlerts.slice().sort((a, b) => a.lineNum - b.lineNum);
    }

    function findEnclosingUser(rline) {
      if (!sortedUsers.length || rline <= 0) return null;
      let lo = 0, hi = sortedUsers.length - 1, found = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (sortedUsers[mid].lineNum <= rline) { found = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      return found >= 0 ? sortedUsers[found] : null;
    }

    // Per-assistant: every real-turn row with cost >= $1 becomes a scatter point.
    // Separately, we count the dominant cost contributor for AI reporting.
    for (const row of rows) {
      if (row.cost <= 0 || row.input <= 0) continue;
      // Skip merged acompact rows — they aggregate 100-200 subagent calls into
      // a single synthetic row, which breaks the "cost per API call" semantics
      // (produces billion-token x-axis and hundreds-of-dollars y-axis outliers).
      if (row.mergedFromAcompact) continue;
      const ctx = (row.input || 0) + (row.cc || 0) + (row.cr || 0);
      if (ctx <= 0) continue;
      if (ctx > maxX) maxX = ctx;

      // Compute cost breakdown per token type using model pricing to classify
      // the dominant contributor — used ONLY for the breakdown counts fed to AI.
      const rates = ratesFor(row.model);
      const inputCost = (row.input || 0) * rates.input / 1e6;
      const outputCost = (row.out || 0) * rates.output / 1e6;
      const ccWriteCost =
        (row.cc5m || 0) * rates.cacheCreate5m / 1e6 +
        (row.cc1h || 0) * rates.cacheCreate1h / 1e6;
      const crReadCost = (row.cr || 0) * rates.cacheRead / 1e6;
      let dom = 'input', domCost = inputCost;
      if (outputCost > domCost) { dom = 'output'; domCost = outputCost; }
      if (ccWriteCost > domCost) { dom = 'cacheCreate'; domCost = ccWriteCost; }
      if (crReadCost > domCost) { dom = 'cacheRead'; domCost = crReadCost; }
      dominantBreakdown[dom]++;
      // CW: $0.05 floor; Non-CW: no floor (include all)
      const parent = findEnclosingUser(row.line || 0);
      points.push({
        x: ctx,
        y: Math.round(row.cost * 10000) / 10000,
        badge: evtRlToBadge(row.evt, row.rl),
        // Always use row.ts for accurate local-time conversion (parent.time is UTC text from compact.txt)
        time: fmtLocalTime(row.ts),
        sid: shortSid,
        text: parent ? (parent.text || '') : '',
        input: row.input,
        out: row.out,
        cc: (row.cc5m || 0) + (row.cc1h || 0),
        cr: row.cr,
        dom: dom,
        cw1hCost: Math.round((row.cc1h || 0) * rates.cacheCreate1h / 1e6 * 10000) / 10000,
        cw5mCost: Math.round((row.cc5m || 0) * rates.cacheCreate5m / 1e6 * 10000) / 10000,
        crCost: Math.round(crReadCost * 10000) / 10000,
        mdl: (row.model || '').includes('opus') ? 'O' : (row.model || '').includes('haiku') ? 'H' : 'S'
      });
    }

    // Per-user-turn chart points — reuse the shared cache (single source of
    // truth with buildAlertsFromUserTurns). Avoids re-computing the same
    // per-user-turn aggregates twice.
    if (isSubagent || sortedUsers.length === 0) continue;
    const sessionTurns = computeSessionUserTurns(sessionId, userAlerts, rows);
    for (const turn of sessionTurns.aggregates.values()) {
      if (turn.agg.cost < USER_TURN_COST_FLOOR) continue;
      if (turn.firstCtx === null || turn.firstCtx <= 0) continue;
      // Build display badge from per-turn aggregated state (mirrors what
      // buildAlertsFromUserTurns puts on alert.markers).
      const cost = turn.agg.cost;
      const badgeParts = [];
      if (cost >= 10.0) badgeParts.push('**');
      else if (cost >= USER_TURN_COST_FLOOR) badgeParts.push('*');
      if (turn.hasCtxDanger) badgeParts.push('##');
      else if (turn.hasCtxWarn) badgeParts.push('#');
      if (turn.hasHeuristic) badgeParts.push('?');
      for (const rl of turn.rlTypes) {
        const map = { '5h':'%5','weekly':'%W','opus':'%O','sonnet':'%S','extra':'%X','unknown':'%%' };
        badgeParts.push(map[rl] || '%%');
      }
      // Use the FIRST row's epoch ts for accurate local-time conversion.
      // turn.alert.time is the raw UTC text from compact.txt — not displayable.
      const firstRowTs = (turn.breakdown[0] && turn.breakdown[0].ts) || 0;
      userTurnPoints.push({
        x: turn.firstCtx,
        y: Math.round(turn.agg.cost * 10000) / 10000,
        badge: badgeParts.join(''),
        time: fmtLocalTime(firstRowTs),
        sid: shortSid,
        text: turn.alert.text || '',
        input: turn.agg.input,
        out: turn.agg.out,
        cc: turn.agg.cc,
        cr: turn.agg.cr,
        callCount: turn.breakdown.length,
        mdl: (() => { const m = (turn.breakdown[0] || {}).model || ''; return m.includes('opus') ? 'O' : m.includes('haiku') ? 'H' : 'S'; })()
      });
    }
  }

  // Simple least-squares linear regression over a point list.
  // Returns { slope, intercept, x0, x1 } for frontend to plot as a 2-point line.
  function linearTrend(points) {
    if (!points || points.length < 2) return null;
    let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    let x0 = Infinity, x1 = -Infinity;
    for (const p of points) {
      n++; sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y;
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
    }
    const denom = n * sxx - sx * sx;
    if (denom === 0) return null;
    const slope = (n * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / n;
    return { slope, intercept, x0, x1 };
  }

  // Grid-based density clustering: merge nearby points into bubbles.
  // N=100 grid cells per axis. Each bubble: {x, y, r, n, avgCost, minCost, maxCost, dom, texts[]}.
  // Single-point bubbles retain full detail for tooltip.
  function clusterPoints(pts, gridN) {
    if (!pts || pts.length === 0) return { bubbles: [], trend: null, totalCount: 0 };
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const p of pts) {
      if (p.x < xMin) xMin = p.x;
      if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 0.01;
    const cellW = xRange / gridN;
    const cellH = yRange / gridN;
    const cells = new Map();
    for (const p of pts) {
      const cx = Math.floor((p.x - xMin) / cellW);
      const cy = Math.floor((p.y - yMin) / cellH);
      const key = cx + ',' + cy;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(p);
    }
    const bubbles = [];
    for (const group of cells.values()) {
      const n = group.length;
      let sx = 0, sy = 0, minC = Infinity, maxC = -Infinity;
      const mdlCount = {};
      for (const p of group) {
        sx += p.x; sy += p.y;
        if (p.y < minC) minC = p.y; if (p.y > maxC) maxC = p.y;
        if (p.mdl) mdlCount[p.mdl] = (mdlCount[p.mdl] || 0) + 1;
      }
      const bx = Math.round(sx / n);
      const by = Math.round(sy / n * 10000) / 10000;
      const r = n <= 1 ? 2 : n <= 5 ? 4 : n <= 20 ? 7 : 10;
      // Dominant model in cluster
      let domMdl = 'O';
      let domMdlN = 0;
      for (const [m, c] of Object.entries(mdlCount)) { if (c > domMdlN) { domMdl = m; domMdlN = c; } }
      let totalCalls = 0;
      for (const p of group) totalCalls += (p.callCount || 1);
      const bubble = { x: bx, y: by, r, n, minCost: Math.round(minC * 100) / 100, maxCost: Math.round(maxC * 100) / 100, mdl: domMdl, calls: totalCalls };
      if (n === 1) {
        // Single-point: retain full detail
        const p = group[0];
        bubble.badge = p.badge; bubble.time = p.time; bubble.sid = p.sid;
        bubble.text = p.text; bubble.input = p.input; bubble.out = p.out;
        bubble.cc = p.cc; bubble.cr = p.cr;
      } else {
        // Multi-point: top 3 texts by cost
        const sorted = group.slice().sort((a, b) => b.y - a.y);
        bubble.topTexts = sorted.slice(0, 3)
          .map(p => ({ cost: Math.round(p.y * 100) / 100, text: (p.text || '').slice(0, 60), input: p.input, out: p.out, cc: p.cc, cr: p.cr, calls: p.callCount || 1 }));
      }
      bubbles.push(bubble);
    }
    return { bubbles, totalCount: pts.length };
  }

  // Split perAssistant points by dom for pre-clustered export
  const cwPoints = points.filter(p => p.dom === 'cacheCreate');
  const nonCwPoints = points.filter(p => p.dom !== 'cacheCreate');

  // Trend from a specific cost field (cwCost or crCost) instead of total y
  function componentTrend(pts, costField) {
    const mapped = pts.filter(p => p[costField] > 0).map(p => ({ x: p.x, y: p[costField] }));
    return linearTrend(mapped);
  }

  const cwClustered = clusterPoints(cwPoints, 50);
  const nonCwClustered = clusterPoints(nonCwPoints, 50);

  // Model pricing for reference lines — pass all 3 models so template can switch
  const pricingJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-pricing.json'), 'utf8'));
  const modelPricing = {};
  for (const [key, label] of [['claude-opus-4-6', 'Opus'], ['claude-sonnet-4-6', 'Sonnet'], ['claude-haiku-4-5-20251001', 'Haiku']]) {
    const m = pricingJson.models[key];
    if (m) modelPricing[label] = { cw1h: m.cacheCreate1h, cw5m: m.cacheCreate5m, cr: m.cacheRead };
  }
  cwClustered.modelPricing = modelPricing;
  nonCwClustered.modelPricing = modelPricing;

  // User Turn: also cluster
  const utClustered = clusterPoints(userTurnPoints, 50);

  return {
    perAssistant: {
      cw: cwClustered,
      nonCW: nonCwClustered,
      totalCount: points.length,
      dominantBreakdown
    },
    perUserTurn: {
      ...utClustered,
      totalCount: userTurnPoints.length,
      costFloor: USER_TURN_COST_FLOOR
    },
    maxX: Math.ceil(maxX * 1.1)
  };
}

function buildContextUsageScatters(allTimelines, sessionMap) {
  const assistant = [];
  const turns = [];
  let maxX = 0;
  for (const [sessionId, rows] of allTimelines) {
    const meta = sessionMap.get(sessionId);
    if (!meta) continue;
    for (const row of rows) {
      const y = usageTokens(row);
      const x = (row.input || 0) + (row.cc5m || 0) + (row.cc1h || 0) + (row.cr || 0);
      if (y <= 0 || x <= 0 || row.mergedFromAcompact) continue;
      maxX = Math.max(maxX, x);
      const parts = { input: row.input || 0, output: row.out || 0, cacheCreate: (row.cc5m || 0) + (row.cc1h || 0), cacheRead: row.cr || 0 };
      const dom = Object.entries(parts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
      assistant.push({ x, y, r: 3, n: 1, model: row.model || 'unknown', dom, sid: sessionId.slice(0, 8), input: parts.input, out: parts.output, cc: parts.cacheCreate, cr: parts.cacheRead, time: row.ts });
    }
    if (isSubagentSession(meta)) continue;
    const alerts = readCompactAlerts(sessionId) || [];
    const aggregates = computeSessionUserTurns(sessionId, alerts, rows).aggregates;
    for (const turn of aggregates.values()) {
      const y = (turn.agg.input || 0) + (turn.agg.out || 0) + (turn.agg.cc || 0) + (turn.agg.cr || 0);
      if (y <= 0 || !turn.firstCtx) continue;
      const model = (turn.breakdown[0] && turn.breakdown[0].model) || 'unknown';
      turns.push({ x: turn.firstCtx, y, r: 3, n: 1, model, sid: sessionId.slice(0, 8), text: turn.alert.text || '', input: turn.agg.input, out: turn.agg.out, cc: turn.agg.cc, cr: turn.agg.cr, calls: turn.breakdown.length });
    }
  }
  const pack = (points, cluster) => ({ bubbles: cluster ? clusterUsagePointsByModel(points, 50) : points, trend: null, totalCount: points.length });
  return {
    perAssistant: { cw: pack(assistant.filter((p) => p.dom === 'cacheCreate'), true), nonCW: pack(assistant.filter((p) => p.dom !== 'cacheCreate'), true), totalCount: assistant.length },
    perUserTurn: { ...pack(turns, false), costFloor: 0 },
    models: [...new Set(assistant.concat(turns).map((p) => p.model))].sort(),
    maxX: Math.ceil(maxX * 1.1),
  };
}

// ── Scoped session summary (shared by full mode and current mode) ──────
//
// A session is "visible" here only if it has at least one row with positive
// usage (isCodex: token-bearing; Claude: cost>0 — the same host split
// `usageTokens`/`row.cost` already use everywhere else in this file) AND
// that row is present in the CURRENT SCOPE, identified by `allRows`.
//
// Scope propagation is by OBJECT IDENTITY, not by re-filtering timestamps:
// `allTimelines` (per-session) is never truncated for current mode — only
// the flat `allRows` array is (see the current-mode block below, which
// does `allRows.length = 0; allRows.push(...filtered)` in place). Building
// a `Set(allRows)` and checking `inScope.has(row)` on each session's own
// row objects is what lets "full" and "current" share this ONE function:
// pass the full allRows for full-report scope, the filtered allRows for
// current-mode scope, same helper either way.
//
// This is a hard coupling: allTimelines and allRows MUST hold the exact
// same row objects by reference (never a clone/spread of a row), or the
// Set lookup silently drops every row as "out of scope" even though its
// values are identical — see the "cloned-row invariant" test in
// test-codex-usage.js, which deliberately breaks this and documents the
// resulting (correct, fail-closed) miscount rather than a crash.
//
// acompact subagents are excluded outright — their cost/tokens are folded
// into the parent session's compact:auto marker row (readTimelineCsv), so
// counting the acompact session itself as a second "visible session" would
// double it into the total.
//
// Also builds `attribution` (gap-remediation item 2, REPORT_DATA.sessionAttribution):
// main vs subtask token components (input/output/cacheWrite/cacheRead/total),
// with subtasks further split by agentRole and by model. Built in the SAME
// single pass as the session counts above (one Set, one walk of
// timelines/rows) rather than a second O(n) pass — not because a second
// linear pass would be quadratic, but because the classification (main vs
// subtask, role, model) is already known at that point in the loop and
// re-deriving it in a separate function would duplicate that logic.
// `integrity` cross-checks that main+subtasks reconstruct total, and that
// the byRole/byModel partitions reconstruct the subtasks total, component by
// component — a regression guard against a future edit that double-adds a
// row into more than one bucket, not merely a restatement of the arithmetic.
function computeScopedSessionSummary(scopedAllRows, timelines, sessionMapArg) {
  const inScope = new Set(scopedAllRows);
  let sessionCount = 0, mainSessionCount = 0, subtaskCount = 0;

  const zeroComponents = () => ({ input: 0, output: 0, cacheWrite: 0, cacheRead: 0, total: 0 });
  const totalAcc = zeroComponents(), mainAcc = zeroComponents(), subAcc = zeroComponents();
  const byRole = new Map(), byModel = new Map();
  const COMPONENT_KEYS = ['input', 'output', 'cacheWrite', 'cacheRead', 'total'];

  function addRow(acc, row) {
    const input = row.input || 0;
    const output = row.out || 0;
    const cacheWrite = (row.cc1h || 0) + (row.cc5m || 0);
    const cacheRead = row.cr || 0;
    acc.input += input; acc.output += output; acc.cacheWrite += cacheWrite; acc.cacheRead += cacheRead;
    acc.total += input + output + cacheWrite + cacheRead;
  }
  function bucketFor(map, key) {
    if (!map.has(key)) map.set(key, Object.assign(zeroComponents(), { sessions: 0 }));
    return map.get(key);
  }

  for (const [sessionId, rows] of timelines) {
    if (isAcompactSessionId(sessionId)) continue;
    const visibleRows = rows.filter((row) => inScope.has(row) && (isCodex ? usageTokens(row) > 0 : row.cost > 0));
    if (visibleRows.length === 0) continue;

    const meta = sessionMapArg.get(sessionId);
    const isSub = isSubagentSession(meta);
    sessionCount++;
    if (isSub) subtaskCount++;
    else mainSessionCount++;

    let roleBucket = null, modelBucket = null;
    if (isSub) {
      // "unknown" fallback: Codex subagents carry meta.agent.role; Claude
      // subagents carry meta.agentType (from the Task tool's subagent_type,
      // read off the CC meta.json — see analyze-usage.js). Neither is
      // guaranteed present.
      const role = (meta && ((meta.agent && meta.agent.role) || meta.agentType)) || 'unknown';
      const model = (meta && meta.model) || 'unknown';
      roleBucket = bucketFor(byRole, role);
      modelBucket = bucketFor(byModel, model);
      roleBucket.sessions++;
      modelBucket.sessions++;
    }

    for (const row of visibleRows) {
      addRow(totalAcc, row);
      if (isSub) { addRow(subAcc, row); addRow(roleBucket, row); addRow(modelBucket, row); }
      else addRow(mainAcc, row);
    }
  }

  function toSortedPlainObject(map) {
    const out = {};
    for (const key of [...map.keys()].sort()) out[key] = map.get(key);
    return out;
  }
  const byRoleObj = toSortedPlainObject(byRole);
  const byModelObj = toSortedPlainObject(byModel);
  const pctOf = (part, whole) => (whole > 0 ? round2((part / whole) * 100) : 0);

  const integrityErrors = [];
  for (const key of COMPONENT_KEYS) {
    if (mainAcc[key] + subAcc[key] !== totalAcc[key]) {
      integrityErrors.push(`component conservation failed for "${key}": main(${mainAcc[key]}) + subtasks(${subAcc[key]}) !== total(${totalAcc[key]})`);
    }
    const roleSum = Object.values(byRoleObj).reduce((s, b) => s + b[key], 0);
    if (roleSum !== subAcc[key]) integrityErrors.push(`byRole partition failed for "${key}": sum(${roleSum}) !== subtasks(${subAcc[key]})`);
    const modelSum = Object.values(byModelObj).reduce((s, b) => s + b[key], 0);
    if (modelSum !== subAcc[key]) integrityErrors.push(`byModel partition failed for "${key}": sum(${modelSum}) !== subtasks(${subAcc[key]})`);
  }
  if (mainSessionCount + subtaskCount !== sessionCount) integrityErrors.push('session count conservation failed: main + subtasks !== total');
  const roleSessionSum = Object.values(byRoleObj).reduce((s, b) => s + b.sessions, 0);
  if (roleSessionSum !== subtaskCount) integrityErrors.push('byRole session-count partition failed: sum !== subtasks');
  const modelSessionSum = Object.values(byModelObj).reduce((s, b) => s + b.sessions, 0);
  if (modelSessionSum !== subtaskCount) integrityErrors.push('byModel session-count partition failed: sum !== subtasks');

  const attribution = {
    total: { ...totalAcc, sessions: sessionCount },
    main: { ...mainAcc, sessions: mainSessionCount, pct: pctOf(mainAcc.total, totalAcc.total) },
    subtasks: { ...subAcc, sessions: subtaskCount, pct: pctOf(subAcc.total, totalAcc.total), byRole: byRoleObj, byModel: byModelObj },
    integrity: { ok: integrityErrors.length === 0, errors: integrityErrors },
  };

  return { sessionCount, mainSessionCount, subtaskCount, attribution };
}

// ── Build REPORT_DATA ───────────────────────────────────────────
(async () => {

// 1. summary
const sm = raw.summary;
const fromD = new Date(sm.dateRange.from);
const toD = new Date(sm.dateRange.to);
const fromDate = new Date(fromD.getFullYear(), fromD.getMonth(), fromD.getDate());
const toDate = new Date(toD.getFullYear(), toD.getMonth(), toD.getDate());
const days = Math.round((toDate - fromDate) / 86400000) + 1;
// Full-report scope: pass the (not yet current-mode-filtered) allRows.
// sessionCount/subtaskCount here are "visible token-bearing sessions" —
// acompact-excluded, positive-usage-only — never raw.sessions.length or
// analyze-usage.js's own counts, which don't apply either exclusion
// consistently (Codex's summary.subtaskCount there still includes acompact).
const scopedSessionSummary = computeScopedSessionSummary(allRows, allTimelines, sessionMap);
const summary = {
  totalCost: 0,
  totalUsageTokens: 0,
  sessionCount: scopedSessionSummary.sessionCount,
  mainSessionCount: scopedSessionSummary.mainSessionCount,
  subtaskCount: scopedSessionSummary.subtaskCount,
  dateFrom: fsd(fromD),
  dateTo: fsd(toD),
  days
};
// REPORT_DATA.sessionAttribution — additive, both hosts. Reassigned in the
// current-mode block below (same helper, narrower allRows scope) so full
// and current mode never disagree about how main/subtask/role/model are
// computed.
let sessionAttribution = scopedSessionSummary.attribution;

// 2. tokenBreakdown
const tb = {
  input: { tokens: 0, cost: 0 },
  output: { tokens: 0, cost: 0 },
  cacheCreate1h: { tokens: 0, cost: 0 },
  cacheCreate5m: { tokens: 0, cost: 0 },
  cacheRead: { tokens: 0, cost: 0 }
};
for (const row of allRows) {
  const rates = ratesFor(row.model);
  tb.input.tokens += row.input;
  tb.input.cost += row.input * rates.input / 1e6;
  tb.output.tokens += row.out;
  tb.output.cost += row.out * rates.output / 1e6;
  tb.cacheCreate1h.tokens += row.cc1h;
  tb.cacheCreate1h.cost += row.cc1h * rates.cacheCreate1h / 1e6;
  tb.cacheCreate5m.tokens += row.cc5m;
  tb.cacheCreate5m.cost += row.cc5m * rates.cacheCreate5m / 1e6;
  tb.cacheRead.tokens += row.cr;
  tb.cacheRead.cost += row.cr * rates.cacheRead / 1e6;
}
// Round costs
for (const key of Object.keys(tb)) {
  tb[key].cost = round2(tb[key].cost);
}
summary.totalUsageTokens = Object.values(tb).reduce((sum, part) => sum + part.tokens, 0);
// Align summary.totalCost with tokenBreakdown (dedup-corrected source of truth)
summary.totalCost = round2(tb.input.cost + tb.output.cost + tb.cacheCreate1h.cost + tb.cacheCreate5m.cost + tb.cacheRead.cost);

// 2b. 5H alerts from ratelimit CSVs (optional, statusline users only)
const fiveHAlerts = [];
if (!isCodex) try {
  const rlProjects = projectFilter ? [projectFilter] : hostPaths.listProjects();
  for (const proj of rlProjects) {
    const rlSessions = hostPaths.listSessions(proj);
    for (const sess of rlSessions) {
      const rlPath = hostPaths.getRatelimitPath(proj, sess);
      if (!fs.existsSync(rlPath)) continue;
      const lines = fs.readFileSync(rlPath, 'utf8').trim().split('\n');
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const alert = cols[5];
        if (alert === 'warn' || alert === 'danger') {
          fiveHAlerts.push({
            ts: Number(cols[0]),
            pct: Number(cols[1]),
            level: alert,
            sessionId: sess
          });
        }
      }
    }
  }
  fiveHAlerts.sort((a, b) => a.ts - b.ts);
} catch {}

// 2c. Ensure compact caches are fresh (parallel, skip subagents)
const allSessionIds = [...sessionMap.keys()];
await ensureCompactCaches(allSessionIds);

// 3. windows

// ── 5h window construction from ratelimit data (ts-precision) ──
// Anthropic switched 5h reset from hour-aligned to first-message+5h on
// ~2026-04-23, so boundaries are now minute-precise. Map each row's raw
// ts (second precision) to a window start using ratelimit 5h_reset values.
// Pre-4/23 hour-aligned data is handled by the same algorithm naturally
// because :00 boundaries are still valid ts values.

const uncoveredRows = [];
if (isCodex) {
  const canonical = raw.canonicalRateLimits || {};
  const lane = calendarWindowSource === 'canonical_rate_limit'
    ? [canonical.primary, canonical.secondary].find((item) => item && Number(item.windowMinutes) === calendarWindowMinutes && Number(item.resetsAt) > 0)
    : null;
  const duration = lane ? Number(lane.windowMinutes) * 60 : WINDOW_SECONDS;
  const anchor = lane ? Number(lane.resetsAt) - duration : null;
  for (const [, rows] of allTimelines) {
    for (const row of rows) {
      const ts = typeof row.ts === 'number' ? row.ts : Math.floor(new Date(row.ts).getTime() / 1000);
      row.ts = ts;
      if (anchor !== null) row.win = anchor + Math.floor((ts - anchor) / duration) * duration;
      else row.win = Math.floor(ts / WINDOW_SECONDS) * WINDOW_SECONDS;
    }
  }
} else {
  const { tsToWindow } = buildGlobalTsMapper();
  for (const [, rows] of allTimelines) {
    for (const row of rows) {
      const ts = typeof row.ts === 'number' ? row.ts : Math.floor(new Date(row.ts).getTime() / 1000);
      row.ts = ts;
      const win = tsToWindow(ts);
      if (win !== null) row.win = win;
      else uncoveredRows.push({ row, ts });
    }
  }
}

// Fallback: group uncovered rows into 5h blocks anchored by earliest ts.
// Used when timeline activity exists without ratelimit coverage.
uncoveredRows.sort((a, b) => a.ts - b.ts);
let groupStart = null;
for (const { row, ts } of uncoveredRows) {
  if (groupStart === null || ts >= groupStart + WINDOW_SECONDS) {
    groupStart = ts;
  }
  row.win = groupStart;
}

// Group timeline rows by win column
const winRowsMap = new Map(); // winStart -> [{row, sessionId}]
for (const [sessionId, rows] of allTimelines) {
  for (const row of rows) {
    if (!winRowsMap.has(row.win)) winRowsMap.set(row.win, []);
    winRowsMap.get(row.win).push({ row, sessionId });
  }
}

// Sort windows by start time
const winStarts = [...winRowsMap.keys()].sort((a, b) => a - b);

const windows = [];
const compactAlertCache = new Map();
const codexWeeklyBlockedSamples = isCodex && canonicalScopeLane
  ? (raw.rateLimitSamples || []).filter(sample => sample.limitId === 'codex'
      && sample.lane === canonicalScopeLane.lane
      && Number(sample.windowMinutes) === Number(canonicalScopeLane.windowMinutes)
      && Number(sample.usedPercent) >= 100
      && Number.isFinite(Date.parse(sample.ts)))
  : [];
for (const winStart of winStarts) {
  const entries = winRowsMap.get(winStart);
  const winEnd = winStart + WINDOW_SECONDS;
  const winDate = new Date(winStart * 1000);
  const winEndDate = new Date(winEnd * 1000);

  // Hourly costs and host-neutral token usage within this window
  const hourlyCosts = {};
  const hourlyUsageTokens = {};
  const hourlyUsageBuckets = {};
  const hourlyCostBuckets = {};
  const activeHoursSet = new Set();
  const rlHoursSet = new Set();

  for (const { row } of entries) {
    const h = new Date(row.ts * 1000).getHours();
    hourlyCosts[h] = (hourlyCosts[h] || 0) + row.cost;
    hourlyUsageTokens[h] = (hourlyUsageTokens[h] || 0) + usageTokens(row);
    const hourBucket = Math.floor(row.ts / 3600) * 3600;
    hourlyUsageBuckets[hourBucket] = (hourlyUsageBuckets[hourBucket] || 0) + usageTokens(row);
    hourlyCostBuckets[hourBucket] = (hourlyCostBuckets[hourBucket] || 0) + row.cost;
    // Codex rows carry cost=0 by design (see analyze-usage.js's Codex path),
    // so "was there activity" has to fall back to token volume — otherwise
    // the calendar would show zero active hours everywhere real usage
    // happened, which is worse than not knowing the dollar amount.
    const hadActivity = isCodex ? (row.input + row.cc + row.cr + row.out) > 0 : row.cost > 0;
    if (hadActivity) activeHoursSet.add(h);
    if (row.rl && (row.rl.startsWith('limit_hit') || row.rl.startsWith('limit_warning'))) {
      rlHoursSet.add(h);
    }
  }

  // Round hourly costs
  for (const h of Object.keys(hourlyCosts)) {
    hourlyCosts[h] = round2(hourlyCosts[h]);
  }

  const activeHours = [...activeHoursSet].sort((a, b) => a - b);
  const blockedSamples = codexWeeklyBlockedSamples.filter(sample => {
    const ts = Date.parse(sample.ts) / 1000;
    return ts >= winStart && ts < winEnd;
  });
  for (const sample of blockedSamples) rlHoursSet.add(new Date(sample.ts).getHours());
  const rlHours = [...rlHoursSet].sort((a, b) => a - b);
  const blockedAtTs = blockedSamples.length ? Math.min(...blockedSamples.map(sample => Date.parse(sample.ts) / 1000)) : null;

  // Total cost for window
  let winCost = 0;
  let winUsageTokens = 0;
  for (const { row } of entries) {
    winCost += row.cost;
    winUsageTokens += usageTokens(row);
  }

  // Group by session
  const sessionEntries = new Map(); // sessionId -> [row]
  for (const { row, sessionId } of entries) {
    if (!sessionEntries.has(sessionId)) sessionEntries.set(sessionId, []);
    sessionEntries.get(sessionId).push(row);
  }

  // Build session details for this window
  const programmaticDetails = [];
  const mainGroups = new Map(); // parentId -> { main: sessionMeta, subs: [sessionMeta] }

  for (const [sessionId, rows] of sessionEntries) {
    const meta = sessionMap.get(sessionId);
    if (!meta) continue;

    const sessionCost = round2(rows.reduce((s, r) => s + r.cost, 0));
    const sessionInput = rows.reduce((s, r) => s + r.input, 0);
    const sessionOutput = rows.reduce((s, r) => s + r.out, 0);
    const sessionCache1h = rows.reduce((s, r) => s + r.cc1h, 0);
    const sessionCache5m = rows.reduce((s, r) => s + r.cc5m, 0);
    const sessionCacheRead = rows.reduce((s, r) => s + r.cr, 0);
    const sessionMessages = rows.length;

    // Per-hour breakdown for 1h block view
    const hourly = {};
    for (const r of rows) {
      const h = new Date(r.ts * 1000).getHours();
      if (!hourly[h]) hourly[h] = { messages: 0, input: 0, output: 0, cache1h: 0, cache5m: 0, cacheRead: 0, cost: 0 };
      hourly[h].messages += 1;
      hourly[h].input += r.input;
      hourly[h].output += r.out;
      hourly[h].cache1h += r.cc1h;
      hourly[h].cache5m += r.cc5m;
      hourly[h].cacheRead += r.cr;
      hourly[h].cost += r.cost;
    }
    // Round costs
    for (const h of Object.keys(hourly)) hourly[h].cost = round2(hourly[h].cost);

    // isSubtask/taskThreadId/parentSessionId/agentRole/agentNickname/orphan
    // (gap-remediation item 3): parentSessionId is the immediate parent and
    // is set ONLY when it comes from a verified source — for Claude that's
    // the subagent's own file path under the parent's subagents/ directory
    // (getParentId, unchanged from before); Codex has no such verified
    // linkage, only a threadId SHARED by every session in the task (main and
    // every subagent alike), so it is never treated as a parent pointer.
    // A subtask with no verified parent is explicitly `orphan: true` rather
    // than silently defaulting taskThreadId or a guessed id into the parent
    // slot.
    const verifiedParentId = getParentId(meta.filePath); // Claude-only; null for Codex
    const detail = {
      id: sessionId,
      type: 'main',
      messages: sessionMessages,
      input: sessionInput,
      output: sessionOutput,
      cache1h: sessionCache1h,
      cache5m: sessionCache5m,
      cacheRead: sessionCacheRead,
      cost: sessionCost,
      startTime: meta.firstTs ? fsd(new Date(meta.firstTs)) + ' ' + ft(new Date(meta.firstTs)) : '',
      endTime: meta.lastTs ? fsd(new Date(meta.lastTs)) + ' ' + ft(new Date(meta.lastTs)) : '',
      activeHours: Object.keys(hourly).map(Number).sort((a, b) => a - b),
      hourly: hourly,
      model: meta.model || 'unknown',
      isSubtask: false,
      taskThreadId: meta.threadId || sessionId,
      parentSessionId: null,
      orphan: false,
      agentRole: null,
      agentNickname: null,
    };

    if (isProgrammatic(meta)) {
      detail.type = 'claude-p';
      programmaticDetails.push(detail);
    } else if (isSubagentSession(meta)) {
      detail.type = 'sub';
      detail.isSubtask = true;
      detail.taskThreadId = meta.threadId || verifiedParentId || sessionId;
      detail.parentSessionId = verifiedParentId;
      detail.orphan = !verifiedParentId;
      detail.agentRole = (meta.agent && meta.agent.role) || meta.agentType || 'unknown';
      detail.agentNickname = (meta.agent && meta.agent.nickname) || 'unknown';
      // Grouping under the calendar's session-detail panel is a display
      // heuristic (fold a subagent under its main session), independent of
      // the verified-parent contract above — it may use the shared threadId
      // as a best-effort grouping key even when parentSessionId stays null.
      const groupingId = verifiedParentId || meta.threadId;
      if (groupingId) {
        if (!mainGroups.has(groupingId)) {
          mainGroups.set(groupingId, { main: null, subs: [] });
        }
        mainGroups.get(groupingId).subs.push(detail);
      }
    } else {
      // Main session
      if (!mainGroups.has(sessionId)) {
        mainGroups.set(sessionId, { main: null, subs: [] });
      }
      mainGroups.get(sessionId).main = { meta, detail };
    }
  }

  // Build windowSessions
  const windowSessions = [];

  // Programmatic bundle
  if (programmaticDetails.length > 0) {
    const pSum = {
      messages: programmaticDetails.reduce((s, d) => s + d.messages, 0),
      input: programmaticDetails.reduce((s, d) => s + d.input, 0),
      output: programmaticDetails.reduce((s, d) => s + d.output, 0),
      cache1h: programmaticDetails.reduce((s, d) => s + d.cache1h, 0),
      cache5m: programmaticDetails.reduce((s, d) => s + d.cache5m, 0),
      cacheRead: programmaticDetails.reduce((s, d) => s + d.cacheRead, 0),
      cost: round2(programmaticDetails.reduce((s, d) => s + d.cost, 0))
    };
    if (isCodex ? detailUsageTokens(pSum) > 0 : pSum.cost > 0) {
      const earliestProg = programmaticDetails.reduce((earliest, d) => (!earliest || d.startTime < earliest) ? d.startTime : earliest, '');
      const progHourly = {};
      for (const d of programmaticDetails) {
        for (const [h, st] of Object.entries(d.hourly || {})) {
          if (!progHourly[h]) progHourly[h] = { messages: 0, input: 0, output: 0, cache1h: 0, cache5m: 0, cacheRead: 0, cost: 0 };
          progHourly[h].messages += st.messages; progHourly[h].input += st.input; progHourly[h].output += st.output;
          progHourly[h].cache1h += st.cache1h; progHourly[h].cache5m += st.cache5m; progHourly[h].cacheRead += st.cacheRead;
          progHourly[h].cost = round2(progHourly[h].cost + st.cost);
        }
      }
      windowSessions.push({
        id: 'programmatic', type: 'programmatic',
        firstMsg: '', lastMsg: '',
        startTime: earliestProg,
        ...pSum,
        details: programmaticDetails,
        activeHours: Object.keys(progHourly).map(Number).sort((a, b) => a - b),
        hourly: progHourly
      });
    }
  }

  // Main sessions with their subtasks
  for (const [groupId, group] of mainGroups) {
    const allDetails = [];
    let totalMessages = 0, totalInput = 0, totalOutput = 0;
    let totalCache1h = 0, totalCache5m = 0, totalCacheRead = 0, totalCost = 0;

    if (group.main) {
      allDetails.push(group.main.detail);
      totalMessages += group.main.detail.messages;
      totalInput += group.main.detail.input;
      totalOutput += group.main.detail.output;
      totalCache1h += group.main.detail.cache1h;
      totalCache5m += group.main.detail.cache5m;
      totalCacheRead += group.main.detail.cacheRead;
      totalCost += group.main.detail.cost;
    }

    for (const sub of group.subs) {
      allDetails.push(sub);
      totalMessages += sub.messages;
      totalInput += sub.input;
      totalOutput += sub.output;
      totalCache1h += sub.cache1h;
      totalCache5m += sub.cache5m;
      totalCacheRead += sub.cacheRead;
      totalCost += sub.cost;
    }

    totalCost = round2(totalCost);

    const totalUsage = totalInput + totalOutput + totalCache1h + totalCache5m + totalCacheRead;
    if (isCodex ? totalUsage <= 0 : totalCost <= 0) continue;

    const mainMeta = group.main ? group.main.meta : null;
    // Window-scoped first/last user message
    let winFirstMsg = '', winLastMsg = '';
    if (mainMeta && mainMeta.userMessageLog) {
      const winMsgs = mainMeta.userMessageLog.filter(m => {
        const mts = new Date(m.ts).getTime() / 1000;
        return mts >= winStart && mts < winEnd;
      });
      // Skip /continue skill output messages (start with 💚 /continue)
      const realMsgs = winMsgs.filter(m => !m.text.startsWith('\u{1F49A} /continue'));
      if (realMsgs.length > 0) {
        winFirstMsg = realMsgs[0].text;
        winLastMsg = realMsgs[realMsgs.length - 1].text;
      } else if (winMsgs.length > 0) {
        winFirstMsg = winMsgs[0].text;
        winLastMsg = winMsgs[winMsgs.length - 1].text;
      }
    }
    // Merge hourly stats from all details
    const groupHourly = {};
    for (const d of allDetails) {
      for (const [h, st] of Object.entries(d.hourly || {})) {
        if (!groupHourly[h]) groupHourly[h] = { messages: 0, input: 0, output: 0, cache1h: 0, cache5m: 0, cacheRead: 0, cost: 0 };
        groupHourly[h].messages += st.messages;
        groupHourly[h].input += st.input;
        groupHourly[h].output += st.output;
        groupHourly[h].cache1h += st.cache1h;
        groupHourly[h].cache5m += st.cache5m;
        groupHourly[h].cacheRead += st.cacheRead;
        groupHourly[h].cost = round2(groupHourly[h].cost + st.cost);
      }
    }
    windowSessions.push({
      id: groupId,
      type: 'main',
      firstMsg: winFirstMsg,
      lastMsg: winLastMsg,
      startTime: mainMeta && mainMeta.firstTs ? fsd(new Date(mainMeta.firstTs)) + ' ' + ft(new Date(mainMeta.firstTs)) : '',
      endTime: mainMeta && mainMeta.lastTs ? fsd(new Date(mainMeta.lastTs)) + ' ' + ft(new Date(mainMeta.lastTs)) : '',
      messages: totalMessages,
      input: totalInput,
      output: totalOutput,
      cache1h: totalCache1h,
      cache5m: totalCache5m,
      cacheRead: totalCacheRead,
      cost: totalCost,
      details: allDetails,
      activeHours: Object.keys(groupHourly).map(Number).sort((a, b) => a - b),
      hourly: groupHourly
    });
  }

  // Remove sessions with no real work. Codex has no dollar cost, so token
  // activity is the authoritative inclusion predicate for that host.
  for (let i = windowSessions.length - 1; i >= 0; i--) {
    const empty = isCodex ? detailUsageTokens(windowSessions[i]) === 0 : windowSessions[i].cost === 0;
    if (empty && windowSessions[i].type === 'main') {
      windowSessions.splice(i, 1);
    }
  }

  // Group sessions with same firstMsg (2+ = batch/programmatic)
  const msgGroups = new Map(); // firstMsg -> [indices]
  for (let i = 0; i < windowSessions.length; i++) {
    const s = windowSessions[i];
    if (s.type !== 'main' || !s.firstMsg) continue;
    const key = s.firstMsg.slice(0, 80).replace(/\d+/g, '#'); // normalize: strip numbers for structural match
    if (!msgGroups.has(key)) msgGroups.set(key, []);
    msgGroups.get(key).push(i);
  }
  const removeIndices = new Set();
  for (const [msgKey, indices] of msgGroups) {
    if (indices.length < 2) continue;
    // Merge these sessions into one batch group
    const batchDetails = [];
    let tMsg = 0, tIn = 0, tOut = 0, tC1h = 0, tC5m = 0, tCr = 0, tCost = 0;
    for (const idx of indices) {
      const s = windowSessions[idx];
      tMsg += s.messages; tIn += s.input; tOut += s.output;
      tC1h += s.cache1h; tC5m += s.cache5m; tCr += s.cacheRead; tCost += s.cost;
      // Flatten all details into batch
      for (const d of s.details) batchDetails.push(d);
      removeIndices.add(idx);
    }
    const earliestBatch = indices.reduce((earliest, idx) => {
      const st = windowSessions[idx].startTime;
      return (!earliest || (st && st < earliest)) ? st : earliest;
    }, '');
    windowSessions.push({
      id: 'batch-' + indices.length,
      type: 'batch',
      firstMsg: windowSessions[indices[0]].firstMsg,
      lastMsg: '',
      startTime: earliestBatch,
      messages: tMsg, input: tIn, output: tOut,
      cache1h: tC1h, cache5m: tC5m, cacheRead: tCr,
      cost: round2(tCost),
      details: batchDetails,
      activeHours: [...new Set(batchDetails.flatMap(d => d.activeHours || []))].sort((a, b) => a - b),
      hourly: (function() {
        const bh = {};
        for (const d of batchDetails) {
          for (const [h, st] of Object.entries(d.hourly || {})) {
            if (!bh[h]) bh[h] = { messages: 0, input: 0, output: 0, cache1h: 0, cache5m: 0, cacheRead: 0, cost: 0 };
            bh[h].messages += st.messages; bh[h].input += st.input; bh[h].output += st.output;
            bh[h].cache1h += st.cache1h; bh[h].cache5m += st.cache5m; bh[h].cacheRead += st.cacheRead;
            bh[h].cost = round2(bh[h].cost + st.cost);
          }
        }
        return bh;
      })()
    });
  }
  // Remove merged sessions (reverse order to preserve indices)
  const finalSessions = windowSessions.filter((_, i) => !removeIndices.has(i))
    .sort((a, b) => {
      // main first, then batch, then programmatic last
      const order = { main: 0, batch: 1, programmatic: 2 };
      const oa = order[a.type] ?? 1, ob = order[b.type] ?? 1;
      if (oa !== ob) return oa - ob;
      return b.cost - a.cost;
    });

  // Note: do NOT skip here — alertMessages need to be built even for $0-cost
  // windows. Filter happens after alertMessages are constructed.

  // Build alertMessages for this window
  const alertMessages = [];
  const windowDateStr = fsd(winDate);
  const seenSessionIds = new Set();
  for (const [sessionId] of sessionEntries) {
    if (seenSessionIds.has(sessionId)) continue;
    seenSessionIds.add(sessionId);
    if (!compactAlertCache.has(sessionId)) {
      const userAlerts = readCompactAlerts(sessionId);
      // v1.4.0: join with timeline rows for per user-turn aggregation (pruned list returned)
      const tl = allTimelines.get(sessionId) || [];
      const joined = buildAlertsFromUserTurns(sessionId, userAlerts, tl);
      compactAlertCache.set(sessionId, joined);
    }
    const compactAlerts = compactAlertCache.get(sessionId);
    const tlRows = allTimelines.get(sessionId) || [];
    for (const srcAlert of compactAlerts) {
      // Clone alert to prevent mutation across windows (alert.time gets overwritten to local HH:MM)
      const alert = { ...srcAlert };
      // Alert time is UTC. New format: MM-DDTHH:MM, old format: HH:MM
      const sessMeta = sessionMap.get(sessionId);
      const sessDate = new Date(sessMeta ? sessMeta.firstTs : Date.now());
      const timeParts = alert.time.split('T');
      let alertDate;
      if (timeParts.length === 2) {
        // v6 format: YYYY-MM-DDTHH:MM:SSZ or MM-DDTHH:MM:SS
        const [md, hm] = timeParts;
        const dateParts = md.split('-').map(Number);
        let year, mon, day;
        if (dateParts.length === 3) {
          // Full ISO: YYYY-MM-DD
          [year, mon, day] = dateParts;
        } else {
          // Short: MM-DD (use session year)
          [mon, day] = dateParts;
          year = sessDate.getUTCFullYear();
        }
        const hmParts = hm.replace('Z', '').split(':').map(Number);
        const [ah, am] = hmParts;
        const as = hmParts[2] || 0;
        alertDate = new Date(Date.UTC(year, mon - 1, day, ah, am, as));
      } else {
        // Old format: HH:MM or HH:MM:SS — reconstruct from session date, try ±1 day for midnight-crossing sessions
        const hmParts = alert.time.split(':').map(Number);
        const [ah, am] = hmParts;
        const as = hmParts[2] || 0;
        const baseDate = new Date(Date.UTC(sessDate.getUTCFullYear(), sessDate.getUTCMonth(), sessDate.getUTCDate(), ah, am, as));
        const candidates = [baseDate.getTime(), baseDate.getTime() + 86400000, baseDate.getTime() - 86400000];
        const sessEnd = new Date(sessMeta ? sessMeta.lastTs : Date.now()).getTime();
        const sessStart = sessDate.getTime();
        // Pick the candidate that falls within session time range (with some margin)
        let best = baseDate.getTime();
        for (const c of candidates) {
          if (c >= sessStart - 3600000 && c <= sessEnd + 3600000) {
            best = c;
            break;
          }
        }
        alertDate = new Date(best);
      }
      alert.ts = Math.floor(alertDate.getTime() / 1000);
      // Check if alert falls within window time range
      if (alert.ts < winStart || alert.ts >= winEnd) continue;
      // Convert display time to local
      alert.time = ft(new Date(alert.ts * 1000));
      matchAlertWithTimeline(alert, tlRows);
      alertMessages.push(alert);
    }
  }

  // Add 5H alerts that fall within this window's time range
  for (const fa of fiveHAlerts) {
    if (fa.ts >= winStart && fa.ts < winEnd) {
      alertMessages.push({
        sessionId: fa.sessionId,
        lineNum: 0,
        time: ft(new Date(fa.ts * 1000)),
        ts: fa.ts,
        markers: '',
        text: '5H ' + fa.pct + '%',
        alertType: '5h-' + fa.level,
        tokens: null
      });
    }
  }

  // Sort by time
  alertMessages.sort((a, b) => a.ts - b.ts);

  // Build continueEvents for this window
  const continueEvents = [];
  for (const [sessionId] of sessionEntries) {
    const sess = sessionMap.get(sessionId);
    if (!sess || !sess.contextEvents) continue;
    for (const ce of sess.contextEvents) {
      if (ce.type !== 'continue') continue;
      // Check if this continue event falls within the window
      if (ce.ts < winStart || ce.ts >= winEnd) continue;

      const restoredIds = ce.restoredSessionIds || [];
      let restoredContextTokens = 0;
      for (const rid of restoredIds) {
        const ridRows = allTimelines.get(rid);
        if (ridRows && ridRows.length > 0) {
          // Get the last row's cr (cache read) — represents session's context size at end
          const lastRow = ridRows[ridRows.length - 1];
          restoredContextTokens += lastRow.cr || 0;
        }
      }

      // Determine model for pricing (use the session's first timeline row model)
      const sessRows = allTimelines.get(sessionId) || [];
      const model = sessRows.length > 0 ? sessRows[0].model : '';
      const rates = ratesFor(model);

      // Estimated compact output = ~10% of input
      const estimatedOutput = Math.round(restoredContextTokens * 0.1);

      // Best case (cache hit): cacheRead rate
      const compactCostMin = round2(
        restoredContextTokens * rates.cacheRead / 1e6 +
        estimatedOutput * rates.output / 1e6
      );

      // Worst case (cache miss >1h): cacheCreate1h rate
      const compactCostMax = round2(
        restoredContextTokens * rates.cacheCreate1h / 1e6 +
        estimatedOutput * rates.output / 1e6
      );

      // Skip empty continue events (no restored context)
      if (restoredContextTokens === 0) continue;
      const eventTime = ft(new Date(ce.ts * 1000));
      if (eventTime.includes('NaN')) continue;

      continueEvents.push({
        time: eventTime,
        sessionCount: ce.sessionCount || restoredIds.length,
        restoredContextTokens,
        compactCostMin,
        compactCostMax,
        actualCost: 0
      });
    }
  }

  // Skip windows with no sessions AND no alerts (pure $0 windows with no user activity)
  if (finalSessions.length === 0 && alertMessages.length === 0 && continueEvents.length === 0 && (!isCodex || winUsageTokens === 0)) continue;

  windows.push({
    date: fsd(winDate),
    start: ft(winDate),
    end: ft(winEndDate),
    // Raw second-precise boundaries from ratelimit data — preferred over
    // re-parsing start/end strings in the renderer.
    startTs: winStart,
    endTs: winEnd,
    usage: blockedAtTs == null ? 0 : 100,
    blockedAtTs,
    cost: round2(winCost),
    usageTokens: winUsageTokens,
    eventCount: entries.length,
    rlHours,
    hourlyCosts,
    hourlyUsageTokens,
    hourlyUsageBuckets,
    hourlyCostBuckets,
    activeHours,
    windowSessions: finalSessions,
    alertMessages,
    continueEvents
  });
}

// 3b. current mode. Claude keeps its latest 5h window. Codex keeps the
// current canonical rate period as the data scope, but preserves every
// bounded analytics bucket inside it so calendar clicks stay responsive.
if (currentMode && windows.length > 0) {
  let latestWinStart, latestWinEnd;
  if (isCodex) {
    const canonical = raw.canonicalRateLimits || {};
    const laneCandidate = selectLongestRateLimitLane(canonical);
    const lane = laneCandidate && Number(laneCandidate.resetsAt) > 0 ? laneCandidate : null;
    if (lane) {
      latestWinEnd = Number(lane.resetsAt);
      latestWinStart = latestWinEnd - Number(lane.windowMinutes) * 60;
      const scoped = windows.filter(w => w.endTs > latestWinStart && w.startTs < latestWinEnd);
      windows.length = 0; windows.push(...scoped);
    } else {
      latestWinStart = winStarts[winStarts.length - 1]; latestWinEnd = latestWinStart + WINDOW_SECONDS;
      const latest = windows[windows.length - 1]; windows.length = 0; windows.push(latest);
    }
  } else {
    const latest = windows[windows.length - 1]; windows.length = 0; windows.push(latest);
    latestWinStart = winStarts[winStarts.length - 1]; latestWinEnd = latestWinStart + WINDOW_SECONDS;
  }
  const filtered = allRows.filter(r => r.ts >= latestWinStart && r.ts < latestWinEnd);
  allRows.length = 0;
  for (const r of filtered) allRows.push(r);

  // Recalculate summary to match filtered 5H window
  if (allRows.length > 0) {
    const minTs = Math.min(...allRows.map(r => r.ts));
    const maxTs = Math.max(...allRows.map(r => r.ts));
    const cfrom = new Date(minTs * 1000);
    const cto = new Date(maxTs * 1000);
    summary.dateFrom = fsd(cfrom) + ' ' + ft(cfrom);
    summary.dateTo = fsd(cto) + ' ' + ft(cto);
    const cfromDate = new Date(cfrom.getFullYear(), cfrom.getMonth(), cfrom.getDate());
    const ctoDate = new Date(cto.getFullYear(), cto.getMonth(), cto.getDate());
    summary.days = Math.round((ctoDate - cfromDate) / 86400000) + 1;
    // Recalculate totalCost from filtered rows
    let filteredCost = 0;
    for (const row of allRows) {
      const rates = ratesFor(row.model);
      filteredCost += row.input * rates.input / 1e6
        + (row.cc1h * rates.cacheCreate1h + row.cc5m * rates.cacheCreate5m) / 1e6
        + row.cr * rates.cacheRead / 1e6
        + row.out * rates.output / 1e6;
    }
    summary.totalCost = round2(filteredCost);
    // Recalculate session counts via the SAME helper the full-report summary
    // uses above — allRows has already been truncated to this window (the
    // `filtered` splice a few lines up), so the Set-identity scope check
    // inside computeScopedSessionSummary naturally restricts each session's
    // rows to this window without a second timestamp filter, and applies
    // the same acompact-exclusion/positive-usage-only rules as full mode.
    const currentScopedSessionSummary = computeScopedSessionSummary(allRows, allTimelines, sessionMap);
    summary.sessionCount = currentScopedSessionSummary.sessionCount;
    summary.mainSessionCount = currentScopedSessionSummary.mainSessionCount;
    summary.subtaskCount = currentScopedSessionSummary.subtaskCount;
    sessionAttribution = currentScopedSessionSummary.attribution;
  }

  // Recalculate tokenBreakdown from filtered allRows
  for (const key of Object.keys(tb)) { tb[key].tokens = 0; tb[key].cost = 0; }
  for (const row of allRows) {
    const rates = ratesFor(row.model);
    tb.input.tokens += row.input;
    tb.input.cost += row.input * rates.input / 1e6;
    tb.output.tokens += row.out;
    tb.output.cost += row.out * rates.output / 1e6;
    tb.cacheCreate1h.tokens += row.cc1h;
    tb.cacheCreate1h.cost += row.cc1h * rates.cacheCreate1h / 1e6;
    tb.cacheCreate5m.tokens += row.cc5m;
    tb.cacheCreate5m.cost += row.cc5m * rates.cacheCreate5m / 1e6;
    tb.cacheRead.tokens += row.cr;
    tb.cacheRead.cost += row.cr * rates.cacheRead / 1e6;
  }
  for (const key of Object.keys(tb)) { tb[key].cost = round2(tb[key].cost); }
}

// ── Codex purchased-credit-equivalent headline cost ─────────────
// Additive-only: computed from the FINAL scoped allRows (post current-mode
// filtering above, so it matches whatever window the rest of the report is
// showing) and never touches summary.totalCost/hasCostData/costKnownUSD or
// any Claude-path math. Uses the SAME row shape as the rest of this file's
// cost math (row.input/cr/out/cc/cc1h/cc5m) but a completely separate rate
// table (codex-credit-pricing.json) — never Anthropic pricing.
let codexCreditEquivalent = null;
if (isCodex) {
  let codexCreditPricingConfig = null;
  try {
    codexCreditPricingConfig = JSON.parse(fs.readFileSync(CODEX_CREDIT_PRICING_PATH, 'utf8'));
  } catch (e) {
    codexCreditPricingConfig = null; // computeCodexCreditEquivalent fails closed to 'unavailable'
  }
  codexCreditEquivalent = computeCodexCreditEquivalent(allRows, codexCreditPricingConfig);
}

// 4. dailyCosts
const dailyCostMap = new Map(); // dateKey -> { date (display), input, cacheCreate, cacheRead, output }
for (const row of allRows) {
  const d = new Date(row.ts * 1000);
  const key = fsdKey(d);
  if (!dailyCostMap.has(key)) {
    dailyCostMap.set(key, { date: fsd(d), input: 0, cacheCreate: 0, cacheRead: 0, output: 0 });
  }
  const entry = dailyCostMap.get(key);
  const rates = ratesFor(row.model);
  entry.input += row.input * rates.input / 1e6;
  entry.cacheCreate += (row.cc1h * rates.cacheCreate1h + row.cc5m * rates.cacheCreate5m) / 1e6;
  entry.cacheRead += row.cr * rates.cacheRead / 1e6;
  entry.output += row.out * rates.output / 1e6;
}
const dailyCosts = [...dailyCostMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(e => e[1]);
for (const dc of dailyCosts) {
  dc.input = round2(dc.input);
  dc.cacheCreate = round2(dc.cacheCreate);
  dc.cacheRead = round2(dc.cacheRead);
  dc.output = round2(dc.output);
}

// 4b. dailyTokens (token counts for efficiency trend, same dates as dailyCosts)
const dailyTokenMap = new Map();
for (const row of allRows) {
  const d = new Date(row.ts * 1000);
  const key = fsdKey(d);
  if (!dailyTokenMap.has(key)) {
    dailyTokenMap.set(key, { date: fsd(d), total: 0, input: 0, cc: 0, cr: 0, out: 0 });
  }
  const entry = dailyTokenMap.get(key);
  entry.total += row.input + row.cc + row.cr + row.out;
  entry.input += row.input;
  entry.cc += row.cc;
  entry.cr += row.cr;
  entry.out += row.out;
}
const dailyTokens = [...dailyTokenMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(e => e[1]);

// 5. hourlyStats
const hourCostsByDay = {}; // hour -> { dateKey -> cost }
const daySetByHour = {}; // hour -> Set of date strings
for (const row of allRows) {
  const d = new Date(row.ts * 1000);
  const h = d.getHours();
  const dateKey = fsdKey(d);
  if (!hourCostsByDay[h]) { hourCostsByDay[h] = {}; daySetByHour[h] = new Set(); }
  daySetByHour[h].add(dateKey);
  hourCostsByDay[h][dateKey] = (hourCostsByDay[h][dateKey] || 0) + row.cost;
}

// Boundary timestamps for partial-hour weighting
// Note: uses local time (getHours). DST transitions may cause ±1h per year — negligible.
const firstTs = allRows.length > 0 ? Math.min(...allRows.map(r => r.ts)) : 0;
const lastTs = allRows.length > 0 ? Math.max(...allRows.map(r => r.ts)) : 0;
const firstD = new Date(firstTs * 1000);
const lastD = new Date(lastTs * 1000);
const firstHour = firstD.getHours();
const firstMin = firstD.getMinutes();
const lastHour = lastD.getHours();
const lastMin = lastD.getMinutes() || 1; // avoid /0
const firstDateKey = fsdKey(firstD);
const lastDateKey = fsdKey(lastD);

// Total calendar days in range
const totalCalDays = days;

// For each hour, how many calendar days include it?
function calendarDaysForHour(h) {
  let count = totalCalDays;
  // First day: if h < firstHour, that hour wasn't active on first day
  if (h < firstHour) count--;
  // Last day: if h > lastHour, that hour hasn't happened yet today
  if (h > lastHour) count--;
  return Math.max(count, 1);
}

const hourlyStats = [];
for (let h = 0; h < 24; h++) {
  if (!hourCostsByDay[h]) {
    hourlyStats.push({ hour: h, avg: 0, max: 0, calAvg: 0 });
    continue;
  }
  // Normalize partial-hour costs at boundaries to full-hour equivalent
  // e.g., if only 30 min of data in that hour → cost * 60/30
  // Skip normalization for long periods (30+ days) where boundary effect is negligible
  const shouldNormalize = days <= 14;
  const normalizedCosts = Object.entries(hourCostsByDay[h]).map(([dateKey, cost]) => {
    if (!shouldNormalize) return cost;
    if (h === firstHour && dateKey === firstDateKey && firstMin > 0) {
      return cost * 60 / Math.max(60 - firstMin, 1);
    }
    if (h === lastHour && dateKey === lastDateKey && lastMin < 60) {
      return cost * 60 / Math.max(lastMin, 1);
    }
    return cost;
  });
  const activeDays = daySetByHour[h].size || 1;
  const activeAvg = round2(normalizedCosts.reduce((s, c) => s + c, 0) / activeDays);
  const max = round2(Math.max(...normalizedCosts));
  // Calendar avg: normalized total / calendar days for this hour
  const normalizedTotal = normalizedCosts.reduce((s, c) => s + c, 0);
  const calDays = calendarDaysForHour(h);
  const calAvg = round2(normalizedTotal / calDays);
  hourlyStats.push({ hour: h, avg: activeAvg, max, calAvg });
}

// 6. dowStats
const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dowCostsByWeek = {}; // dow -> { weekKey -> cost }
const dowRawCosts = {}; // dow -> total raw cost
for (const row of allRows) {
  const d = new Date(row.ts * 1000);
  const dow = d.getDay();
  // Use ISO week as key for grouping
  const weekKey = Math.floor(row.ts / (7 * 86400));
  if (!dowCostsByWeek[dow]) { dowCostsByWeek[dow] = {}; dowRawCosts[dow] = 0; }
  dowCostsByWeek[dow][weekKey] = (dowCostsByWeek[dow][weekKey] || 0) + row.cost;
  dowRawCosts[dow] += row.cost;
}

// Count calendar occurrences of each DOW in [fromDate, toDate]
// If first and last day are the same DOW, they represent partial days
// that together make ~24h, so count them as 1 instead of 2.
const firstDow = firstD.getDay();
const lastDow = lastD.getDay();
function calendarDowCount(dow) {
  let count = 0;
  const d = new Date(fromDate);
  while (d <= toDate) {
    if (d.getDay() === dow) count++;
    d.setDate(d.getDate() + 1);
  }
  // First+last day same DOW: partial days combine to ~1 full day
  if (firstDow === lastDow && dow === firstDow && count >= 2) count--;
  return Math.max(count, 1);
}

const dowStats = [];
for (let dow = 0; dow < 7; dow++) {
  if (!dowCostsByWeek[dow]) {
    dowStats.push({ dow, label: dowLabels[dow], avg: 0, max: 0, calAvg: 0 });
    continue;
  }
  // If first+last day are same DOW, merge their week entries into one
  const weekEntries = { ...dowCostsByWeek[dow] };
  if (firstDow === lastDow && dow === firstDow) {
    const firstWeekKey = Math.floor(firstTs / (7 * 86400));
    const lastWeekKey = Math.floor(lastTs / (7 * 86400));
    if (firstWeekKey !== lastWeekKey && weekEntries[firstWeekKey] != null && weekEntries[lastWeekKey] != null) {
      weekEntries[lastWeekKey] += weekEntries[firstWeekKey];
      delete weekEntries[firstWeekKey];
    }
  }
  const costs = Object.values(weekEntries);
  const avg = round2(costs.reduce((s, c) => s + c, 0) / costs.length);
  const max = round2(Math.max(...costs));
  const calCount = Math.max(calendarDowCount(dow), 1);
  const calAvg = round2(dowRawCosts[dow] / calCount);
  dowStats.push({ dow, label: dowLabels[dow], avg, max, calAvg });
}

// Token analogues of the cost patterns above. They deliberately use the same
// avg/max/calendar-average shapes so the original chart controls and layout
// can be reused without a second dashboard implementation.
function buildHourlyUsageStats(rows) {
  const values = {}, activeDays = {};
  for (const row of rows) {
    const d = new Date(row.ts * 1000), h = d.getHours(), key = fsdKey(d);
    if (!values[h]) { values[h] = {}; activeDays[h] = new Set(); }
    values[h][key] = (values[h][key] || 0) + usageTokens(row);
    activeDays[h].add(key);
  }
  return Array.from({ length: 24 }, (_, h) => {
    const dayValues = Object.values(values[h] || {});
    if (!dayValues.length) return { hour: h, avg: 0, max: 0, calAvg: 0 };
    const total = dayValues.reduce((sum, value) => sum + value, 0);
    return { hour: h, avg: Math.round(total / activeDays[h].size), max: Math.max(...dayValues), calAvg: Math.round(total / calendarDaysForHour(h)) };
  });
}

function buildDowUsageStats(rows) {
  const byDowWeek = {}, totals = {};
  for (const row of rows) {
    const d = new Date(row.ts * 1000), dow = d.getDay(), week = Math.floor(row.ts / (7 * 86400));
    if (!byDowWeek[dow]) { byDowWeek[dow] = {}; totals[dow] = 0; }
    const value = usageTokens(row);
    byDowWeek[dow][week] = (byDowWeek[dow][week] || 0) + value;
    totals[dow] += value;
  }
  return dowLabels.map((label, dow) => {
    const values = Object.values(byDowWeek[dow] || {});
    if (!values.length) return { dow, label, avg: 0, max: 0, calAvg: 0 };
    return { dow, label, avg: Math.round(values.reduce((s, v) => s + v, 0) / values.length), max: Math.max(...values), calAvg: Math.round(totals[dow] / calendarDowCount(dow)) };
  });
}
const hourlyUsageStats = buildHourlyUsageStats(allRows);
const dowUsageStats = buildDowUsageStats(allRows);

// 7. Plugin installed date — read CC's authoritative tracking from
// ~/.claude/plugins/installed_plugins.json (`installedAt` field).
// CC writes this on first install and preserves it across version updates.
// Falls back to cache directory birthtime if the file is unavailable.
let pluginInstalledAt = null;
try {
  const installedJsonPath = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
  if (fs.existsSync(installedJsonPath)) {
    const installed = JSON.parse(fs.readFileSync(installedJsonPath, 'utf8'));
    const entries = installed && installed.plugins && installed.plugins['super-token-saver@ww-w-ai'];
    if (Array.isArray(entries) && entries.length > 0) {
      // Pick the earliest installedAt across scopes (user/project)
      for (const e of entries) {
        if (e && e.installedAt && (!pluginInstalledAt || e.installedAt < pluginInstalledAt)) {
          pluginInstalledAt = e.installedAt;
        }
      }
    }
  }
} catch(e) {}
// Fallback: oldest birthtime across cached version directories
if (!pluginInstalledAt) {
  try {
    const pluginMeta = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.claude-plugin', 'plugin.json'), 'utf8'));
    const repoUrl = pluginMeta.repository || '';
    const repoMatch = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
    if (repoMatch) {
      const cacheBase = path.join(os.homedir(), '.claude', 'plugins', 'cache', ...repoMatch[1].split('/'));
      if (fs.existsSync(cacheBase)) {
        for (const ver of fs.readdirSync(cacheBase)) {
          const verDir = path.join(cacheBase, ver);
          try {
            if (!fs.statSync(verDir).isDirectory() && !fs.lstatSync(verDir).isSymbolicLink()) continue;
          } catch(e) { continue; }
          for (const candidate of ['.claude-plugin/plugin.json', 'plugin.json']) {
            try {
              const bt = fs.statSync(path.join(verDir, candidate)).birthtime.toISOString();
              if (!pluginInstalledAt || bt < pluginInstalledAt) pluginInstalledAt = bt;
            } catch(e) {}
          }
        }
      }
    }
  } catch(e) {}
}
// Final fallback: local plugin.json birthtime
if (!pluginInstalledAt) {
  for (const p of [
    path.join(__dirname, '..', '.claude-plugin', 'plugin.json'),
    path.join(__dirname, '..', 'plugin.json'),
  ]) {
    try {
      const bt = fs.statSync(p).birthtime.toISOString();
      if (!pluginInstalledAt || bt < pluginInstalledAt) pluginInstalledAt = bt;
    } catch(e) {}
  }
}

// ── Plan info for REPORT_DATA and AI prompt ────────────────────
const PLAN_INFO = PLAN_INFO_ALL;
let planData = null;
if (isCodex) {
  // planArg may be a UI number ("2") or a plan key typed directly ("go") —
  // resolveCodexPlanChoice handles both, same as the SKILL.md plan prompt.
  // Falling back to whatever plan_type a session actually reported keeps
  // this correct even when the user was never asked (SKILL.md: "read
  // straight off rate_limits.plan_type ... do not ask unless absent").
  const resolvedKey = (planArg && resolveCodexPlanChoice(planArg))
    || (raw.sessions.find((s) => s.plan && s.plan.key) || {}).plan?.key
    || null;
  if (resolvedKey) {
    const info = CODEX_PLAN_INFO[resolvedKey];
    // price is intentionally absent (null), not fabricated — Codex plans
    // aren't flat-priced the way Claude's are, and the template only shows
    // a price parenthetical when one is present.
    planData = { key: resolvedKey, name: info ? info.name : resolvedKey, price: null };
  }
} else {
  planData = planArg && PLAN_INFO[planArg] ? PLAN_INFO[planArg] : null;
}

// Context-vs-cost scatter data (two charts: per-assistant, per-user-turn).
// Codex rows carry cost=0 (see ratesFor above), so this chart — inherently a
// cost visualization — has nothing honest to plot; an empty-but-valid shape
// keeps renderContextCostCharts() in template.html from touching undefined
// fields, and the container itself is hidden client-side (host === 'codex').
const contextCostScatter = isCodex ? null : buildContextCostScatters(allTimelines, sessionMap);
const contextUsageScatter = isCodex ? buildContextUsageScatters(allTimelines, sessionMap) : null;

// Context size distribution — how efficiently is the user managing context?
const ctxBuckets = [
  { label: '~250K', min: 0, max: 250000, count: 0, cost: 0 },
  { label: '250~350K', min: 250000, max: 350000, count: 0, cost: 0 },
  { label: '350~500K', min: 350000, max: 500000, count: 0, cost: 0 },
  { label: '500K+', min: 500000, max: Infinity, count: 0, cost: 0 },
];
for (const row of allRows) {
  const ctx = (row.input || 0) + (row.cc || 0) + (row.cr || 0);
  const cost = row.cost || 0;
  for (const b of ctxBuckets) {
    if (ctx >= b.min && ctx < b.max) { b.count++; b.cost += cost; break; }
  }
}
const ctxDistribution = ctxBuckets.map(b => ({
  label: b.label, count: b.count, cost: round2(b.cost),
  avgCost: b.count > 0 ? round2(b.cost / b.count) : 0,
  pct: allRows.length > 0 ? round2(b.count / allRows.length * 100) : 0,
}));
const calendarDataEndExclusiveTs = allRows.length > 0 ? Math.max(...allRows.map(row => row.ts)) + 1 : null;

// ── Assemble REPORT_DATA ────────────────────────────────────────
// host/hasCostData/costKnownUSD/rateLimitSamples/windowMinutes are additive —
// a Claude report simply carries hasCostData:true and no rateLimitSamples,
// so a diff against the pre-Codex REPORT_DATA shape is a pure addition.
summary.host = isCodex ? 'codex' : 'claude';
summary.hasCostData = !isCodex;
summary.costKnownUSD = isCodex ? null : summary.totalCost;
summary.totalUsageTokens = Object.values(tb).reduce((sum, part) => sum + part.tokens, 0);
const reportData = {
  summary,
  tokenBreakdown: tb,
  windows,
  dailyCosts,
  dailyTokens,
  hourlyStats,
  dowStats,
  fiveHAlerts,
  contextCostScatter,
  ctxDistribution,
  pluginInstalledAt,
  currentMode,
  plan: planData ? { key: planData.key, name: planData.name, price: planData.price } : null,
  costThresholds: { turnWarn: TURN_COST_WARN, turnDanger: TURN_COST_DANGER, defaultFilter: DEFAULT_COST_FILTER },
  host: isCodex ? 'codex' : 'claude',
  sessionAttribution,
};
if (isCodex) {
  reportData.rateLimitSamples = raw.rateLimitSamples || [];
  reportData.canonicalRateLimits = raw.canonicalRateLimits || { limitId: 'codex', primary: null, secondary: null };
  reportData.rateLimitWindowMinutes = rateLimitWindowMinutes;
  reportData.calendarWindowMinutes = calendarWindowMinutes;
  reportData.calendarWindowSource = calendarWindowSource;
  reportData.windowSource = calendarWindowSource;
  reportData.windowMinutes = calendarWindowMinutes;
  reportData.calendarDataEndExclusiveTs = calendarDataEndExclusiveTs;
  reportData.hourlyUsageStats = hourlyUsageStats;
  reportData.dowUsageStats = dowUsageStats;
  reportData.contextUsageScatter = contextUsageScatter;
  reportData.codexCreditEquivalent = codexCreditEquivalent;
}

function buildCodexInsights(data, locale) {
  const total = data.summary.totalUsageTokens || 0;
  const fresh = data.tokenBreakdown.input.tokens || 0;
  const output = data.tokenBreakdown.output.tokens || 0;
  const cached = data.tokenBreakdown.cacheRead.tokens || 0;
  const cachedPct = total > 0 ? round2(cached / total * 100) : 0;
  const freshPct = total > 0 ? round2(fresh / total * 100) : 0;
  const outputPct = total > 0 ? round2(output / total * 100) : 0;
  const lane = selectLongestRateLimitLane(data.canonicalRateLimits);
  const blocked = (data.windows || []).filter(window => window.blockedAtTs != null);
  const busiestHour = (data.hourlyUsageStats || []).slice().sort((a, b) => b.avg - a.avg)[0];
  const busiestDow = (data.dowUsageStats || []).slice().sort((a, b) => b.avg - a.avg)[0];
  const contextBucket = (data.ctxDistribution || []).slice().sort((a, b) => b.count - a.count)[0];
  const contextCalls = (data.ctxDistribution || []).reduce((sum, bucket) => sum + bucket.count, 0);
  const largeContextCalls = (data.ctxDistribution || []).filter(bucket => /^350|^500/.test(bucket.label)).reduce((sum, bucket) => sum + bucket.count, 0);
  const apiCalls = data.contextUsageScatter && data.contextUsageScatter.perAssistant ? data.contextUsageScatter.perAssistant.totalCount : 0;
  const userTurns = data.contextUsageScatter && data.contextUsageScatter.perUserTurn ? data.contextUsageScatter.perUserTurn.totalCount : 0;
  const daily = (data.dailyTokens || []).slice();
  const peakDay = daily.slice().sort((a, b) => b.total - a.total)[0];
  const averageDay = daily.length ? Math.round(daily.reduce((sum, day) => sum + day.total, 0) / daily.length) : 0;
  const remaining = lane ? Math.max(0, round2(100 - lane.usedPercent)) : null;
  const resetText = lane && lane.resetsAt ? new Date(lane.resetsAt * 1000).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US') : null;
  const totalSessions = data.summary.sessionCount || 0;
  const subtasks = data.summary.subtaskCount || 0;
  const mainSessions = Math.max(0, totalSessions - subtasks);
  const fmt = value => Number(value || 0).toLocaleString('en-US');
  const localizedDow = busiestDow && localeData.chart && localeData.chart.days
    ? (localeData.chart.days[busiestDow.dow] || busiestDow.label) : (busiestDow && busiestDow.label);
  const ce = data.codexCreditEquivalent;
  const ceUsdText = ce ? (ce.status === 'unavailable' ? 'N/A' : `${ce.status === 'lower_bound' ? '≥' : ''}$${ce.usd.toFixed(2)}`) : null;
  // unavailableReason-specific wording: an invalid rate-card config or a
  // total absence of eligible (fresh/cached/output) tokens is NOT the same
  // fact as "no recorded model has a rate-card entry" — conflating them
  // would misreport a config bug or an empty-usage period as a pricing gap.
  const ceUnavailableReasonKo = {
    invalid_config: '요율표 설정이 유효하지 않아',
    no_eligible_tokens: '가격 산정 대상(신선/캐시/출력) 토큰이 기록되지 않아',
    no_priced_models: '기록된 모델 중 요율표에 있는 모델이 없어',
  };
  const ceUnavailableReasonEn = {
    invalid_config: 'the rate-card configuration is invalid',
    no_eligible_tokens: 'no eligible (fresh/cached/output) tokens were recorded',
    no_priced_models: 'no recorded model has a rate-card entry',
  };
  // The rate card's promotionThrough applies to exactly ONE model
  // (meta.promotionModel) — never phrase this as if the whole 12-row card
  // were promotional.
  const promoModel = ce && ce.meta && ce.meta.promotionModel;
  const promoThrough = ce && ce.meta && ce.meta.promotionThrough;
  const promoLineKo = promoModel && promoThrough ? ` ${promoModel} 요율만 ${promoThrough}까지 프로모션이며, 다른 모델에는 적용되지 않습니다.` : '';
  const promoLineEn = promoModel && promoThrough ? ` Only ${promoModel} is promotional, through ${promoThrough} — this does not apply to any other model on the rate card.` : '';
  const creditLineKo = ce && ce.status !== 'unavailable'
    ? ` 구매 크레딧 환산 비용(요율표 기준, 청구서·절감액·월간 예측 아님)은 ${ceUsdText}이며 적용 범위는 ${ce.coveragePctEligible.toFixed(1)}%입니다${ce.unpricedModels.length ? `(미가격 모델: ${ce.unpricedModels.join(', ')})` : ''}.${promoLineKo}`
    : (ce ? ` 구매 크레딧 환산 비용은 ${ceUnavailableReasonKo[ce.unavailableReason] || '계산할 수 없어'} N/A입니다.` : '');
  const creditLineEn = ce && ce.status !== 'unavailable'
    ? ` The purchased-credit-equivalent cost (a rate-card equivalent, not a bill, savings figure, or monthly projection) is ${ceUsdText} at ${ce.coveragePctEligible.toFixed(1)}% coverage${ce.unpricedModels.length ? ` (unpriced models: ${ce.unpricedModels.join(', ')})` : ''}.${promoLineEn}`
    : (ce ? ` The purchased-credit-equivalent cost is N/A because ${ceUnavailableReasonEn[ce.unavailableReason] || 'it could not be computed'}.` : '');
  if (locale === 'ko') {
    return {
      section1: `이 기간에는 총 ${fmt(total)} 토큰을 사용했습니다. 새 입력은 ${fmt(fresh)} 토큰(${freshPct}%), 캐시 읽기는 ${fmt(cached)} 토큰(${cachedPct}%), 출력은 ${fmt(output)} 토큰(${outputPct}%)입니다. 캐시 읽기 비중이 높을수록 긴 작업 맥락을 반복 활용했다는 뜻이지만, 구독 한도에서는 이 토큰도 사용량에 포함됩니다. Codex 구독 포함 사용량에서는 캐시 생성이 별도로 과금되지 않아 Cache Write 비용을 Not charged로 표시합니다. 다만 API 키로 직접 호출한 사용량은 해당 API 가격 정책을 따르므로 이 주석을 API 비용 면제로 해석하면 안 됩니다.${lane ? ` 현재 ${Math.round(lane.windowMinutes / 1440)}일 제한은 ${lane.usedPercent}% 사용됐고 ${remaining}% 남았습니다.` : ' 현재 로그에는 신뢰할 수 있는 구독 한도 샘플이 없습니다.'}${resetText ? ` 다음 초기화 예정 시각은 ${resetText}입니다.` : ''}${creditLineKo}`,
      section2: `${busiestHour ? `${busiestHour.hour}시가 활동일 평균 ${fmt(busiestHour.avg)} 토큰으로 가장 활발했습니다.` : '시간대 데이터가 아직 충분하지 않습니다.'}${busiestDow ? ` ${localizedDow}요일은 평균 ${fmt(busiestDow.avg)} 토큰으로 요일 중 가장 높았습니다.` : ''}${peakDay ? ` 일별 최고치는 ${peakDay.date}의 ${fmt(peakDay.total)} 토큰이며, 기록된 날의 일평균은 ${fmt(averageDay)} 토큰입니다.` : ''} Context 분석에는 ${fmt(contextCalls)}개 API 호출이 포함됐습니다.${contextBucket ? ` 가장 흔한 Context size는 ${contextBucket.label} 구간으로 ${fmt(contextBucket.count)}회입니다.` : ''} 350K 이상 장문 Context는 ${fmt(largeContextCalls)}회였습니다. 차트에는 성능을 위해 인접 호출을 모델별 버블로 묶었지만, 원시 호출 수 ${fmt(apiCalls)}개는 보존됩니다. 버블을 클릭하면 그 묶음에서 사용량이 큰 실제 호출과 세션·시간·토큰 구성을 확인할 수 있습니다. 사용자 대화 모드에는 ${fmt(userTurns)}개 대화 단위가 표시되어 한 프롬프트가 만든 전체 호출량을 비교할 수 있습니다.`,
      section3: `분석 대상은 총 ${fmt(totalSessions)}개 세션이며, 메인 ${fmt(mainSessions)}개와 서브태스크 ${fmt(subtasks)}개를 모두 포함합니다. 큰 세션 숫자에도 서브태스크가 포함되고 아래 보조 문구가 그 수를 따로 밝힙니다. 캘린더는 ${data.calendarWindowMinutes}분 단위의 실제 관측 구간만 그리며 아직 도래하지 않은 미래 시간은 만들지 않습니다. Weekly 한도 도달은 ${blocked.length}회 관측됐고, 도달한 정확한 시간 버킷만 blocked로 표시합니다.${blocked.length ? ` 관측 시각은 ${blocked.map(item => new Date(item.blockedAtTs * 1000).toLocaleString('ko-KR')).join(', ')}입니다.` : ''} 캘린더 셀을 클릭하면 그 시간의 세션과 토큰 상세가 열립니다. Token usage 슬라이더는 시간별 사용량 임계값을 바꾸며 blocked 셀은 필터와 관계없이 유지됩니다. 구독에서는 신뢰할 수 있는 CW 호출 구분이 없고 캐시 생성이 별도 과금되지 않으므로 Context 차트는 API 호출과 사용자 대화 두 보기로 통합했습니다.`,
    };
  }
  return {
    section1: `This period used ${fmt(total)} tokens: ${fmt(fresh)} fresh input (${freshPct}%), ${fmt(cached)} cached input (${cachedPct}%), and ${fmt(output)} output (${outputPct}%). A high cached-input share means long working context was reused, but those tokens still count toward the subscription allowance. Cache creation is not separately charged for included Codex subscription usage, so Cache Write is marked Not charged. API-key usage follows its applicable API pricing and is not covered by that subscription note.${lane ? ` The ${Math.round(lane.windowMinutes / 1440)}-day allowance is ${lane.usedPercent}% used with ${remaining}% remaining.` : ' No reliable subscription-limit sample is present.'}${resetText ? ` The next reported reset is ${resetText}.` : ''}${creditLineEn}`,
    section2: `${busiestHour ? `${busiestHour.hour}:00 was the busiest hour at ${fmt(busiestHour.avg)} average tokens on active days.` : 'There is not enough hourly data yet.'}${busiestDow ? ` ${busiestDow.label} had the highest weekday average at ${fmt(busiestDow.avg)} tokens.` : ''}${peakDay ? ` The peak day was ${peakDay.date} at ${fmt(peakDay.total)} tokens, versus ${fmt(averageDay)} tokens per recorded day.` : ''} Context analysis includes ${fmt(contextCalls)} API calls.${contextBucket ? ` The most common context band was ${contextBucket.label}, with ${fmt(contextBucket.count)} calls.` : ''} ${fmt(largeContextCalls)} calls used contexts of at least 350K. Nearby calls are clustered by model for rendering speed, while the raw total of ${fmt(apiCalls)} calls is preserved. Click a bubble to inspect its highest-usage calls, session IDs, times, and token composition. User Conversations contains ${fmt(userTurns)} prompt-level aggregates so one prompt can be compared with all calls it triggered.`,
    section3: `The report covers ${fmt(totalSessions)} sessions in total: ${fmt(mainSessions)} main sessions and ${fmt(subtasks)} subtasks. The large session count includes subtasks, and the subtitle discloses their count separately. The calendar renders only observed ${data.calendarWindowMinutes}-minute buckets and does not create future hours. Weekly blocking was observed ${blocked.length} times, with only the exact affected hour marked blocked.${blocked.length ? ` The recorded times are ${blocked.map(item => new Date(item.blockedAtTs * 1000).toLocaleString('en-US')).join(', ')}.` : ''} Click a calendar cell to inspect its sessions and token details. The token-usage slider changes the hourly threshold while blocked cells remain visible. Because subscriptions expose no reliable CW-call split and cache creation is not separately charged, the context chart is consolidated into API Calls and User Conversations.`,
  };
}

if (isCodex && !reportData.aiAnalysis) reportData.aiAnalysis = buildCodexInsights(reportData, resolvedLocale);

// Compute before/after plugin install cost averages (must be before export)
if (reportData.pluginInstalledAt && reportData.dailyTokens) {
  const installDate = new Date(reportData.pluginInstalledAt).toISOString().slice(0, 10);
  const installIdx = reportData.dailyCosts.findIndex(d => {
    const parts = d.date.split('/');
    if (parts.length === 2) {
      const m = parseInt(parts[0]), dy = parseInt(parts[1]);
      const year = toD.getFullYear();
      const dStr = year + '-' + String(m).padStart(2, '0') + '-' + String(dy).padStart(2, '0');
      return dStr >= installDate;
    }
    return false;
  });
  if (installIdx > 0 && installIdx < reportData.dailyTokens.length) {
    // Cost averages
    let beforeCost = 0, afterCost = 0, beforeDays = 0, afterDays = 0;
    for (let i = 0; i < reportData.dailyCosts.length; i++) {
      const dc = reportData.dailyCosts[i];
      const dayCost = round2(dc.input + dc.cacheCreate + dc.cacheRead + dc.output);
      if (i < installIdx) { beforeCost += dayCost; beforeDays++; }
      else { afterCost += dayCost; afterDays++; }
    }
    if (beforeDays > 0) reportData._costAvgBefore = round2(beforeCost / beforeDays);
    if (afterDays > 0) reportData._costAvgAfter = round2(afterCost / afterDays);
    // Efficiency: weighted average (sum total / sum output)
    let beforeTotal = 0, beforeOut = 0, afterTotal = 0, afterOut = 0;
    for (let i = 0; i < reportData.dailyTokens.length; i++) {
      const dt = reportData.dailyTokens[i];
      if (dt.out < 1000) continue;
      if (i < installIdx) { beforeTotal += dt.total; beforeOut += dt.out; }
      else { afterTotal += dt.total; afterOut += dt.out; }
    }
    if (beforeOut > 0) reportData._effBefore = round2(beforeTotal / beforeOut);
    if (afterOut > 0) reportData._effAfter = round2(afterTotal / afterOut);
    reportData._installIdx = installIdx;
  }
}

// ── Private mode: strip user prompt text from REPORT_DATA ──────
// Must run BEFORE --export-data (and before the template injection further
// below) — both consume the SAME `reportData` object, so redaction applied
// after either of those would leave raw identifiers/text in the exported
// JSON or the shipped HTML.
//
// Redaction of session/thread/nickname identifiers (gap-remediation item 3):
// a pure hash of the raw value, so the SAME id always redacts to the SAME
// token everywhere it appears (a subagent's parentSessionId and the parent's
// own detail.id, for instance) — letting a private-mode reader still see
// "these rows share a session/thread" without recovering the real id.
// Falsy values (null/undefined/'') pass through unchanged; they already
// carry no identity.
function redactIdentifier(kind, value) {
  if (!value) return value;
  return kind + '_' + crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 8);
}
if (privateMode) {
  for (const w of reportData.windows) {
    w.firstMsg = '';
    w.lastMsg = '';
    for (const s of (w.windowSessions || [])) {
      s.firstMsg = '';
      s.lastMsg = '';
      if (s.id) s.id = redactIdentifier('sess', s.id);
      for (const d of (s.details || [])) {
        if (d.id) d.id = redactIdentifier('sess', d.id);
        if (d.taskThreadId) d.taskThreadId = redactIdentifier('thread', d.taskThreadId);
        if (d.parentSessionId) d.parentSessionId = redactIdentifier('sess', d.parentSessionId);
        if (d.agentNickname && d.agentNickname !== 'unknown') d.agentNickname = redactIdentifier('nick', d.agentNickname);
      }
    }
    for (const a of (w.alertMessages || [])) {
      a.text = '';
    }
  }
  if (reportData.contextCostScatter) {
    const stripBubbles = (dataset) => {
      if (!dataset || !dataset.bubbles) return;
      for (const b of dataset.bubbles) {
        b.text = '';
        if (b.topTexts) {
          for (const t of b.topTexts) t.text = '';
        }
      }
    };
    const pa = reportData.contextCostScatter.perAssistant;
    if (pa) { stripBubbles(pa.cw); stripBubbles(pa.nonCW); }
    stripBubbles(reportData.contextCostScatter.perUserTurn);
  }
  if (reportData.fiveHAlerts) {
    for (const a of reportData.fiveHAlerts) a.text = '';
  }
  reportData.privateMode = true;
  console.error('Private mode: user prompt text stripped from report data');
}

if (exportDataPath) {
  fs.writeFileSync(exportDataPath, JSON.stringify(reportData));
  console.error('Report data exported to ' + exportDataPath);
}

// ── AI Analysis (optional, from external file) ────────────────
if (aiDataPath) {
  try {
    const aiAnalysis = JSON.parse(fs.readFileSync(aiDataPath, 'utf8'));
    if (aiAnalysis.section1 || aiAnalysis.section2 || aiAnalysis.section3 || aiAnalysis.section4) {
      addBidiToAI(aiAnalysis);
      reportData.aiAnalysis = aiAnalysis;
      const count = [aiAnalysis.section1, aiAnalysis.section2, aiAnalysis.section3, aiAnalysis.section4].filter(Boolean).length;
      console.error('AI analysis: ' + count + ' sections loaded from ' + aiDataPath);
    }
  } catch (e) {
    console.error('AI analysis: failed to read ' + aiDataPath + ' - ' + e.message);
  }
}

// ── Export AI prompt (optional, from reportData) ───────────────
if (exportPromptPath) {
  const s = reportData.summary;
  const tb = reportData.tokenBreakdown;
  const hourly = reportData.hourlyStats.filter(h => h.avg > 0)
    .sort((a, b) => b.avg - a.avg)
    .map(h => h.hour + 'h: avg=$' + h.avg + ', max=$' + h.max)
    .join('\n');
  const dow = reportData.dowStats.map(d => d.label + ': avg=$' + d.avg + ', max=$' + d.max).join('\n');
  // Weekly grouping from dailyCosts
  const weeks = []; let wCost = 0, wDays = [], wn = 1;
  for (const d of reportData.dailyCosts) {
    const total = round2(d.input + d.cacheCreate + d.cacheRead + d.output);
    wCost += total; wDays.push(d.date + ':$' + total);
    if (wDays.length === 7) {
      weeks.push('Week' + wn + ': total=$' + round2(wCost) + ' [' + wDays.join(', ') + ']');
      wCost = 0; wDays = []; wn++;
    }
  }
  if (wDays.length > 0) weeks.push('Week' + wn + ': total=$' + round2(wCost) + ' [' + wDays.join(', ') + ']');
  // Top sessions
  const topSessions = [];
  for (const w of reportData.windows) {
    if (!w.windowSessions) continue;
    for (const ws of w.windowSessions) {
      if (ws.cost > 0) topSessions.push({ date: w.date, cost: ws.cost, msg: (ws.firstMsg || '').slice(0, 80), type: ws.type });
    }
  }
  topSessions.sort((a, b) => b.cost - a.cost);
  const top10 = topSessions.slice(0, 15).map(t => '$' + t.cost.toFixed(1) + ' [' + t.type + '] (' + t.date + ') ' + t.msg).join('\n');
  // Rate limit & continue events
  const rlCount = reportData.fiveHAlerts ? reportData.fiveHAlerts.length : 0;
  const pi = planData ? { label: planData.label, price: planData.priceNum, type: planData.type } : { label: 'unknown', price: null, type: 'unknown' };
  const reportDays = s.days || 1;
  const shouldExtrapolate = reportDays <= 15;
  const projectedMonthly = shouldExtrapolate ? round2((s.totalCost / reportDays) * 30) : null;
  let planLine;
  if (pi.type === 'flat') {
    if (shouldExtrapolate) {
      const multiple = (projectedMonthly / pi.price).toFixed(1);
      planLine = `- Projected monthly API value: $${projectedMonthly} (${multiple}x of $${pi.price} subscription)
- Billing: flat-rate. User pays $${pi.price}/mo regardless of usage. Higher multiple = more value extracted.`;
    } else {
      planLine = `- Total API value: $${s.totalCost} over ${reportDays} days on a $${pi.price}/mo subscription.
- Billing: flat-rate. User pays $${pi.price}/mo regardless of usage.`;
    }
    planLine += `\n- Rate limit management is key: spread usage across 5h windows, avoid bursts, use cache efficiently, use /continue instead of /compact.
- If frequently hitting limits, suggest upgrading plan OR optimizing usage patterns to stay within the ceiling.`;
  } else if (pi.type === 'usage') {
    if (shouldExtrapolate) {
      planLine = `- Projected monthly cost: $${projectedMonthly} — this is the actual projected bill.`;
    } else {
      planLine = `- Total cost: $${s.totalCost} over ${reportDays} days.`;
    }
    planLine += `\n- Billing: usage-based (pay per token). Every token costs real money.
- Prioritize cost optimization: cache reuse, /continue over /compact, shorter prompts, model selection (Haiku for simple tasks).`;
  } else {
    if (shouldExtrapolate) {
      planLine = `- Projected monthly API value: $${projectedMonthly}`;
    } else {
      planLine = `- Total API value: $${s.totalCost} over ${reportDays} days.`;
    }
    planLine += `\n- Billing: unknown plan.`;
  }
  planLine += '\n\n## Plan Comparison (for upgrade/downgrade advice)\n'
    + '| Plan | Monthly | Rate Limit | Type |\n'
    + '|------|---------|------------|------|\n'
    + '| Pro | $20/mo | 1x (baseline) | flat |\n'
    + '| Max 5x | $100/mo | 5x of Pro | flat |\n'
    + '| Max 20x | $200/mo | 20x of Pro | flat |\n'
    + '| Team Standard | $20/seat/mo | >1x of Pro (exact unknown) | flat |\n'
    + '| Team Premium | $100/seat/mo | 5x of Team Standard | flat |\n'
    + '| Enterprise | $20/seat + API | usage-based pooled | usage |\n'
    + '| Bedrock/Foundry/Vertex | API pricing | no rate limit ceiling | usage |';

  // Continue events: from marker counts (preprocess detects <command-message>super-token-saver:continue)
  // markerCounts.continue is populated from alertMessages which come from compact caches

  // Alert marker summary (from all windows)
  const markerCounts = { startup: 0, cost: 0, context: 0, resume: 0, continue: 0, modelChange: 0, blockedWindows: 0 };
  for (const w of reportData.windows) {
    if (w.rlHours && w.rlHours.length > 0) markerCounts.blockedWindows++;
    if (!w.alertMessages) continue;
    for (const a of w.alertMessages) {
      const t = a.alertType || '';
      if (t.includes('startup') || t.includes('clear')) markerCounts.startup++;
      if (t.includes('cost-')) markerCounts.cost++;
      if (t.includes('ctx-')) markerCounts.context++;
      if (t.includes('resume') || t.includes('compact')) markerCounts.resume++;
      if (t.includes('continue-')) markerCounts.continue++;
      if (t.includes('model-change')) markerCounts.modelChange++;
    }
  }

  // Efficiency before/after plugin install (already computed above, before export)
  const effBefore = reportData._effBefore ? reportData._effBefore.toString() : '';
  const effAfter = reportData._effAfter ? reportData._effAfter.toString() : '';
  const costComparison = (reportData._costAvgBefore && reportData._costAvgAfter)
    ? `Daily avg cost — Before plugin: $${reportData._costAvgBefore}/day, After plugin: $${reportData._costAvgAfter}/day` +
      (reportData._costAvgBefore > reportData._costAvgAfter
        ? ` (${round2((1 - reportData._costAvgAfter / reportData._costAvgBefore) * 100)}% reduced)`
        : '')
    : 'Not enough data for cost before/after comparison';
  const effComparison = (effBefore && effAfter)
    ? `Before plugin: ${effBefore}x, After plugin: ${effAfter}x (lower is better, ${effBefore > effAfter ? round2((1 - effAfter / effBefore) * 100) + '% improved' : 'no improvement yet'})`
    : 'Not enough data for before/after comparison';

  // Load model pricing for AI prompt
  const pricingData = JSON.parse(fs.readFileSync(path.join(__dirname, 'model-pricing.json'), 'utf8'));
  const pricingTable = Object.entries(pricingData.models)
    .filter(([k]) => ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'].includes(k))
    .map(([k, v]) => `${k}: input=$${v.input}/MTok, cw5m=$${v.cacheCreate5m}, cw1h=$${v.cacheCreate1h}, cr=$${v.cacheRead}, output=$${v.output}`)
    .join('\n');

  const codexLane = isCodex ? selectLongestRateLimitLane(reportData.canonicalRateLimits) : null;
  const codexBlocked = isCodex ? reportData.windows.filter(w => w.blockedAtTs != null) : [];
  const codexCalls = isCodex && reportData.contextUsageScatter
    ? reportData.contextUsageScatter.perAssistant.totalCount : 0;
  const codexTurns = isCodex && reportData.contextUsageScatter
    ? reportData.contextUsageScatter.perUserTurn.totalCount : 0;
  const codexPrompt = isCodex ? `## Codex Usage Data (THESE ARE THE ONLY NUMBERS YOU MAY USE)
- Period: ${s.dateFrom} ~ ${s.dateTo} (${s.days} days)
- Total usage: ${s.totalUsageTokens.toLocaleString()} tokens
- Sessions: ${s.sessionCount} total (${Math.max(0, s.sessionCount - (s.subtaskCount || 0))} main + ${s.subtaskCount || 0} subtasks)
- Plan: ${reportData.plan ? reportData.plan.name : 'not reported'}
- Billing fact: included subscription usage does not separately charge cache creation. API-key usage may be billed under its applicable API pricing.
- Subscription allowance: ${codexLane ? codexLane.usedPercent + '% used, ' + Math.max(0, round2(100 - codexLane.usedPercent)) + '% remaining, ' + codexLane.windowMinutes + '-minute lane, reset ' + new Date(codexLane.resetsAt * 1000).toISOString() : 'not reported'}

## Token Breakdown
- Fresh input: ${tb.input.tokens.toLocaleString()} tokens
- Output: ${tb.output.tokens.toLocaleString()} tokens
- Cache creation: Not charged for included subscription usage; reliable write-token count is not exposed
- Cached input: ${tb.cacheRead.tokens.toLocaleString()} tokens

## Hourly Token Pattern
${(reportData.hourlyUsageStats || []).map(h => h.hour + ':00 avg=' + h.avg.toLocaleString() + ', max=' + h.max.toLocaleString() + ', calendarAvg=' + h.calAvg.toLocaleString()).join('\n')}

## Day-of-Week Token Pattern
${(reportData.dowUsageStats || []).map(d => d.label + ': avg=' + d.avg.toLocaleString() + ', max=' + d.max.toLocaleString() + ', calendarAvg=' + d.calAvg.toLocaleString()).join('\n')}

## Daily Token Usage
${(reportData.dailyTokens || []).map(d => d.date + ': total=' + d.total.toLocaleString() + ', freshInput=' + d.input.toLocaleString() + ', cachedInput=' + d.cr.toLocaleString() + ', output=' + d.out.toLocaleString()).join('\n')}

## Context Size Distribution
${(reportData.ctxDistribution || []).map(b => b.label + ': ' + b.count.toLocaleString() + ' calls (' + b.pct + '%)').join('\n')}
- API calls eligible for the context chart: ${codexCalls.toLocaleString()}
- User-conversation aggregates: ${codexTurns.toLocaleString()}
- Models: ${((reportData.contextUsageScatter && reportData.contextUsageScatter.models) || []).join(', ') || 'not reported'}
- Chart behavior: nearby calls are clustered by model for speed; clicking a bubble reveals underlying calls.

## Weekly Limit & Blocking
- Blocked moments: ${codexBlocked.length}
${codexBlocked.map(w => '- ' + new Date(w.blockedAtTs * 1000).toISOString()).join('\n') || '- none observed'}
- Calendar bucket: ${reportData.calendarWindowMinutes} minutes
- Calendar renders observed time only; future buckets are not created.

## Purchased-Credit-Equivalent Cost (rate-card equivalent — read the caveat)
${reportData.codexCreditEquivalent ? `- Value: ${reportData.codexCreditEquivalent.status === 'unavailable' ? 'N/A (' + ({ invalid_config: 'the rate-card configuration is invalid', no_eligible_tokens: 'no eligible fresh/cached/output tokens were recorded', no_priced_models: 'no recorded model has a rate-card entry' }[reportData.codexCreditEquivalent.unavailableReason] || 'it could not be computed') + ')' : (reportData.codexCreditEquivalent.status === 'lower_bound' ? '≥' : '') + '$' + reportData.codexCreditEquivalent.usd.toFixed(2)}
- Coverage: ${reportData.codexCreditEquivalent.coveragePctEligible.toFixed(1)}% of eligible (fresh+cached+output) tokens
- Unpriced models: ${reportData.codexCreditEquivalent.unpricedModels.length ? reportData.codexCreditEquivalent.unpricedModels.join(', ') : 'none'}
- Cache-write tokens are excluded (known subscription zero-charge, not an unknown gap): ${reportData.codexCreditEquivalent.excludedKnownZeroChargeTokens.cacheWrite.toLocaleString()}
- Pricing basis: retrieved ${(reportData.codexCreditEquivalent.meta && reportData.codexCreditEquivalent.meta.retrievedAt) || 'unknown'}.${(reportData.codexCreditEquivalent.meta && reportData.codexCreditEquivalent.meta.promotionThrough) ? ` ${(reportData.codexCreditEquivalent.meta.promotionModel || 'a specific model')} only is promotional through ${reportData.codexCreditEquivalent.meta.promotionThrough} — this does NOT apply to the rest of the rate card.` : ''}
- STRICT RULE: this is a rate-card equivalent only. Never call it a bill, a savings figure, or a monthly projection, never extrapolate it, and never imply the promotion above covers any model other than the one named.` : '- Not computed for this report.'}

## Interpretation Boundaries
- Do not invent dollar cost, subscription credit allocation, or unpublished long-context weighting.
- The purchased-credit-equivalent cost above is the ONLY dollar-shaped figure you may state for Codex usage, and only using the exact wording rule given for it.
- Cached input is reused context and still counts toward the subscription allowance.
- The large session count includes subtasks.
- Use three sections with the same depth and tone as the Claude report: section1 8-9 sentences, section2 14-16 sentences, section3 10 sentences.` : '';

  const claudePrompt = `## Usage Data (THESE ARE THE ONLY NUMBERS YOU MAY USE)
(Summary stats shown at the top of the dashboard)
- Period: ${s.dateFrom} ~ ${s.dateTo} (${s.days} days)
- Total cost: $${s.totalCost}, Sessions: ${s.sessionCount} main + ${s.subtaskCount || 0} subtasks
- Plan: ${pi.label}

## API Pricing (per million tokens — use these exact numbers when discussing costs)
(Reference pricing for the models used. Shown as price lines in the "Cost by Context Size" chart)
${pricingTable}
- RULE: Monthly cost extrapolation is ONLY allowed when report period <= 15 days. This report covers ${reportDays} days${shouldExtrapolate ? ' — extrapolation is allowed.' : ' (>15) — do NOT extrapolate or mention monthly projections at all. Simply omit it — do NOT say "extrapolation is not needed" or similar.'}
${planLine}
- Plugin installed: ${reportData.pluginInstalledAt ? new Date(reportData.pluginInstalledAt).toISOString().slice(0, 10) : 'not detected'}

## Token Breakdown
(Shown in the "Token Details" table and "Cost Breakdown" pie chart)
- Input (non-cached new tokens): ${tb.input.tokens.toLocaleString()} tokens ($${tb.input.cost})
- Output (AI response tokens): ${tb.output.tokens.toLocaleString()} tokens ($${tb.output.cost})
- Cache Create 1h (re-storing conversation, 1h tier — main sessions): ${tb.cacheCreate1h.tokens.toLocaleString()} tokens ($${tb.cacheCreate1h.cost})
- Cache Create 5m (re-storing conversation, 5m tier — subtasks): ${tb.cacheCreate5m.tokens.toLocaleString()} tokens ($${tb.cacheCreate5m.cost})
- Cache Read (reusing previously stored conversation): ${tb.cacheRead.tokens.toLocaleString()} tokens ($${tb.cacheRead.cost})

## Hourly Cost Pattern
(Shown in the "Hourly Cost Pattern" bar chart. Avg = active days only, CalAvg = all calendar days)
${hourly}

## Day-of-Week Cost Pattern
(Shown in the "Day-of-Week Cost Pattern" bar chart)
${dow}

## Weekly Costs
(Same data as the "Daily Cost Trend" line chart, grouped by week)
${weeks.join('\n')}

## Rate Limit & Blocking
(Skull icons on the calendar heatmap = rate limit hit)
- Rate-limited windows: ${markerCounts.blockedWindows}
- 5H window alerts: ${rlCount}

## /continue Skill Usage
(super-token-saver plugin feature — restores previous sessions with ZERO API cost)
- Times used: ${markerCounts.continue}

## Session Activity Summary
(Event counts detected from calendar alert markers)
- Session starts/clears: ${markerCounts.startup}
- Cost warnings (per-user-turn ≥$${TURN_COST_WARN}): ${markerCounts.cost}
- Context size warnings (context window ≥35%): ${markerCounts.context}
- Resume/compact events (cache regeneration): ${markerCounts.resume}
- Model changes: ${markerCounts.modelChange}

## Plugin Before/After Comparison
Cost: ${costComparison}
Efficiency (Total/Output ratio, lower = better): ${effComparison}

## API Calls — Dominant Token Type Breakdown
(From the "Cost by Context Size" bubble chart. Each API call is classified by its most expensive token type)
${(() => {
  const pa = reportData.contextCostScatter && reportData.contextCostScatter.perAssistant;
  if (!pa) return 'No scatter data available';
  const bd = pa.dominantBreakdown || { input:0, output:0, cacheCreate:0, cacheRead:0 };
  const total = pa.totalCount;
  function pct(n) { return total > 0 ? (100 * n / total).toFixed(1) + '%' : '0%'; }
  const cwData = pa.cw || { totalCount: 0 };
  const nonCwData = pa.nonCW || { totalCount: 0 };
  return 'Total API calls analyzed: ' + total + '\n'
    + 'CW (cache_write dominant, $1+): ' + cwData.totalCount + ' calls\n'
    + 'Non-CW (input+output+cache_read dominant): ' + nonCwData.totalCount + ' calls\n'
    + '\nBreakdown by dominant cost contributor:\n'
    + '- input dominant:        ' + bd.input        + ' calls (' + pct(bd.input) + ')\n'
    + '- output dominant:       ' + bd.output       + ' calls (' + pct(bd.output) + ')\n'
    + '- cache_write dominant:  ' + bd.cacheCreate  + ' calls (' + pct(bd.cacheCreate) + ')\n'
    + '- cache_read dominant:   ' + bd.cacheRead    + ' calls (' + pct(bd.cacheRead) + ')\n'
    + '\nModel breakdown (CW / Non-CW):\n'
    + (() => {
      const models = { O: 'Opus', S: 'Sonnet', H: 'Haiku' };
      const cwBubbles = (cwData.bubbles || []);
      const ncBubbles = (nonCwData.bubbles || []);
      const counts = {};
      for (const b of cwBubbles) { const m = models[b.mdl] || 'Other'; if (!counts[m]) counts[m] = { cw: 0, ncw: 0 }; counts[m].cw += b.n; }
      for (const b of ncBubbles) { const m = models[b.mdl] || 'Other'; if (!counts[m]) counts[m] = { cw: 0, ncw: 0 }; counts[m].ncw += b.n; }
      return Object.entries(counts).map(([m, c]) => '- ' + m + ': CW=' + c.cw + ', Non-CW=' + c.ncw).join('\n');
    })()
    + '\n\nKEY INSIGHT: Opus cache write is the most expensive per-call cost. '
    + 'Non-CW calls are cheaper individually but accumulate — context size management keeps their total down.';
})()}

## Context Size Efficiency
(From the "Context Size Distribution" bar chart. Shows how many API calls fall into each context size bucket)
${(() => {
  const dist = reportData.ctxDistribution;
  if (!dist || dist.length === 0 || dist.every(b => b.count === 0)) return 'NO DATA — do not mention context distribution in the analysis.';
  return dist.map(b =>
    b.label + ': ' + b.count + ' calls (' + b.pct + '%), total $' + b.cost + ', avg $' + b.avgCost + '/call'
  ).join('\n') + '\nKEY INSIGHT: Lower context = cheaper per call. 500K+ calls are disproportionately expensive. Guide users to /clear then /continue before context grows past 350K.';
})()}

## Calendar Cost Threshold
- Cost warnings shown in calendar use per-user-turn threshold: ≥$${TURN_COST_WARN} (warning), ≥$${TURN_COST_DANGER} (danger)
- Calendar default filter: $${DEFAULT_COST_FILTER} (adjustable by user via slider)
- IMPORTANT: Only mention data that IS shown in the report. If a section says "NO DATA", do NOT fabricate numbers or analysis for it.

## Top Cost Sessions
${top10}

## Plugin: super-token-saver
super-token-saver is a Claude Code plugin that:
- Shows real-time token usage in the CLI statusline (input/output/cache tokens per message)
- Tracks 5-hour rate-limit window consumption with visual alerts at 80%/95%
- Provides /continue skill to restore previous sessions WITHOUT any LLM API calls (zero cost)
- Generates interactive HTML usage dashboards for cost visibility and pattern analysis
- Has 2 automatic hooks: context size monitoring + cost tracking per message
- /setup-statusline: real-time token counter in CLI
- /report-limit: report rate limit data to community (reverse-engineering the formula)

### /continue Skill (Key Feature)
Unlike Claude Code's built-in /compact which:
- Calls the LLM to generate a summary -> costs cache_write + output tokens
- Next session: input + output + cache_write tokens again
- Loses original conversation nuance in summarization

super-token-saver's /continue skill:
- Uses only the Read tool to restore previous session transcripts — ZERO LLM API calls
- Preserves the ORIGINAL user+assistant conversation text verbatim (not a summary)
- For long conversations, uses (...) to abbreviate middle sections but includes line numbers pointing to the original transcript, so full context is always recoverable
- Can selectively restore from MULTIPLE previous sessions (not just the last one)
- As long as transcripts exist, 100% of original context is recoverable
- Much faster than /compact (no LLM round-trip)
- Only costs input + cache_write tokens when the restored context enters the next conversation turn — no output or summarization cost`;

  const prompt = isCodex ? codexPrompt : claudePrompt;

  // Current mode: strip section2/3 data from AI prompt to save tokens
  let finalPrompt = prompt;
  if (currentMode) {
    // Remove sections that feed section2/3 while preserving the same fast
    // current-mode behavior on both hosts.
    const currentOnlySections = isCodex
      ? [/## Hourly Token Pattern[\s\S]*?(?=## |$)/, /## Day-of-Week Token Pattern[\s\S]*?(?=## |$)/, /## Daily Token Usage[\s\S]*?(?=## |$)/, /## Context Size Distribution[\s\S]*?(?=## |$)/, /## Weekly Limit & Blocking[\s\S]*?(?=## |$)/]
      : [/## Hourly Cost Pattern[\s\S]*?(?=## |$)/, /## Day-of-Week Cost Pattern[\s\S]*?(?=## |$)/, /## Weekly Costs[\s\S]*?(?=## |$)/, /## Rate Limit & Blocking[\s\S]*?(?=## |$)/, /## Session Activity Summary[\s\S]*?(?=## |$)/, /## Plugin Before\/After Comparison[\s\S]*?(?=## |$)/, /## \/continue Skill Usage[\s\S]*?(?=## |$)/];
    for (const section of currentOnlySections) finalPrompt = finalPrompt.replace(section, '');
  }

  fs.writeFileSync(exportPromptPath, finalPrompt);
  console.error('AI prompt exported to ' + exportPromptPath);
}


// ── Template injection ──────────────────────────────────────────
let template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
template = injectI18N(template);
template = injectHtmlLang(template);
const marker_start = '/*<!-- REPORT_DATA_START -->*/';
const marker_end = '/*<!-- REPORT_DATA_END -->*/';
const startIdx = template.indexOf(marker_start);
const endRaw = template.indexOf(marker_end);

if (startIdx === -1 || endRaw === -1) {
  console.error('Error: REPORT_DATA markers not found in template');
  process.exit(1);
}
const endIdx = endRaw + marker_end.length;

const jsonStr = JSON.stringify(reportData, null, 0).replace(/<\//g, '<\\/');
const output = template.slice(0, startIdx) +
  marker_start + '\nconst REPORT_DATA = ' + jsonStr + ';\n' + marker_end +
  template.slice(endIdx);

fs.writeFileSync(outputPath, output);
console.error(`Report written to ${outputPath} (${output.length} bytes)`);

})();
