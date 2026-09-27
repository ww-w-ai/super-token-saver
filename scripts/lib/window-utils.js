/**
 * window-utils.js — Shared window detection and merging utilities
 *
 * Scans ratelimit CSVs for 5h_reset anchors and/or accepts timeline-based
 * window detections, deduplicates, merges overlapping windows, and returns
 * a sorted list of merged windows [{start, end}].
 */

const fs = require('fs');
const path = require('path');
const { listProjects, listSessions, listSubagents, getRatelimitPath, getTimelinePath, getSubagentTimelinePath } = require('./cache-paths');

const FIVE_HOURS_S = 5 * 3600;

/**
 * Scan ratelimit CSVs for 5h_reset values and derive window starts.
 * Uses new project/session cache structure.
 * @param {string} cacheBase - Path to cache base directory (e.g. ~/.claude/super-token-saver-data) — kept for API compat
 * @param {(sessionId: string, tsSec: number) => boolean} [keepRow] - Limits the scan to one login
 *   account: reset times are per account, and two accounts' windows overlap into one merged span.
 * @returns {number[]} Array of unique window start timestamps
 */
function scanRatelimitWindows(cacheBase, keepRow) {
  const windowStarts = new Set();
  try {
    const projects = listProjects();
    for (const proj of projects) {
      const sessions = listSessions(proj);
      for (const sess of sessions) {
        const rlPath = getRatelimitPath(proj, sess);
        if (!fs.existsSync(rlPath)) continue;
        const lines = fs.readFileSync(rlPath, 'utf8').trim().split('\n');
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',');
          const resetTs = cols[2] ? Number(cols[2]) : 0;
          if (keepRow && !keepRow(sess, Number(cols[0]))) continue;
          if (resetTs > 0) {
            windowStarts.add(resetTs - FIVE_HOURS_S);
          }
        }
      }
    }
  } catch { /* ignore missing dirs */ }
  return [...windowStarts];
}

/**
 * Merge overlapping or adjacent windows.
 * @param {number[]} windowStarts - Array of window start timestamps
 * @param {number} windowDuration - Duration of each window in seconds (default: 5h)
 * @returns {{start: number, end: number}[]} Sorted, merged windows
 */
