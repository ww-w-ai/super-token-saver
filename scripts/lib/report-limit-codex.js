/**
 * report-limit-codex.js — /report-limit for Codex.
 *
 * Codex states its limits outright: every token_count row carries, per lane, the used
 * percentage, the window length and the reset instant (analyze-usage.js keeps them as
 * `rateLimitSamples` in each session summary). What Codex does not publish is how many
 * tokens one percent is. So the report pairs each recorded limit window with the tokens
 * spent inside it: used % at the first and last sample, and the requests, input, cached
 * input and output of every Codex request in that window.
 *
 * Windows are read, not inferred: one window is one (limit id, lane, window length) with
 * one reset instant. Codex reports the same reset a few seconds apart from sample to
 * sample, so resets within RESET_JITTER_S of each other are one window.
 *
 * Accounts work as in the Claude Code report: with two or more login accounts on record,
 * each account is its own section, numbered, never named.
 */

const fs = require('fs');
const path = require('path');
const { forHost, hashId } = require('./cache-paths');
const { loadAccountIndex, accountOf, listAccounts } = require('./accounts');
const { fmtTokens, fmtDate, fmtTime } = require('./format');
const { log, makeReportDir, accountHeading, toolVersion, publishReport } = require('./report-publish');

const RESET_JITTER_S = 120;
const REQUESTS_HEADER = 'ts,model,input,cc,cr,out,session';
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

/** Every cached Codex session: its project, id, and summary (null when missing). */
function listCachedSessions() {
  const out = [];
  for (const proj of codex.listProjects()) {
    for (const sess of codex.listSessions(proj)) {
      out.push({ proj, sess, summary: readJson(codex.getSummaryPath(proj, sess)) });
    }
  }
  return out;
}

/**
 * One account's limit windows, from its rate-limit samples.
 * @returns {Array<{limitId, lane, windowMinutes, start, end, samples}>} sorted by start
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
    let current = null;
    for (const s of laneSamples) {
      if (!current || s.resetsAt - current.lastReset > RESET_JITTER_S) {
        current = {
          limitId: s.limitId, lane: s.lane, windowMinutes: s.windowMinutes,
          end: s.resetsAt, start: s.resetsAt - s.windowMinutes * 60, lastReset: s.resetsAt, samples: [],
        };
        windows.push(current);
      }
      current.lastReset = s.resetsAt;
      current.samples.push(s);
    }
  }
  for (const w of windows) w.samples.sort((a, b) => a.tsSec - b.tsSec);
  // A limit can reset before its scheduled time (measured: 49 s after reaching 100%). The
  // next window of the same lane then takes over, so each window is active until the
  // earlier of its reset and that next start.
  const byKey = new Map();
  for (const w of windows) {
    const key = [w.limitId, w.lane, w.windowMinutes].join('|');
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(w);
  }
  for (const list of byKey.values()) {
    list.sort((a, b) => a.start - b.start);
    list.forEach((w, i) => { w.activeEnd = i + 1 < list.length ? Math.min(w.end, list[i + 1].start) : w.end; });
  }
  return windows.sort((a, b) => a.start - b.start || String(a.limitId).localeCompare(String(b.limitId)));
}

/** The account's request rows in [start, end), sorted by ts; model filled forward per file. */
function loadAccountRequests(sessions, belongs, start, end) {
  const rows = [];
  for (const { proj, sess } of sessions) {
    const lines = readCsvLines(codex.getTimelinePath(proj, sess));
    let prevModel = '';
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(',');
      if (c[1]) prevModel = c[1];
      const ts = Number(c[0]);
      if (!(ts >= start && ts < end) || !belongs(sess, ts)) continue;
      rows.push({
        ts, model: prevModel, session: sess, proj,
        input: Number(c[2]) || 0, cc: Number(c[3]) || 0, cr: Number(c[6]) || 0, out: Number(c[7]) || 0,
      });
    }
  }
  return rows.sort((a, b) => a.ts - b.ts);
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

/** Used % and token totals of one window. */
function summarizeWindow(w, rows) {
  const inside = rows.slice(lowerBound(rows, w.start), lowerBound(rows, w.activeEnd));
  const used = w.samples.map(s => Number(s.usedPercent));
  const sum = (k) => inside.reduce((acc, r) => acc + r[k], 0);
  return {
    limitId: w.limitId,
    lane: w.lane,
    windowMinutes: w.windowMinutes,
    start: w.start,
    end: w.end,
    activeEnd: w.activeEnd,
    plans: [...new Set(w.samples.map(s => s.plan).filter(Boolean))],
    samples: w.samples.length,
    usedFirst: used[0],
    usedLast: used[used.length - 1],
    usedMax: used.reduce((m, u) => Math.max(m, u), -Infinity),
    requests: inside.length,
    sessions: new Set(inside.map(r => r.session)).size,
    input: sum('input'),
    cached: sum('cr'),
    cacheWrite: sum('cc'),
    output: sum('out'),
    models: [...new Set(inside.map(r => r.model).filter(Boolean))],
  };
}

/** Samples of the reported windows, kept only where a lane's used % changes. */
function changedSamples(windows) {
  const all = windows.flatMap(w => w.samples).sort((a, b) => a.tsSec - b.tsSec);
  const lastUsed = new Map();
  const out = [];
  for (const s of all) {
    const key = [s.limitId, s.lane, s.windowMinutes].join('|');
    if (lastUsed.get(key) === s.usedPercent) continue;
    lastUsed.set(key, s.usedPercent);
    out.push(s);
  }
  return out;
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
  if (windows.length === 0) return { windows: [], results: [], requests: [], samples: [] };

  const start = Math.min(...windows.map(w => w.start));
  const end = Math.max(...windows.map(w => w.activeEnd));
  const requests = loadAccountRequests(sessions, belongs, start, end);
  return {
    windows,
    results: windows.map(w => summarizeWindow(w, requests)),
    requests: requests.filter(r => windows.some(w => r.ts >= w.start && r.ts < w.activeEnd)),
    samples: changedSamples(windows),
  };
}

