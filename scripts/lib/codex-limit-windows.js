/**
 * codex-limit-windows.js — the limit windows Codex states, from its rate-limit samples.
 *
 * Every Codex token_count row carries, per lane, the used percentage, the window length and the
 * reset instant (analyze-usage.js keeps them as `rateLimitSamples`). One window is one
 * (limit id, lane, window length) with one reset instant. Codex reports the same reset a few
 * seconds apart from sample to sample, so resets within RESET_JITTER_S of each other are one
 * window. Used by /report-limit and by the /usage-view calendar.
 */

const RESET_JITTER_S = 120;

/**
 * Limit windows from samples that carry `tsSec`. A limit can reset before its scheduled time
 * (a reset coupon; measured: 49 s after reaching 100%); the next window of the same lane then
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
 * A window that stays at 0% has not started: Codex keeps pushing its reset forward, so it shows
 * up as many near-identical windows and says nothing about usage.
 */
const hasStarted = (w) => w.samples.some(s => Number(s.usedPercent) > 0);

/** Samples as stored in summaries (`ts` ISO string), with `tsSec` added; unparseable ones dropped. */
function withTsSec(samples) {
  const out = [];
  for (const s of samples || []) {
    const tsSec = Math.floor(Date.parse(s.ts) / 1000);
    if (Number.isFinite(tsSec)) out.push({ ...s, tsSec });
  }
  return out;
}

module.exports = { RESET_JITTER_S, groupSamplesIntoWindows, hasStarted, withTsSec };
