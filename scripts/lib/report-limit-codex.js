/**
 * report-limit-codex.js — /report-limit for Codex.
 *
 * The report is the Claude Code report: the same window table, the same per-window CSV
 * files, the same totals and metrics (lib/report-window.js). Only the windows differ.
 * Claude Code does not state its windows, so they are rebuilt; Codex states them outright —
 * every token_count row carries, per lane, the used percentage, the window length and the
 * reset instant (analyze-usage.js keeps them as `rateLimitSamples` in each session summary).
 * What Codex does not publish is how many tokens one percent is, so each window also carries
 * its used % next to the tokens spent inside it.
 *
 * One window is one (limit id, lane, window length) with one reset instant. Codex reports the
 * same reset a few seconds apart from sample to sample, so resets within RESET_JITTER_S of each
 * other are one window.
 *
 * Accounts work as in the Claude Code report: with two or more login accounts on record,
 * each account is its own section, numbered, never named.
 */

const fs = require('fs');
const path = require('path');
const { forHost } = require('./cache-paths');
const { loadAccountIndex, accountOf, listAccounts } = require('./accounts');
const { fmtDate, fmtTime } = require('./format');
const { log, makeReportDir, accountHeading, toolVersion, publishReport } = require('./report-publish');
const { summarizeWindow, buildWindowTable, writeWindowFiles, isGistFile } = require('./report-window');

const RESET_JITTER_S = 120;
const RATELIMIT_HEADER = 'ts,limit,lane,window_min,resets_at,used_pct,plan';

const codex = forHost('codex');

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function readCsvLines(csvPath) {
  if (!fs.existsSync(csvPath)) return [];
  const content = fs.readFileSync(csvPath, 'utf8').trim();
  return content ? content.split('\n') : [];
}

/**
 * Every cached Codex session: its project, id, summary (null when missing), and its tag in
 * the report — `agent-<id>` for a subagent, as in the Claude Code report.
 */
function listCachedSessions() {
  const out = [];
  for (const proj of codex.listProjects()) {
    for (const sess of codex.listSessions(proj)) {
      const summary = readJson(codex.getSummaryPath(proj, sess));
      const tag = summary && summary.isSubagent ? 'agent-' + sess : sess;
      out.push({ proj, sess, tag, summary });
    }
  }
  return out;
}

/**
 * One account's limit windows, from its rate-limit samples. A limit can reset before its
 * scheduled time (measured: 49 s after reaching 100%); the next window of the same lane then
 * takes over, so each window is active until the earlier of its reset and that next start.
 * @returns {Array<{limitId, lane, windowMinutes, start, end, activeEnd, samples}>} sorted by start
 */
function groupSamplesIntoWindows(samples) {
  const byLane = new Map(); // limit|lane|window length → samples
  for (const s of samples) {
    if (!(s.windowMinutes > 0) || !(s.resetsAt > 0)) continue;
    const key = [s.limitId, s.lane, s.windowMinutes].join('|');
    if (!byLane.has(key)) byLane.set(key, []);
    byLane.get(key).push(s);
  }
  const windows = [];
  for (const laneSamples of byLane.values()) {
    laneSamples.sort((a, b) => a.resetsAt - b.resetsAt);
    const lane = [];
    let current = null;
    for (const s of laneSamples) {
      if (!current || s.resetsAt - current.lastReset > RESET_JITTER_S) {
        current = {
          limitId: s.limitId, lane: s.lane, windowMinutes: s.windowMinutes,
          end: s.resetsAt, start: s.resetsAt - s.windowMinutes * 60, lastReset: s.resetsAt, samples: [],
        };
        lane.push(current);
      }
      current.lastReset = s.resetsAt;
      current.samples.push(s);
    }
    lane.forEach((w, i) => {
      w.samples.sort((a, b) => a.tsSec - b.tsSec);
      w.activeEnd = i + 1 < lane.length ? Math.min(w.end, lane[i + 1].start) : w.end;
    });
    windows.push(...lane);
  }
  return windows.sort((a, b) => a.start - b.start || String(a.limitId).localeCompare(String(b.limitId)));
}

/**
 * The window's used-% samples, kept where the percent rises. Concurrent sessions report the
 * same window with stale values (measured: 1% then 0% then 1%); within one window the percent
 * only goes up, so a lower value is a stale one.
 */
function risingSamples(samples) {
  const out = [];
  let max = -Infinity;
  for (const s of samples) {
    const used = Number(s.usedPercent);
    if (used <= max) continue;
    max = used;
    out.push(s);
  }
  return out;
}