function mergeWindows(windowStarts, windowDuration = FIVE_HOURS_S) {
  if (windowStarts.length === 0) return [];

  const sorted = [...new Set(windowStarts)].sort((a, b) => a - b);

  const merged = [];
  let current = { start: sorted[0], end: sorted[0] + windowDuration };
  for (let i = 1; i < sorted.length; i++) {
    const nextStart = sorted[i];
    const nextEnd = nextStart + windowDuration;
    if (nextStart < current.end) {
      current.end = Math.max(current.end, nextEnd);
    } else {
      merged.push(current);
      current = { start: nextStart, end: nextEnd };
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Windows that never overlap: each runs until the earlier of its own end and the next start.
 * A limit can reset before its scheduled time; the new window then takes over, and merging the
 * two would make one span hold both windows' usage (measured: 9.5 h under one 5h label).
 * @returns {{start: number, end: number}[]} sorted, disjoint
 */
function splitWindows(windowStarts, windowDuration = FIVE_HOURS_S) {
  const sorted = [...new Set(windowStarts)].sort((a, b) => a - b);
  return sorted.map((start, i) => ({
    start,
    end: i + 1 < sorted.length ? Math.min(start + windowDuration, sorted[i + 1]) : start + windowDuration,
  }));
}

/**
 * Scan ratelimit CSVs and return merged windows.
 * @param {string} cacheBase - Path to cache base directory
 * @returns {{start: number, end: number}[]} Sorted, merged windows
 */
function detectAndMergeWindows(cacheBase) {
  const starts = scanRatelimitWindows(cacheBase);
  return mergeWindows(starts);
}

/**
 * Collect all active hours from timeline CSVs across all projects/sessions/subagents.
 * @param {string} [projectFilter] - Optional project name to scope scan
 * @returns {number[]} Sorted array of unique hourFloor timestamps
 */
function collectActiveHours(projectFilter) {
  const hours = new Set();
  try {
    const projects = projectFilter ? [projectFilter] : listProjects();
    for (const proj of projects) {
      const sessions = listSessions(proj);
      for (const sess of sessions) {
        _readHoursFromCsv(getTimelinePath(proj, sess), hours);
        const agents = listSubagents(proj, sess);
        for (const agent of agents) {
          _readHoursFromCsv(getSubagentTimelinePath(proj, sess, agent), hours);
        }
      }
    }
  } catch { /* ignore missing dirs */ }
  return [...hours].sort((a, b) => a - b);
}

function _readHoursFromCsv(csvPath, hoursSet) {
  if (!fs.existsSync(csvPath)) return;
  const content = fs.readFileSync(csvPath, 'utf8').trim();
  const lines = content.split('\n');
  // Header: ts,model,input,cc,cc5m,cc1h,cr,out,cost,...
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const ts = Number(cols[0]);
    const cost = Number(cols[8]) || 0;
    // Skip zero-cost rows (e.g. /clear events) — they don't represent real API usage
    if (ts > 0 && cost > 0) hoursSet.add(Math.floor(ts / 3600) * 3600);
  }
}

/**
 * Build 5h windows from 1h activity hours + ratelimit boundaries.
 * Ratelimit data (actual Anthropic boundaries) takes priority.
 * Uncovered hours are grouped into 5h blocks by earliest activity.
 *
 * @param {number[]} activeHours - Sorted hourFloor timestamps with activity
 * @param {{start: number, end: number}[]} rlWindows - Merged ratelimit windows
 * @returns {Map<number, number>} hourFloor → 5h window start mapping
 */
function buildHourToWindowMap(activeHours, rlWindows) {
  const hourToWin = new Map();

  // 1) Assign hours covered by ratelimit windows
  for (const h of activeHours) {
    for (const w of rlWindows) {
      if (h >= w.start && h < w.end) {
        hourToWin.set(h, w.start);
        break;
      }
    }
  }

  // 2) For uncovered hours, group into 5h blocks
  let groupStart = null;
  for (const h of activeHours) {
    if (hourToWin.has(h)) {
      groupStart = null;
      continue;
    }
    if (groupStart === null || h >= groupStart + FIVE_HOURS_S) {
      groupStart = h;
    }
    hourToWin.set(h, groupStart);
  }

  return hourToWin;
}

/**
 * Build a ts→window mapper using ratelimit 5h_reset boundaries.
 * Anthropic switched 5h windows from hour-aligned to first-message+5h
 * around 2026-04-23, making boundaries minute-precise. This mapper
 * compares raw ts (second precision) against merged ratelimit windows.
 *
 * Returns: { tsToWindow(ts) -> windowStart|null, windows: [{start,end}] }
 * @param {(sessionId: string, tsSec: number) => boolean} [keepRow] see scanRatelimitWindows
 */
function buildGlobalTsMapper(keepRow, { splitOverlaps = false } = {}) {
  const rlStarts = scanRatelimitWindows(undefined, keepRow);
  const windows = splitOverlaps ? splitWindows(rlStarts, FIVE_HOURS_S) : mergeWindows(rlStarts, FIVE_HOURS_S);
  // Merged windows are sorted and disjoint: binary search for the last start at or before ts.
  function tsToWindow(ts) {
    let lo = 0, hi = windows.length - 1, found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (windows[mid].start <= ts) { found = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return found >= 0 && ts < windows[found].end ? windows[found].start : null;
  }
  return { tsToWindow, windows };
}

/**
 * Give every row exactly one 5h window start (`row.win`). A row inside a ratelimit window
 * takes that window's start; the rest are grouped into 5h blocks, each anchored by the
 * earliest row not yet covered. Rows must carry a numeric `ts` (epoch seconds).
 * @param {Array<{ts: number, win?: number}>} rows mutated in place
 * @param {(ts: number) => number|null} tsToWindow from buildGlobalTsMapper
 */
function assignWindows(rows, tsToWindow) {
  const uncovered = [];
  for (const row of rows) {
    const win = tsToWindow(row.ts);
    if (win !== null) row.win = win;
    else uncovered.push(row);
  }
  uncovered.sort((a, b) => a.ts - b.ts);
  let groupStart = null;
  for (const row of uncovered) {
    if (groupStart === null || row.ts >= groupStart + FIVE_HOURS_S) groupStart = row.ts;
    row.win = groupStart;
  }
}

module.exports = {
  FIVE_HOURS_S,
  scanRatelimitWindows,
  mergeWindows,
  splitWindows,
  detectAndMergeWindows,
  collectActiveHours,
  buildHourToWindowMap,
  buildGlobalTsMapper,
  assignWindows,
};
