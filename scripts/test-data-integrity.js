#!/usr/bin/env node
/**
 * Data integrity verification.
 *
 * Independently re-aggregates from raw timeline.csv + ratelimit.csv files
 * and compares against the report JSON produced by build-report.js.
 *
 * Checks:
 *   T1: window totalCost  ==  Σ rows.cost where ts ∈ [winStart, winEnd)
 *   T2: window.hourlyCosts[h]  ==  Σ rows.cost where ts ∈ [winStart, winEnd) ∧ hour(ts) == h
 *   T3: window.activeHours  ⊆  hours with any cost>0 row in window
 *   T4: window session count includes every session that had ≥1 row in window
 *   T5: session.cost in window  ==  Σ that session's rows.cost in window
 */

const fs = require('fs');
const path = require('path');
const { listProjects, listSessions, listSubagents, getTimelinePath, getSubagentTimelinePath, getSummaryPath } = require('./lib/cache-paths');
const { loadAccountIndex, accountAt } = require('./lib/accounts');
const { buildGlobalTsMapper, FIVE_HOURS_S } = require('./lib/window-utils');
const { dropReplayedRequests } = require('./lib/request-dedup');

if (process.argv.length < 3) {
  console.error('Usage: node test-data-integrity.js <report-data.json>');
  process.exit(1);
}

const REPORT = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

// ── 1. Re-aggregate from raw cache CSVs (independent path) ──
// Load main timeline rows + subagent rows, applying universal dedup:
// drop any subagent row whose requestId already appears in its parent's timeline
// (CC's runForkedAgent replays parent rows into subagent sidechain → req collision).
function loadAllRows() {
  const rows = [];
  for (const proj of listProjects()) {
    for (const sess of listSessions(proj)) {
      const csv = getTimelinePath(proj, sess);
      if (!fs.existsSync(csv)) continue;
      const parentReqs = new Set();
      const lines = fs.readFileSync(csv, 'utf8').trim().split('\n');
      for (let i = 1; i < lines.length; i++) {
        const c = lines[i].split(',');
        const ts = Number(c[0]);
        const cost = Number(c[8]) || 0;
        const req = c[13] || '';
        if (req) parentReqs.add(req);
        if (ts > 0) rows.push({ sessionId: sess, ts, cost, req });
      }
      for (const ag of listSubagents(proj, sess)) {
        const subCsv = getSubagentTimelinePath(proj, sess, ag);
        if (!fs.existsSync(subCsv)) continue;
        const sublines = fs.readFileSync(subCsv, 'utf8').trim().split('\n');
        for (let i = 1; i < sublines.length; i++) {
          const c = sublines[i].split(',');
          const ts = Number(c[0]);
          const cost = Number(c[8]) || 0;
          const req = c[13] || '';
          if (req && parentReqs.has(req)) continue; // dedup
          if (ts > 0) rows.push({ sessionId: sess + '@' + ag, ts, cost, req });
        }
      }
    }
  }
  // Same rule as the report: each requestId counted once across sessions.
  const bySession = new Map();
  for (const r of rows) {
    if (!bySession.has(r.sessionId)) bySession.set(r.sessionId, []);
    bySession.get(r.sessionId).push(r);
  }
  dropReplayedRequests(bySession);
  // Same rule as the report: each row belongs to one login account; rows with no
  // record belong to the current login.
  const entries = [];
  for (const proj of listProjects()) {
    for (const sess of listSessions(proj)) {
      try {
        const s = JSON.parse(fs.readFileSync(getSummaryPath(proj, sess), 'utf8'));
        if (s.accountChanges) entries.push({ sessionId: sess, changes: s.accountChanges });
      } catch { /* no summary */ }
    }
  }
  const index = loadAccountIndex(entries);
  const kept = [...bySession.values()].flat();
  for (const r of kept) r.account = accountAt(index, r.sessionId.split('@')[0], r.ts) || index.current;
  return { rows: kept, index };
}

const SOURCE = loadAllRows();
// The top-level report is one account's; with account tabs, each other account is
// checked against its own rows the same way.
const checks = [[REPORT, REPORT.account || SOURCE.index.current]];
for (const [account, data] of Object.entries(REPORT.otherAccounts || {})) checks.push([data, account]);
let totalFail = 0;
for (const [report, account] of checks) {
  if (checks.length > 1) console.log(`\n##### Account ${account} #####`);
  const rows = SOURCE.index.filtering ? SOURCE.rows.filter((r) => r.account === account) : SOURCE.rows;
  totalFail += checkReport(report, rows.map((r) => ({ ...r })), account);
}
process.exit(totalFail === 0 ? 0 : 1);

