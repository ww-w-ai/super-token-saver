/**
 * report-window.js — one 5h/limit window of /report-limit, shared by both hosts: its totals
 * and metrics, its row in the Discussion table, and its CSV file.
 *
 * Rows are timeline.csv rows (`ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt,line,req`);
 * Claude Code and Codex caches write the same columns.
 */

const fs = require('fs');
const path = require('path');
const { hashId } = require('./cache-paths');
const { fmtTokens, fmtDate, fmtTime } = require('./format');

/** Usage totals and rate-limit metrics of one window's kept rows. */
function summarizeWindow(winStart, winEnd, kept, tagFile, hasUnknown) {
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

  const modelsUsed = [...new Set(parsedRows.map(r => r.model).filter(Boolean))];

  return {
    winTs: String(winStart),
    winStart,
    winEnd,
    date: fmtDate(startD),
    start: fmtTime(startD),
    end: fmtTime(endD),
    sessions: windowSessions.size,
    sessionTags: windowSessions,
    requests: rows.length,
    cost: Math.round(totalCost * 100) / 100,
    input: sumInput,
    output: sumOutput,
    cacheWrite: sumCacheWrite,
    cacheRead: sumCacheRead,
    metrics: {
      maxConcurrentSessions: maxConcurrent,
      maxCrPerSession,
      cumInput, cumOutput, cumCc5m, cumCc1h, cumCr,
      cumCost: Math.round(cumCost * 100) / 100,
      activeDurationMin,
      modelsUsed,
    },
    csvHeader: 'ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt,line,req,session',
    csvRows: rows,
    touchedFiles,
    hasUnknown,
  };
}

const roundCost = (n) => Math.round(n * 100) / 100;

/**
 * The Discussion's window table: one row per window and a Total row.
 * @param {object[]} results summarizeWindow() outputs
 * @param {object} [opts]
 * @param {boolean} [opts.costKnown=true] false prints N/A (Codex has no per-token price)
 * @param {Array<{head: string, cell: (w: object) => string}>} [opts.lead] columns before Window
 * @param {(w: object) => string} [opts.windowLabel] the Window cell
 */
function buildWindowTable(results, { costKnown = true, lead = [], windowLabel = (w) => w.date + ' ' + w.start + '-' + w.end } = {}) {
  const totalCost = roundCost(results.reduce((s, w) => s + w.cost, 0));
  const totalRequests = results.reduce((s, w) => s + w.requests, 0);
  const totalSessions = new Set(results.flatMap(w => [...w.sessionTags])).size;
  const totalInput = results.reduce((s, w) => s + w.input, 0);
  const totalOutput = results.reduce((s, w) => s + w.output, 0);
  const totalCacheRead = results.reduce((s, w) => s + w.cacheRead, 0);
  const heads = [...lead.map(c => c.head), 'Window', 'Duration', 'Cost', 'Reqs', 'Sessions', 'Peak Concurrent',
    'Max Ctx/Session', 'Input', 'Output', 'Cache Write (5m/1h)', 'Cache Read', 'Models'];
  let table = '| ' + heads.join(' | ') + ' |\n|' + heads.map(h => '-'.repeat(h.length + 2)).join('|') + '|\n';
  for (const w of results) {
    const m = w.metrics;
    const cells = [
      ...lead.map(c => c.cell(w)),
      windowLabel(w),
      m.activeDurationMin + 'min',
      costKnown ? '$' + w.cost : 'N/A',
      w.requests,
      w.sessions,
      m.maxConcurrentSessions,
      fmtTokens(m.maxCrPerSession),
      fmtTokens(w.input),
      fmtTokens(w.output),
      fmtTokens(m.cumCc5m) + ' / ' + fmtTokens(m.cumCc1h),
      fmtTokens(w.cacheRead),
      m.modelsUsed.length,
    ];
    table += '| ' + cells.join(' | ') + ' |\n';
  }
  const total = [
    ...lead.map((c, i) => (i === 0 ? '**Total**' : '')),
    lead.length ? '' : '**Total**',
    '',
    costKnown ? '**$' + totalCost + '**' : '',
    '**' + totalRequests + '**',
    '**' + totalSessions + '**',
    '',
    '',
    '**' + fmtTokens(totalInput) + '**',
    '**' + fmtTokens(totalOutput) + '**',
    '',
    '**' + fmtTokens(totalCacheRead) + '**',
    '',
  ];
  return table + '| ' + total.join(' | ') + ' |\n';
}

/**
 * sessions.csv and models.csv (numbers shared by every account's files), then one CSV per
 * window with those numbers in place of session ids and model names.
 * @param {string} reportDir
 * @param {Array<{filePrefix: string, results: object[]}>} sections
 * @param {object} ctx
 * @param {Map<string, string>} ctx.sessionProjectMap session tag → project
 * @param {Map<string, string>} ctx.sessionParent subagent tag → main session
 * @param {(w: object) => string} [ctx.windowName] file name after the account prefix
 */
function writeWindowFiles(reportDir, sections, { sessionProjectMap, sessionParent, windowName = (w) => 'window-' + w.date + '-' + w.start.replace(':', '') + '.csv' }) {
  const sessionIndex = new Map();
  const modelIndex = new Map();
  for (const s of sections) {
    for (const w of s.results) {
      for (const row of w.csvRows) {
        const cols = row.split(',');
        const sessionId = cols[cols.length - 1];
        if (!sessionIndex.has(sessionId)) sessionIndex.set(sessionId, sessionIndex.size + 1);
        const model = cols[1];
        if (model && !modelIndex.has(model)) modelIndex.set(model, modelIndex.size + 1);
      }
    }
  }

  let sessionsCsv = 'num,id,project,type,parent\n';
  for (const [sid, num] of sessionIndex) {
    const type = sid.startsWith('agent-') ? 'agent' : 'main';
    const parentSid = sessionParent.get(sid) || '';
    const parentNum = parentSid ? String(sessionIndex.get(parentSid) || '') : '';
    const proj = sessionProjectMap.get(sid) || '_unknown';
    sessionsCsv += num + ',' + hashId(sid) + ',' + hashId(proj) + ',' + type + ',' + parentNum + '\n';
  }
  fs.writeFileSync(path.join(reportDir, 'sessions.csv'), sessionsCsv);
  fs.writeFileSync(path.join(reportDir, 'models.csv'),
    'num,model\n' + [...modelIndex].map(([model, num]) => num + ',' + model + '\n').join(''));

  for (const s of sections) {
    for (const w of s.results) {
      const mappedRows = w.csvRows.map(row => {
        const cols = row.split(',');
        cols[cols.length - 1] = String(sessionIndex.get(cols[cols.length - 1]) || 0);
        cols[1] = String(modelIndex.get(cols[1]) || 0);
        return cols.join(',');
      });
      fs.writeFileSync(path.join(reportDir, s.filePrefix + windowName(w)), w.csvHeader + '\n' + mappedRows.join('\n') + '\n');
    }
  }
}

/** Gist takes these: window files, ratelimit files, and the two number tables. */
const isGistFile = (f) => /^(account\d+-)?(window-.+|ratelimit)\.csv$/.test(f) || f === 'sessions.csv' || f === 'models.csv';

module.exports = { summarizeWindow, buildWindowTable, writeWindowFiles, isGistFile, roundCost };