/**
 * The account's timeline rows in [start, end), sorted by ts, shaped as the Claude Code report
 * rows ({ ts, req, cols, tag }); the model is filled forward per file.
 */
function loadAccountRows(sessions, belongs, start, end) {
  const rows = [];
  const tagFile = new Map();
  for (const { proj, sess, tag } of sessions) {
    const file = codex.getTimelinePath(proj, sess);
    const lines = readCsvLines(file);
    let prevModel = '';
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 11) continue;
      if (cols[1]) prevModel = cols[1]; else cols[1] = prevModel;
      const ts = Number(cols[0]);
      if (!(ts >= start && ts < end) || !belongs(sess, ts)) continue;
      rows.push({ ts, req: cols[13] || '', cols, tag });
      tagFile.set(tag, file);
    }
  }
  return { rows: rows.sort((a, b) => a.ts - b.ts), tagFile };
}

/** First index with rows[i].ts >= t (rows sorted by ts). */
function lowerBound(rows, t) {
  let lo = 0, hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].ts < t) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/** The Claude Code window summary, plus what Codex states about the window. */
function summarizeCodexWindow(w, rows, tagFile) {
  const inside = rows.slice(lowerBound(rows, w.start), lowerBound(rows, w.activeEnd));
  const rising = risingSamples(w.samples);
  return {
    ...summarizeWindow(w.start, w.activeEnd, inside, tagFile, false),
    limitId: w.limitId,
    lane: w.lane,
    windowMinutes: w.windowMinutes,
    resetsAt: w.end,
    activeEnd: w.activeEnd,
    plans: [...new Set(w.samples.map(s => s.plan).filter(Boolean))],
    usedFirst: Number(rising[0].usedPercent),
    usedLast: Number(rising[rising.length - 1].usedPercent),
    usedMax: Number(rising[rising.length - 1].usedPercent),
    ratelimitSamples: rising,
  };
}

/**
 * One account's section.
 * @param {string|null} account hash, or null for the only account
 */
function buildAccountSection(account, ctx) {
  const { sessions, accountIndex, range, blockedOnly } = ctx;
  const belongs = account === null ? () => true : (sess, ts) => accountOf(accountIndex, sess, ts) === account;

  const samples = [];
  for (const { sess, summary } of sessions) {
    for (const s of (summary && summary.rateLimitSamples) || []) {
      const tsSec = Math.floor(Date.parse(s.ts) / 1000);
      if (Number.isFinite(tsSec) && belongs(sess, tsSec)) samples.push({ ...s, tsSec });
    }
  }
  // A window that stays at 0% has not started: Codex keeps pushing its reset forward, so it
  // shows up as many near-identical windows and says nothing about tokens per percent.
  const windows = groupSamplesIntoWindows(samples)
    .filter(w => w.samples.some(s => Number(s.usedPercent) > 0))
    .filter(w => blockedOnly
      ? w.samples.some(s => Number(s.usedPercent) >= 100)
      : w.start < range.end && w.activeEnd > range.start);
  if (windows.length === 0) return { results: [], ratelimitRows: [] };

  const start = windows.reduce((m, w) => Math.min(m, w.start), Infinity);
  const end = windows.reduce((m, w) => Math.max(m, w.activeEnd), -Infinity);
  const { rows, tagFile } = loadAccountRows(sessions, belongs, start, end);
  const results = windows.map(w => summarizeCodexWindow(w, rows, tagFile));
  const ratelimitRows = results
    .flatMap(r => r.ratelimitSamples)
    .sort((a, b) => a.tsSec - b.tsSec)
    .map(x => [x.tsSec, x.limitId, x.lane, x.windowMinutes, x.resetsAt, x.usedPercent, x.plan || ''].join(','));
  return { results, ratelimitRows };
}

const fmtWhen = (sec) => { const d = new Date(sec * 1000); return fmtDate(d) + ' ' + fmtTime(d); };
const fmtLength = (min) => (min % 1440 === 0 ? min / 1440 + 'd' : min % 60 === 0 ? min / 60 + 'h' : min + 'min');

const TABLE_OPTS = {
  costKnown: false,
  lead: [
    { head: 'Limit', cell: (w) => w.limitId + ' ' + w.lane + ' (' + fmtLength(w.windowMinutes) + ')' },
    { head: 'Used %', cell: (w) => w.usedFirst + '% → ' + w.usedLast + '%' },
  ],
  windowLabel: (w) => fmtWhen(w.winStart) + ' → ' + fmtWhen(w.activeEnd) + (w.activeEnd < w.resetsAt ? ' (reset early)' : ''),
};