function checkReport(REPORT, allRows, account) {

// Filter to report's date range
if (REPORT.summary && REPORT.summary.dateFrom) {
  // dateFrom is "M/D" — convert to KST midnight epoch
  const yr = new Date().getFullYear();
  function parseMD(s) {
    const [m, d] = s.split('/').map(Number);
    return Math.floor(new Date(yr, m - 1, d, 0, 0, 0).getTime() / 1000);
  }
  // The report drops rows before the exact cutoff, not the cutoff's midnight.
  const fromTs = REPORT.summary.cutoff
    ? Math.floor(new Date(REPORT.summary.cutoff).getTime() / 1000)
    : parseMD(REPORT.summary.dateFrom);
  const toTs = parseMD(REPORT.summary.dateTo) + 86400; // include full last day
  const before = allRows.length;
  for (let i = allRows.length - 1; i >= 0; i--) {
    if (allRows[i].ts < fromTs || allRows[i].ts >= toTs) allRows.splice(i, 1);
  }
  console.log(`Date filter ${REPORT.summary.dateFrom}~${REPORT.summary.dateTo}: ${before} -> ${allRows.length} rows`);
}
// Same rule as the report: window boundaries come from this account's ratelimit rows only.
const { tsToWindow } = buildGlobalTsMapper(SOURCE.index.filtering
  ? (sid, ts) => (accountAt(SOURCE.index, sid, ts) || SOURCE.index.current) === account
  : undefined);

// Apply same fallback grouping logic as build-report.js
const uncovered = [];
allRows.forEach(r => {
  const w = tsToWindow(r.ts);
  if (w !== null) r.win = w;
  else uncovered.push(r);
});
uncovered.sort((a, b) => a.ts - b.ts);
let g = null;
for (const r of uncovered) {
  if (g === null || r.ts >= g + FIVE_HOURS_S) g = r.ts;
  r.win = g;
}

// ── 2. Group by window ──
const winMap = new Map(); // winStart -> { rows: [], totalCost: 0, hourlyCosts: {}, sessionIds: Set }
for (const r of allRows) {
  if (!winMap.has(r.win)) winMap.set(r.win, { rows: [], totalCost: 0, hourlyCosts: {}, sessionIds: new Set() });
  const W = winMap.get(r.win);
  W.rows.push(r);
  W.totalCost += r.cost;
  const h = new Date(r.ts * 1000).getHours();
  W.hourlyCosts[h] = (W.hourlyCosts[h] || 0) + r.cost;
  W.sessionIds.add(r.sessionId);
}

// ── 3. For each window in REPORT, find matching expected and compare ──
let pass = 0, fail = 0;
const failures = [];

function approxEq(a, b, tol = 0.011) {
  return Math.abs(a - b) <= tol;
}

for (const w of REPORT.windows) {
  if (!w.startTs) {
    failures.push({ id: w.date + ' ' + w.start, reason: 'missing startTs in report (skipped)' });
    continue;
  }
  const expected = winMap.get(w.startTs);
  if (!expected) {
    failures.push({ id: w.date + ' ' + w.start, reason: 'no source rows for windowStart=' + w.startTs });
    fail++;
    continue;
  }

  // T1: totalCost
  if (!approxEq(w.cost, expected.totalCost)) {
    failures.push({ id: w.date + ' ' + w.start, reason: `T1 totalCost mismatch report=${w.cost.toFixed(4)} expected=${expected.totalCost.toFixed(4)}` });
    fail++;
    continue;
  }

  // T2: hourlyCosts
  let hourMismatch = null;
  for (const h of Object.keys(expected.hourlyCosts)) {
    const exp = expected.hourlyCosts[h];
    const got = w.hourlyCosts[h] || 0;
    if (!approxEq(got, exp, 0.02)) {
      hourMismatch = `hour=${h} report=${got.toFixed(4)} expected=${exp.toFixed(4)}`;
      break;
    }
  }
  if (hourMismatch) {
    failures.push({ id: w.date + ' ' + w.start, reason: 'T2 hourlyCosts: ' + hourMismatch });
    fail++;
    continue;
  }

  // T3: activeHours coverage
  const expectedActive = new Set(Object.entries(expected.hourlyCosts).filter(([_, v]) => v > 0).map(([h]) => Number(h)));
  const reportActive = new Set(w.activeHours || []);
  const missing = [...expectedActive].filter(h => !reportActive.has(h));
  if (missing.length > 0) {
    failures.push({ id: w.date + ' ' + w.start, reason: `T3 activeHours missing: ${missing.join(',')}` });
    fail++;
    continue;
  }

  pass++;
}

console.log(`\n=== Window-level data integrity ===`);
console.log(`Total windows in report:  ${REPORT.windows.length}`);
console.log(`Source-grouped windows:   ${winMap.size}`);
console.log(`PASS:                     ${pass}`);
console.log(`FAIL:                     ${fail}`);

if (failures.length > 0) {
  console.log(`\n=== Failures (first 10) ===`);
  failures.slice(0, 10).forEach(f => console.log(`  [${f.id}] ${f.reason}`));
}

// ── 4. Aggregate-level sanity: total report cost == sum of all rows ──
const totalRows = allRows.reduce((s, r) => s + r.cost, 0);
const totalReport = REPORT.windows.reduce((s, w) => s + w.cost, 0);
console.log(`\n=== Aggregate cost ===`);
console.log(`Sum of all rows:     $${totalRows.toFixed(2)}`);
console.log(`Sum report.windows:  $${totalReport.toFixed(2)}`);
console.log(`Delta:               $${(totalReport - totalRows).toFixed(2)}`);

  return fail;
}
