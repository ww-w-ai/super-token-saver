/**
 * Count each API request once across sessions.
 *
 * A resumed or forked session starts a new session file that copies the earlier
 * conversation, and the copied lines keep their original requestId (one SDK-driven
 * project had the same request in 12 session files). One requestId is one billed
 * API call, so it is counted once: the session whose rows start earliest keeps it,
 * ties broken by session id. Rows without a requestId are always kept.
 *
 * Used by build-report.js (/usage-view), report-limit.js and test-data-integrity.js.
 *
 * @param {Map<string, Array<{ts: number, req?: string}>>} timelines session id → rows; edited in place
 * @returns {number} rows dropped
 */
function dropReplayedRequests(timelines) {
  const start = new Map();
  for (const [sid, rows] of timelines) start.set(sid, rows.reduce((m, r) => (r.ts < m ? r.ts : m), Infinity));
  const order = [...timelines.keys()].sort((a, b) => start.get(a) - start.get(b) || (a < b ? -1 : a > b ? 1 : 0));
  const seen = new Set();
  let dropped = 0;
  for (const sid of order) {
    const rows = timelines.get(sid);
    const kept = rows.filter((r) => {
      if (!r.req) return true;
      if (seen.has(r.req)) { dropped++; return false; }
      seen.add(r.req);
      return true;
    });
    if (kept.length === 0) timelines.delete(sid);
    else if (kept.length !== rows.length) timelines.set(sid, kept);
  }
  return dropped;
}

module.exports = { dropReplayedRequests };