const windowFileName = (w) => 'window-' + w.limitId + '-' + w.lane + '-' + w.date + '-' + w.start.replace(':', '') + '.csv';

/**
 * Build and publish the Codex report.
 * @param {{range: {start: number, end: number, label: string}, blockedOnly: boolean, dryRun: boolean}} opts
 */
function reportCodexLimits({ range, blockedOnly, dryRun }) {
  const sessions = listCachedSessions();
  if (sessions.length === 0) {
    log('No Codex sessions in the cache. Run /usage-view first.');
    return;
  }
  const accountIndex = loadAccountIndex(sessions
    .filter(s => s.summary && s.summary.accountChanges)
    .map(s => ({ sessionId: s.sess, changes: s.summary.accountChanges })));
  const accounts = accountIndex.filtering ? listAccounts(accountIndex) : [null];
  const ctx = { sessions, accountIndex, range, blockedOnly };

  const sections = [];
  accounts.forEach((account, i) => {
    const label = account === null ? null : i + 1; // 1 = current login (listAccounts puts it first)
    const section = buildAccountSection(account, ctx);
    log((label ? accountHeading(label) + ': ' : '') + section.results.length
      + ' limit window(s) (' + (blockedOnly ? 'limit reached only' : range.label) + ').');
    if (section.results.length > 0) sections.push({ label, filePrefix: label ? 'account' + label + '-' : '', ...section });
  });
  if (sections.length === 0) {
    log(blockedOnly
      ? 'No Codex limit window reached 100% in cached data.'
      : 'No Codex limit windows for ' + range.label + '. Run /usage-view first.');
    return;
  }

  const reportDir = makeReportDir();
  writeWindowFiles(reportDir, sections, {
    sessionProjectMap: new Map(sessions.map(s => [s.tag, s.proj])),
    sessionParent: new Map(),
    windowName: windowFileName,
  });
  for (const s of sections) {
    fs.writeFileSync(path.join(reportDir, s.filePrefix + 'ratelimit.csv'), RATELIMIT_HEADER + '\n' + s.ratelimitRows.join('\n') + '\n');
  }

  const results = sections.flatMap(s => s.results);
  const title = '\u{1F480} Codex Rate Limit Report (' + results.length + ' window' + (results.length > 1 ? 's' : '')
    + (sections.length > 1 ? ', ' + sections.length + ' accounts' : '') + ')';
  const plans = [...new Set(results.flatMap(r => r.plans))];

  publishReport({
    reportDir,
    dryRun,
    title,
    isGistFile,
    buildBody: (rawDataLine) => '## Rate Limit Data Point\n\n'
      + sections.map(s => (s.label ? '### ' + accountHeading(s.label) + '\n\n' : '') + buildWindowTable(s.results, TABLE_OPTS)).join('\n') + '\n'
      + '## Raw Data\n'
      + rawDataLine + '\n\n'
      + '## Context\n'
      + '- Host: Codex. Limit, window and used % come from Codex itself; Cost is N/A (Codex has no per-token price)\n'
      + '- Plan: ' + (plans.join(', ') || 'unknown') + ' (from Codex)\n'
      + (sections[0].label ? '- Accounts: each has its own windows and rows; files are prefixed `accountN-`\n' : '')
      + '- Codex version: ' + toolVersion('codex') + '\n'
      + '- Date: ' + fmtDate(new Date()),
    summary: {
      host: 'codex',
      accounts: sections.map(s => ({ account: s.label, windows: s.results.length, ratelimitRows: s.ratelimitRows.length })),
      windows: sections.flatMap(s => s.results.map(r => ({
        account: s.label,
        limitId: r.limitId,
        lane: r.lane,
        windowMinutes: r.windowMinutes,
        date: r.date,
        start: r.start,
        end: r.end,
        activeEnd: r.activeEnd,
        resetsAt: r.resetsAt,
        plans: r.plans,
        usedFirst: r.usedFirst,
        usedLast: r.usedLast,
        usedMax: r.usedMax,
        requests: r.requests,
        sessions: r.sessions,
        input: r.input,
        output: r.output,
        cacheWrite: r.cacheWrite,
        cacheRead: r.cacheRead,
        metrics: r.metrics,
      }))),
    },
  });
}

module.exports = { reportCodexLimits, groupSamplesIntoWindows };