const fmtWhen = (sec) => { const d = new Date(sec * 1000); return fmtDate(d) + ' ' + fmtTime(d); };
const fmtLength = (min) => (min % 1440 === 0 ? min / 1440 + 'd' : min % 60 === 0 ? min / 60 + 'h' : min + 'min');
const fmtUsed = (r) => r.usedFirst + '% → ' + r.usedLast + '%' + (r.usedMax > r.usedLast ? ' (max ' + r.usedMax + '%)' : '');

function buildWindowTable(results) {
  let table = '| Limit | Window | Length | Plan | Used % | Reqs | Sessions | Input | Cached | Output | Models |\n'
    + '|-------|--------|--------|------|--------|------|----------|-------|--------|--------|--------|\n';
  for (const r of results) {
    table += '| ' + r.limitId + ' ' + r.lane
      + ' | ' + fmtWhen(r.start) + ' → ' + fmtWhen(r.activeEnd) + (r.activeEnd < r.end ? ' (reset early)' : '')
      + ' | ' + fmtLength(r.windowMinutes)
      + ' | ' + (r.plans.join(', ') || 'unknown')
      + ' | ' + fmtUsed(r)
      + ' | ' + r.requests
      + ' | ' + r.sessions
      + ' | ' + fmtTokens(r.input)
      + ' | ' + fmtTokens(r.cached)
      + ' | ' + fmtTokens(r.output)
      + ' | ' + r.models.length
      + ' |\n';
  }
  return table;
}

/** Write the CSVs: per account requests and samples, shared session and model numbers. */
function writeFiles(reportDir, sections, sessionIsSubagent) {
  const sessionIndex = new Map(); // session id → { num, proj }
  const modelIndex = new Map();
  for (const s of sections) {
    for (const r of s.requests) {
      if (!sessionIndex.has(r.session)) sessionIndex.set(r.session, { num: sessionIndex.size + 1, proj: r.proj });
      if (r.model && !modelIndex.has(r.model)) modelIndex.set(r.model, modelIndex.size + 1);
    }
  }
  let sessionsCsv = 'num,id,project,type\n';
  for (const [sid, { num, proj }] of sessionIndex) {
    sessionsCsv += num + ',' + hashId(sid) + ',' + hashId(proj) + ',' + (sessionIsSubagent.get(sid) ? 'agent' : 'main') + '\n';
  }
  fs.writeFileSync(path.join(reportDir, 'sessions.csv'), sessionsCsv);
  fs.writeFileSync(path.join(reportDir, 'models.csv'),
    'num,model\n' + [...modelIndex].map(([m, n]) => n + ',' + m).join('\n') + '\n');

  for (const s of sections) {
    const requests = s.requests.map(r => [r.ts, modelIndex.get(r.model) || 0, r.input, r.cc, r.cr, r.out, sessionIndex.get(r.session).num].join(','));
    fs.writeFileSync(path.join(reportDir, s.filePrefix + 'codex-requests.csv'), REQUESTS_HEADER + '\n' + requests.join('\n') + '\n');
    const samples = s.samples.map(x => [x.tsSec, x.limitId, x.lane, x.windowMinutes, x.resetsAt, x.usedPercent, x.plan || ''].join(','));
    fs.writeFileSync(path.join(reportDir, s.filePrefix + 'codex-ratelimit.csv'), RATELIMIT_HEADER + '\n' + samples.join('\n') + '\n');
  }
}

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
  const sessionIsSubagent = new Map(sessions.map(s => [s.sess, !!(s.summary && s.summary.isSubagent)]));
  writeFiles(reportDir, sections, sessionIsSubagent);

  const results = sections.flatMap(s => s.results);
  // Per request, not per window: one request sits in a 5h and a 7d window at once.
  const totalTokens = sections.reduce((acc, s) => acc + s.requests.reduce((t, r) => t + r.input + r.cr + r.out, 0), 0);
  const title = '\u{1F480} Codex Rate Limit Report (' + results.length + ' window' + (results.length > 1 ? 's' : '')
    + (sections.length > 1 ? ', ' + sections.length + ' accounts' : '') + ')';
  const today = fmtDate(new Date());

  publishReport({
    reportDir,
    dryRun,
    title,
    isGistFile: (f) => /^(account\d+-)?codex-(requests|ratelimit)\.csv$/.test(f) || f === 'sessions.csv' || f === 'models.csv',
    buildBody: (rawDataLine) => '## Codex Rate Limit Data Point\n\n'
      + sections.map(s => (s.label ? '### ' + accountHeading(s.label) + '\n\n' : '') + buildWindowTable(s.results)).join('\n') + '\n'
      + '## Raw Data\n'
      + rawDataLine + '\n\n'
      + '## Context\n'
      + '- Host: Codex. Used % and window come from Codex itself; token columns count every Codex request inside the window, all models.\n'
      + (sections[0].label ? '- Accounts: each has its own windows and requests; files are prefixed `accountN-`\n' : '')
      + '- Codex version: ' + toolVersion('codex') + '\n'
      + '- Date: ' + today,
    summary: {
      host: 'codex',
      accounts: sections.map(s => ({ account: s.label, windows: s.results.length, requests: s.requests.length })),
      windows: sections.flatMap(s => s.results.map(r => ({ account: s.label, ...r }))),
      totalTokens,
    },
  });
}

module.exports = { reportCodexLimits, groupSamplesIntoWindows };
