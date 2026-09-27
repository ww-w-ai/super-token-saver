/**
 * Which login account a usage row belongs to.
 *
 * Source: `accountChanges` in each session summary — hashed accounts written by
 * analyze-usage.js at session start and after `/login`. A row of session S at time t
 * belongs to the last change in S at or before t; with none, to the last change in
 * any session at or before t (`claude -p` and SDK sessions record none).
 *
 * Filtering applies only when two or more accounts were seen. With one account (or
 * none recorded), every row is kept. Rows with no record at or before them are
 * always kept.
 */

const crypto = require('crypto');

/**
 * The account is kept as a short one-way hash, not the identifier itself. It stays
 * matchable: hash a known email (Claude Code) or account id (Codex) the same way.
 * @param {string} identifier
 * @returns {string} first 12 hex digits of SHA-256 of the trimmed, lowercased value
 */
function accountHash(identifier) {
  return crypto.createHash('sha256').update(String(identifier).trim().toLowerCase()).digest('hex').slice(0, 12);
}

/**
 * @param {Array<{sessionId: string, changes: Array<{ts: string, account: string}>}>} entries
 * @returns {{bySession: Map<string, Array<{t: number, account: string}>>, all: Array<{t: number, account: string}>, current: string|null, filtering: boolean}}
 */
function loadAccountIndex(entries) {
  const bySession = new Map();
  const all = [];
  for (const { sessionId, changes } of entries) {
    const list = (changes || [])
      .map((c) => ({ t: Date.parse(c.ts) / 1000, account: c.account }))
      .filter((c) => Number.isFinite(c.t) && c.account)
      .sort((a, b) => a.t - b.t);
    if (list.length) bySession.set(sessionId, list);
    all.push(...list);
  }
  all.sort((a, b) => a.t - b.t);
  const current = all.length ? all[all.length - 1].account : null;
  const filtering = new Set(all.map((c) => c.account)).size >= 2;
  return { bySession, all, current, filtering };
}

function lastAtOrBefore(list, t) {
  let found = null;
  for (const c of list) {
    if (c.t > t) break;
    found = c.account;
  }
  return found;
}

/**
 * @param {ReturnType<typeof loadAccountIndex>} index
 * @param {string} sessionId main session id (a subagent row uses its parent's)
 * @param {number} tsSec row time in epoch seconds
 * @returns {string|null} account hash, or null when no record precedes the row
 */
function accountAt(index, sessionId, tsSec) {
  const own = index.bySession.get(sessionId);
  return (own && lastAtOrBefore(own, tsSec)) || lastAtOrBefore(index.all, tsSec);
}

/**
 * Keep a row unless it is known to belong to another account. A row with no record
 * at or before it (caches older than account tracking) is kept: its account is
 * unknown, not different.
 */
function isCurrentAccount(index, sessionId, tsSec) {
  if (!index.filtering) return true;
  const account = accountAt(index, sessionId, tsSec);
  return account === null || account === index.current;
}

module.exports = { accountHash, loadAccountIndex, accountAt, isCurrentAccount };
