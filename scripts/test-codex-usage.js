#!/usr/bin/env node
/**
 * test-codex-usage.js — gate for the Codex usage-view port.
 *
 * Covers, in order:
 *   A. codex-usage.js   — the delta/rate-limit math, in-process (fast, exact)
 *   B. plan-info.js     — Codex plan order, unknown-preservation, "2"->go
 *   C. codex-transcript.js — turn_context/token_count normalization,
 *                            normalized-cache invalidation on format bump
 *   D. end-to-end       — analyze-usage.js --host codex against a synthetic
 *                         CODEX_HOME/HOME, exercising model switches, cross-
 *                         session rate-limit merge, cache-entry host tagging,
 *                         and reuse of the real build-report.js/template.html
 *                         pipeline (no separate Codex HTML builder)
 *   E. regression       — the Claude path (default host) and the existing
 *                         adapter/parity gates are unaffected
 *
 * Usage: node test-codex-usage.js
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const codexUsage = require("./lib/codex-usage");
const planInfo = require("./lib/plan-info");
const codexTranscript = require("./lib/codex-transcript");

let failures = 0;
function check(name, actual, expected) {
  let value;
  try { value = typeof actual === "function" ? actual() : actual; } catch (e) { value = `threw: ${e.message}`; }
  const norm = (v) => JSON.stringify(v, (_, x) => (x instanceof Set ? [...x].sort() : x));
  const ok = norm(value) === norm(expected);
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${ok ? "" : `\n       expected ${JSON.stringify(expected)}\n       actual   ${JSON.stringify(value)}`}`);
}

function assertCodexDashboardParity(reportData) {
  check("Codex summary exports total usage tokens", () => reportData.summary.totalUsageTokens > 0, true);
  check("canonical rate limit comes from limit_id=codex", () => reportData.canonicalRateLimits.limitId, "codex");
  check("window source is explicit", () => ["canonical_rate_limit", "analytics_fallback"].includes(reportData.windowSource), true);
  check("Codex hourly token series is nonzero", () => reportData.hourlyUsageStats.some((d) => d.avg > 0 || d.max > 0), true);
  check("Codex day-of-week token series is nonzero", () => reportData.dowUsageStats.some((d) => d.avg > 0 || d.max > 0), true);
  check("Codex calendar exports token intensity", () => reportData.windows.some((w) => w.usageTokens > 0 && Object.values(w.hourlyUsageTokens).some((n) => n > 0)), true);
  check("Codex context-vs-token scatter is exported", () => Boolean(reportData.contextUsageScatter && reportData.contextUsageScatter.perAssistant), true);
}

// ===========================================================================
// A. codex-usage.js — token delta engine
// ===========================================================================

{
  const { createSessionUsageTracker, deltaToUsageRow, mergeRateLimitSamples, extractRateLimitSamples, selectLongestRateLimitLane, clusterUsagePointsByModel } = codexUsage;

  // -- bootstrap: first valid total, last present --------------------------
  let t = createSessionUsageTracker();
  let r = t.ingest(
    { input_tokens: 1000, cached_input_tokens: 200, cache_write_input_tokens: 0, output_tokens: 100, reasoning_output_tokens: 10, total_tokens: 1100 },
    { input_tokens: 1000, cached_input_tokens: 200, cache_write_input_tokens: 0, output_tokens: 100, reasoning_output_tokens: 10, total_tokens: 1100 },
  );
  check("bootstrap emits min(last,total) clamped — full first turn", r.delta, { input_tokens: 1000, cached_input_tokens: 200, cache_write_input_tokens: 0, output_tokens: 100, reasoning_output_tokens: 10, total_tokens: 1100 });
  check("bootstrap has no diagnostic", r.diagnostic, null);

  // -- identical totals -> zero, even if `last` repeats a nonzero value ----
  r = t.ingest(
    { input_tokens: 1000, cached_input_tokens: 200, cache_write_input_tokens: 0, output_tokens: 100, reasoning_output_tokens: 10, total_tokens: 1100 },
    { input_tokens: 999, cached_input_tokens: 199, cache_write_input_tokens: 0, output_tokens: 99, reasoning_output_tokens: 9, total_tokens: 1099 }, // stale/repeated `last`
  );
  check("identical totals emit zero regardless of `last`", r.delta, { input_tokens: 0, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 0 });

  // -- normal successive delta ----------------------------------------------
  r = t.ingest(
    { input_tokens: 1500, cached_input_tokens: 200, cache_write_input_tokens: 0, output_tokens: 150, reasoning_output_tokens: 10, total_tokens: 1650 },
    { input_tokens: 500, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 50, reasoning_output_tokens: 0, total_tokens: 550 },
  );
  check("normal delta is total-minus-baseline, componentwise", r.delta, { input_tokens: 500, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 50, reasoning_output_tokens: 0, total_tokens: 550 });

  // -- component decrease -> reset + zero -----------------------------------
  r = t.ingest(
    { input_tokens: 1000, cached_input_tokens: 200, cache_write_input_tokens: 0, output_tokens: 200, reasoning_output_tokens: 10, total_tokens: 1410 }, // input_tokens dropped 1500->1000
    { input_tokens: 100, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 50, reasoning_output_tokens: 0, total_tokens: 150 },
  );
  check("any component decrease resets baseline and emits zero", r.delta, { input_tokens: 0, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 0 });
  check("decrease is diagnosed as counter_reset", r.diagnostic, "counter_reset");
  check("decrease flags baselineReset", r.baselineReset, true);

  // Confirm the reset actually re-baselined (next delta is against the reset point).
  r = t.ingest(
    { input_tokens: 1100, cached_input_tokens: 200, cache_write_input_tokens: 0, output_tokens: 210, reasoning_output_tokens: 10, total_tokens: 1520 },
    { input_tokens: 100, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 10, reasoning_output_tokens: 0, total_tokens: 110 },
  );
  check("post-reset delta is measured from the reset baseline, not the old one", r.delta, { input_tokens: 100, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 10, reasoning_output_tokens: 0, total_tokens: 110 });

  // -- missing total: fallback once per uninterrupted segment ---------------
  t = createSessionUsageTracker();
  t.ingest({ input_tokens: 1000, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 100, reasoning_output_tokens: 0, total_tokens: 1100 }, null);
  r = t.ingest(null, { input_tokens: 50, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 5, reasoning_output_tokens: 0, total_tokens: 55 });
  check("missing total falls back to `last` — first row of the segment", r.delta, { input_tokens: 50, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 5, reasoning_output_tokens: 0, total_tokens: 55 });
  check("fallback row is diagnosed", r.diagnostic, "missing_total_fallback");
  r = t.ingest(null, { input_tokens: 999, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 99, reasoning_output_tokens: 0, total_tokens: 1098 });
  check("second consecutive missing-total row is suppressed, not a second fallback", r.delta, { input_tokens: 0, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 0 });
  check("suppressed row is diagnosed distinctly", r.diagnostic, "missing_total_suppressed");
  r = t.ingest({ input_tokens: 1200, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 120, reasoning_output_tokens: 0, total_tokens: 1320 }, null);
  check("a valid total ends the missing segment — next missing row gets a fresh fallback", r.diagnostic, null); // normal delta vs the pre-gap baseline (1100), not a fallback

  // -- missing total on the very first row (no baseline yet) -----------------
  t = createSessionUsageTracker();
  r = t.ingest(null, { input_tokens: 10, cached_input_tokens: 1, cache_write_input_tokens: 0, output_tokens: 2, reasoning_output_tokens: 0, total_tokens: 13 });
  check("missing total on the first-ever row still falls back once", r.delta, { input_tokens: 10, cached_input_tokens: 1, cache_write_input_tokens: 0, output_tokens: 2, reasoning_output_tokens: 0, total_tokens: 13 });
  r = t.ingest({ input_tokens: 20, cached_input_tokens: 1, cache_write_input_tokens: 0, output_tokens: 4, reasoning_output_tokens: 0, total_tokens: 25 }, null);
  check("first VALID total after a missing-only start still bootstraps (baseline was never set)", r.delta, { input_tokens: 20, cached_input_tokens: 1, cache_write_input_tokens: 0, output_tokens: 4, reasoning_output_tokens: 0, total_tokens: 25 });

  // -- malformed / negative components clamp to 0 ----------------------------
  t = createSessionUsageTracker();
  r = t.ingest(
    { input_tokens: -50, cached_input_tokens: "not-a-number", cache_write_input_tokens: null, output_tokens: 10, reasoning_output_tokens: 0, total_tokens: -1 },
    null,
  );
  check("malformed/negative components clamp to >=0 on bootstrap", r.delta, { input_tokens: 0, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 10, reasoning_output_tokens: 0, total_tokens: 0 });

  // -- deltaToUsageRow: cached > input clamps noncached, flags diagnostic ----
  let conv = codexUsage.deltaToUsageRow({ input_tokens: 100, cached_input_tokens: 300, cache_write_input_tokens: 0, output_tokens: 50, reasoning_output_tokens: 0, total_tokens: 400 });
  check("cached > input clamps noncachedInput to 0", conv.row.noncachedInput, 0);
  check("cached > input is diagnosed", conv.diagnostics.includes("cached_exceeds_input"), true);

  // -- reasoning is a detail of output, never re-added into total -----------
  conv = codexUsage.deltaToUsageRow({ input_tokens: 100, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 80, reasoning_output_tokens: 60, total_tokens: 180 });
  check("output carries the raw output delta (already includes reasoning)", conv.row.output, 80);
  check("reasoningOutput is reported as a detail, not summed elsewhere", conv.row.reasoningOutput, 60);
  check("total is authoritative — not input+output+reasoning (100+80+60=240 would be wrong)", conv.row.total, 180);

  // -- rate-limit sample identity + merge ------------------------------------
  const dupSample = { sessionId: "s1", line: 5, ts: "2026-01-01T00:00:00Z", plan: "prolite", limitId: "codex", name: null, lane: "primary", usedPercent: 87, windowMinutes: 10080, resetsAt: 1788160471 };
  check("exact (session,line) dedup collapses an exact re-emission", mergeRateLimitSamples([dupSample, { ...dupSample }], "codex").length, 1);

  const crossA = { sessionId: "s1", line: 1, ts: "2026-01-01T00:00:00Z", plan: "prolite", limitId: "codex", name: null, lane: "primary", usedPercent: 80, windowMinutes: 10080, resetsAt: 1788160471 };
  const crossB = { sessionId: "s2", line: 9, ts: "2026-01-01T01:00:00Z", plan: "prolite", limitId: "codex", name: null, lane: "primary", usedPercent: 85, windowMinutes: 10080, resetsAt: 1788160471 };
  const merged = mergeRateLimitSamples([crossA, crossB], "codex");
  check("same host+plan+limitId+lane+window+reset merges across sessions", merged.length, 1);
  check("merge keeps the most recent used_percent", merged[0].usedPercent, 85);
  check("merge records both contributing sessions", [...merged[0].mergedSessions].sort(), ["s1", "s2"]);

  const anonA = { sessionId: "s1", line: 1, ts: "2026-01-01T00:00:00Z", plan: "prolite", limitId: null, name: null, lane: "primary", usedPercent: 80, windowMinutes: 10080, resetsAt: 1788160471 };
  const anonB = { sessionId: "s2", line: 1, ts: "2026-01-01T00:00:00Z", plan: "prolite", limitId: null, name: null, lane: "primary", usedPercent: 80, windowMinutes: 10080, resetsAt: 1788160471 };
  check("fully anonymous samples never merge across sessions", mergeRateLimitSamples([anonA, anonB], "codex").length, 2);

  // -- primary + secondary tracked independently -----------------------------
  const bothLanes = extractRateLimitSamples(
    { limit_id: "codex", primary: { used_percent: 10, window_minutes: 10080, resets_at: 111 }, secondary: { used_percent: 40, window_minutes: 43200, resets_at: 222 } },
    "s1", 1, "2026-01-01T00:00:00Z", "prolite",
  );
  check("primary and secondary both extracted", bothLanes.map((s) => s.lane).sort(), ["primary", "secondary"]);
  check("secondary keeps its own window, independent of primary's", bothLanes.find((s) => s.lane === "secondary").windowMinutes, 43200);
  check("weekly scope selects the longest canonical lane", selectLongestRateLimitLane({ primary: bothLanes.find((s) => s.lane === "primary"), secondary: bothLanes.find((s) => s.lane === "secondary") }).lane, "secondary");
  check("neither lane is hardcoded to a 5-hour (300 min) window", bothLanes.every((s) => s.windowMinutes !== 300), true);
  const densePoints = Array.from({ length: 100 }, (_, i) => ({ x: 100000, y: 200000, model: i < 60 ? "gpt-5.6-sol" : "gpt-5.5", input: 1, out: 1, cc: 0, cr: 1 }));
  const denseBubbles = clusterUsagePointsByModel(densePoints, 50);
  check("Codex density clustering collapses repeated points", [denseBubbles.length, denseBubbles.reduce((n, b) => n + b.n, 0)], [2, 100]);
  check("Codex density clustering never mixes model ids", denseBubbles.map((b) => b.model).sort(), ["gpt-5.5", "gpt-5.6-sol"]);

  // -- missing duration/reset don't break sample extraction or the key -------
  const noDuration = extractRateLimitSamples({ limit_id: "codex", primary: { used_percent: 5, window_minutes: null, resets_at: null } }, "s1", 1, "2026-01-01T00:00:00Z", "prolite");
  check("missing window_minutes/resets_at still produce a sample", noDuration.length, 1);
  check("logicalKey tolerates missing duration/reset", () => codexUsage.logicalKey("codex", noDuration[0]) !== null, true);
}

// ===========================================================================
// A2. codex-usage.js — purchased-credit-equivalent headline cost (pure)
// ===========================================================================

{
  const { computeCodexCreditEquivalent, validateCodexCreditPricingConfig } = codexUsage;
  const pricing = require("./codex-credit-pricing.json");
  check("codex-credit-pricing.json identifies the user-supplied OpenAI Codex rate card, dated, with no URL fabricated", [/user-supplied openai codex purchased-credit rate card/i.test(pricing.meta.source), pricing.meta.source.includes("2026-08-31"), /https?:\/\//.test(pricing.meta.source)], [true, true, false]);
  check("codex-credit-pricing.json scopes promotionThrough to exactly one model (gpt-5.6-sol), not the whole 12-row card", [pricing.meta.promotionModel, pricing.meta.promotionThrough], ["gpt-5.6-sol", "2026-11-21"]);
  check("codex-credit-pricing.json global retrievedAt/source stay unscoped (apply to the whole card)", [typeof pricing.meta.retrievedAt, typeof pricing.meta.source], ["string", "string"]);
  check("computeCodexCreditEquivalent passes the source metadata through untouched", computeCodexCreditEquivalent([{ model: "gpt-5.6-sol", input: 1, cr: 0, out: 0 }], pricing).meta.source, pricing.meta.source);

  // -- the complete user-supplied rate card: every exact ID, no aliases/defaults --
  check("codex-credit-pricing.json has exactly the 12 user-supplied rows, no more, no fewer", pricing.models.length, 12);
  check("codex-credit-pricing.json has no aliases/default fallback keys", ["aliases", "default"].some((k) => k in pricing), false);
  const EXPECTED_CODEX_CREDIT_TABLE = [
    { id: "gpt-5.6-sol", fresh: 100, cached: 10, output: 500 },
    { id: "gpt-5.6-terra", fresh: 50, cached: 5, output: 300 },
    { id: "gpt-5.6-luna", fresh: 5, cached: 0.5, output: 30 },
    { id: "gpt-5.5", fresh: 125, cached: 12.5, output: 750 },
    { id: "daybreak-blue", fresh: 100, cached: 10, output: 500 },
    { id: "daybreak-red", fresh: 312.5, cached: 31.25, output: 1875 },
    { id: "gpt-5.4", fresh: 62.5, cached: 6.25, output: 375 },
    { id: "gpt-5.4-mini", fresh: 18.75, cached: 1.875, output: 113 },
    { id: "gpt-5.3-codex", fresh: 43.75, cached: 4.375, output: 350 },
    { id: "gpt-5.2", fresh: 43.75, cached: 4.375, output: 350 },
    { id: "gpt-image-2-image", fresh: 200, cached: 50, output: 750 },
    { id: "gpt-image-2-text", fresh: 125, cached: 31.25, output: 250 },
  ];
  check("codex-credit-pricing.json ids match the user-supplied set exactly (sorted, no extras/omissions)", pricing.models.map((m) => m.id).slice().sort(), EXPECTED_CODEX_CREDIT_TABLE.map((m) => m.id).slice().sort());
  for (const expected of EXPECTED_CODEX_CREDIT_TABLE) {
    const configRow = pricing.models.find((m) => m.id === expected.id);
    check(`codex-credit-pricing.json rate row for "${expected.id}" matches exactly`, configRow && [configRow.fresh, configRow.cached, configRow.output], [expected.fresh, expected.cached, expected.output]);
    const oneMillionRow = { model: expected.id, input: 1000000, cr: 1000000, out: 1000000 };
    const priced = computeCodexCreditEquivalent([oneMillionRow], pricing);
    const expectedCredits = expected.fresh + expected.cached + expected.output;
    check(`"${expected.id}" at 1M fresh/cached/output prices to exactly ${expectedCredits} credits`, priced.credits, expectedCredits);
    check(`"${expected.id}" is 'exact' with full coverage and no unavailableReason`, [priced.status, priced.coveragePctEligible, priced.unavailableReason], ["exact", 100, null]);
  }

  const solMillion = { model: "gpt-5.6-sol", input: 1000000, cr: 1000000, out: 1000000 };
  const sol = computeCodexCreditEquivalent([solMillion], pricing);
  check("exact Sol 1M fresh/cached/output -> 610 credits (100+10+500 per 1M)", sol.credits, 610);
  check("exact Sol -> $24.40 (610 / 25)", Math.round(sol.usd * 100) / 100, 24.40);
  check("exact Sol status is 'exact' (single known model, full coverage)", sol.status, "exact");
  check("exact Sol coverage is 100%", sol.coveragePctEligible, 100);
  check("exact Sol has no unpriced models / lower-bound reasons", [sol.unpricedModels, sol.lowerBoundReasons], [[], []]);

  const gpt55Million = { model: "gpt-5.5", input: 1000000, cr: 1000000, out: 1000000 };
  const gpt55 = computeCodexCreditEquivalent([gpt55Million], pricing);
  check("exact GPT-5.5 1M fresh/cached/output -> 887.5 credits (125+12.5+750 per 1M)", gpt55.credits, 887.5);
  check("exact GPT-5.5 -> $35.50 (887.5 / 25)", Math.round(gpt55.usd * 100) / 100, 35.50);

  const mixed = computeCodexCreditEquivalent([solMillion, gpt55Million], pricing);
  check("mixed Sol+GPT-5.5 credits sum exactly (610 + 887.5)", mixed.credits, 1497.5);
  check("mixed Sol+GPT-5.5 usd sum exactly ($59.90)", Math.round(mixed.usd * 100) / 100, 59.90);
  check("mixed known-only usage stays 'exact' at 100% coverage, unavailableReason is null", [mixed.status, mixed.coveragePctEligible, mixed.unavailableReason], ["exact", 100, null]);

  const cachedOnly = computeCodexCreditEquivalent([{ model: "gpt-5.6-sol", input: 0, cr: 2000000, out: 0 }], pricing);
  check("cached-only row prices only the cached component (2 * 10 credits)", cachedOnly.credits, 20);
  check("cached-only row with a known model is still 'exact', unavailableReason null", [cachedOnly.status, cachedOnly.unavailableReason], ["exact", null]);

  // -- mixed known + unknown exact id -> lower bound, deterministic order ----
  const unknownRow = { model: "gpt-5.6-sol-mini", input: 500000, cr: 0, out: 0 };
  const lowerBound = computeCodexCreditEquivalent([solMillion, unknownRow], pricing);
  check("known+unknown exact model id is a lower bound, not N/A and not silently priced, unavailableReason null", [lowerBound.status, lowerBound.unavailableReason], ["lower_bound", null]);
  check("lower bound still prices the known row exactly (unaffected by the gap)", lowerBound.credits, 610);
  check("lower bound eligible/priced token totals are exact", [lowerBound.eligibleTokens, lowerBound.pricedTokens], [3500000, 3000000]);
  check("lower bound coverage is the exact priced/eligible fraction, not fabricated", lowerBound.coveragePctEligible, (3000000 / 3500000) * 100);
  check("unpricedModels lists the exact unknown id", lowerBound.unpricedModels, ["gpt-5.6-sol-mini"]);
  check("lowerBoundReasons is deterministic and keyed to the exact id", lowerBound.lowerBoundReasons, ["unpriced_model:gpt-5.6-sol-mini"]);

  // Unpriced models must sort lexicographically regardless of row order (deterministic).
  const unknownB = { model: "zzz-future-model", input: 1, cr: 0, out: 0 };
  const unknownA = { model: "aaa-future-model", input: 1, cr: 0, out: 0 };
  const multiUnknown = computeCodexCreditEquivalent([unknownB, unknownA, solMillion], pricing);
  check("unpricedModels sorts lexicographically regardless of input row order", multiUnknown.unpricedModels, ["aaa-future-model", "zzz-future-model"]);
  check("lowerBoundReasons follows the same deterministic sorted order", multiUnknown.lowerBoundReasons, ["unpriced_model:aaa-future-model", "unpriced_model:zzz-future-model"]);

  // -- unknown-only -> N/A (0 coverage), never a fabricated dollar figure ----
  const unknownOnly = computeCodexCreditEquivalent([{ model: "totally-unknown", input: 1000, cr: 0, out: 0 }], pricing);
  check("an unknown-only model is 'unavailable' (renders as N/A) with reason no_priced_models", [unknownOnly.status, unknownOnly.unavailableReason], ["unavailable", "no_priced_models"]);
  check("unknown-only coverage is deterministically 0, never NaN", unknownOnly.coveragePctEligible, 0);
  check("unknown-only still records the eligible token count for transparency", unknownOnly.eligibleTokens, 1000);

  // -- a missing/empty model id on a token-bearing row is exactly as much of
  // a pricing gap as an unrecognized exact id: it must show up as "unknown",
  // never be silently dropped and never be silently priced. -----------------
  const missingModelRow = { model: undefined, input: 1000, cr: 0, out: 0 };
  const missingModelOnly = computeCodexCreditEquivalent([missingModelRow], pricing);
  check("a token-bearing row with a missing model id is 'unavailable' (N/A) with reason no_priced_models, not silently priced or dropped", [missingModelOnly.status, missingModelOnly.unavailableReason], ["unavailable", "no_priced_models"]);
  check("a missing model id is reported as the exact literal 'unknown'", missingModelOnly.unpricedModels, ["unknown"]);
  check("a missing model id still contributes a deterministic lower-bound reason", missingModelOnly.lowerBoundReasons, ["unpriced_model:unknown"]);
  check("a missing model id's tokens still count toward eligibleTokens (not silently excluded)", missingModelOnly.eligibleTokens, 1000);

  const emptyModelRow = { model: "", input: 1000, cr: 0, out: 0 };
  check("an empty-string model id is treated the same as a missing one -> 'unknown'", computeCodexCreditEquivalent([emptyModelRow], pricing).unpricedModels, ["unknown"]);

  const whitespaceModelRow = { model: "   ", input: 1000, cr: 0, out: 0 };
  check("a whitespace-only model id is treated the same as a missing one -> 'unknown'", computeCodexCreditEquivalent([whitespaceModelRow], pricing).unpricedModels, ["unknown"]);

  // Mixed with a known row: missing-model rows push status to lower_bound,
  // exactly like any other unpriced exact id, and never merge into a
  // different bucket than a genuinely unknown id would.
  const mixedMissingAndKnown = computeCodexCreditEquivalent([solMillion, missingModelRow], pricing);
  check("a missing-model row alongside a known one is a lower bound, matching an unrecognized-id row's behavior", mixedMissingAndKnown.status, "lower_bound");
  check("a missing-model row still prices the known row exactly, unaffected by the gap", mixedMissingAndKnown.credits, 610);
  check("'unknown' and a genuinely unrecognized exact id both appear, sorted together", computeCodexCreditEquivalent([solMillion, missingModelRow, unknownRow], pricing).unpricedModels, ["gpt-5.6-sol-mini", "unknown"]);

  // A missing model id with ZERO eligible tokens (e.g. a cache-write-only
  // row that also happens to have no model) must stay nonblocking, exactly
  // like the zero-eligible-token unknown-model case above.
  const missingModelZeroTokens = { model: null, input: 0, cr: 0, out: 0, cc: 500000 };
  const missingModelNonblocking = computeCodexCreditEquivalent([solMillion, missingModelZeroTokens], pricing);
  check("a zero-eligible-token row with a missing model id is not counted as an unpriced gap either", missingModelNonblocking.unpricedModels, []);
  check("a zero-eligible-token missing-model row keeps the rest of the report 'exact'", missingModelNonblocking.status, "exact");

  // -- an unknown model with zero eligible tokens is nonblocking ------------
  const unknownZeroTokens = { model: "totally-unknown", input: 0, cr: 0, out: 0, cc: 500000 };
  const nonblocking = computeCodexCreditEquivalent([solMillion, unknownZeroTokens], pricing);
  check("a zero-eligible-token row with an unknown model is not counted as an unpriced gap", nonblocking.unpricedModels, []);
  check("a zero-eligible-token unknown-model row keeps the rest of the report 'exact'", nonblocking.status, "exact");
  check("its cache-write tokens are still tallied as excluded/known-zero-charge", nonblocking.excludedKnownZeroChargeTokens.cacheWrite, 500000);

  // -- Cache Write is a known zero-charge exclusion, not an unknown gap -----
  const cwOnlySol = { model: "gpt-5.6-sol", input: 0, cr: 0, out: 0, cc1h: 200000, cc5m: 300000 };
  const cwOnly = computeCodexCreditEquivalent([cwOnlySol], pricing);
  check("cache-write-only usage (row.cc absent, cc1h+cc5m present) is deterministically 'unavailable' with reason no_eligible_tokens, not NaN", [cwOnly.status, cwOnly.unavailableReason], ["unavailable", "no_eligible_tokens"]);
  check("cache-write-only has zero eligible tokens", cwOnly.eligibleTokens, 0);
  check("cache-write-only coverage is deterministically 0, not NaN", cwOnly.coveragePctEligible, 0);
  check("cache-write-only sums cc1h+cc5m into excludedKnownZeroChargeTokens.cacheWrite", cwOnly.excludedKnownZeroChargeTokens.cacheWrite, 500000);
  check("cache-write-only recordedTokens still counts the cache-write tokens", cwOnly.recordedTokens, 500000);
  check("cache-write-only reports no unpriced models (Cache Write is a known exclusion, not an unknown gap)", cwOnly.unpricedModels, []);

  const allZero = computeCodexCreditEquivalent([{ model: "gpt-5.6-sol", input: 0, cr: 0, out: 0 }], pricing);
  check("an all-zero-token row is deterministically 'unavailable' with reason no_eligible_tokens, not a crash", [allZero.status, allZero.unavailableReason, allZero.recordedTokens, allZero.eligibleTokens], ["unavailable", "no_eligible_tokens", 0, 0]);
  check("an empty row list is deterministically 'unavailable' with reason no_eligible_tokens", [computeCodexCreditEquivalent([], pricing).status, computeCodexCreditEquivalent([], pricing).unavailableReason], ["unavailable", "no_eligible_tokens"]);

  // -- malformed pricing config fails closed, never silently mis-prices -----
  const base = JSON.parse(JSON.stringify(pricing));
  function withMeta(overrides) { const c = JSON.parse(JSON.stringify(base)); Object.assign(c.meta, overrides); return c; }
  function withModels(models) { const c = JSON.parse(JSON.stringify(base)); c.models = models; return c; }
  function throws(fn) { try { fn(); return "did not throw"; } catch (e) { return "threw"; } }

  for (const bad of [0, -25, NaN, Infinity, "twenty-five"]) {
    check(`invalid creditsPerUsd (${bad}) throws from validateCodexCreditPricingConfig`, throws(() => validateCodexCreditPricingConfig(withMeta({ creditsPerUsd: bad }))), "threw");
  }
  check("missing rate field throws", throws(() => validateCodexCreditPricingConfig(withModels([{ id: "x", fresh: 1, cached: 1 }]))), "threw");
  check("negative rate throws", throws(() => validateCodexCreditPricingConfig(withModels([{ id: "x", fresh: -1, cached: 1, output: 1 }]))), "threw");
  check("non-finite (Infinity) rate throws", throws(() => validateCodexCreditPricingConfig(withModels([{ id: "x", fresh: Infinity, cached: 1, output: 1 }]))), "threw");
  check("non-finite (NaN) rate throws", throws(() => validateCodexCreditPricingConfig(withModels([{ id: "x", fresh: NaN, cached: 1, output: 1 }]))), "threw");
  check("duplicate model id throws", throws(() => validateCodexCreditPricingConfig(withModels([{ id: "dup", fresh: 1, cached: 1, output: 1 }, { id: "dup", fresh: 2, cached: 2, output: 2 }]))), "threw");

  const invalidResult = computeCodexCreditEquivalent([solMillion], withMeta({ creditsPerUsd: 0 }));
  check("computeCodexCreditEquivalent fails closed on an invalid config instead of throwing across the boundary", invalidResult.status, "unavailable");
  check("fail-closed result carries the deterministic unavailableReason 'invalid_config'", invalidResult.unavailableReason, "invalid_config");
  check("fail-closed result also carries invalid_config in lowerBoundReasons (backward-compatible)", invalidResult.lowerBoundReasons, ["invalid_config"]);
  check("fail-closed result never fabricates a usd figure", invalidResult.usd, null);
  const nullConfigResult = computeCodexCreditEquivalent([solMillion], null);
  check("a null pricing config also fails closed with reason invalid_config", [nullConfigResult.status, nullConfigResult.unavailableReason], ["unavailable", "invalid_config"]);

  // -- invalid config still preserves what was OBSERVABLE from the rows alone:
  // recordedTokens, eligibleTokens, the cache-write exclusion tally, and the
  // deterministic model-id list — only pricing itself (credits/usd/pricedTokens/
  // coverage) is unavailable, because a broken rate card can price nothing,
  // not because the rows themselves were unreadable. This must not duplicate
  // the row-parsing logic used by the valid-config path (single normalization
  // helper, exercised by both).
  const rowsForInvalidConfigTest = [
    { model: "gpt-5.6-sol", input: 1000000, cr: 1000000, out: 1000000 }, // eligible 3,000,000 (would price under a valid config)
    { model: "totally-unknown", input: 500, cr: 0, out: 0 }, // eligible 500
    { model: null, input: 0, cr: 0, out: 0, cc: 500000 }, // cache-write-only, eligible 0
  ];
  const invalidWithObservations = computeCodexCreditEquivalent(rowsForInvalidConfigTest, withMeta({ creditsPerUsd: 0 }));
  check("invalid config still reports the exact recordedTokens observed from the rows", invalidWithObservations.recordedTokens, 3000000 + 500 + 500000);
  check("invalid config still reports the exact eligibleTokens observed from the rows", invalidWithObservations.eligibleTokens, 3000500);
  check("invalid config still tallies the cache-write exclusion from the rows", invalidWithObservations.excludedKnownZeroChargeTokens.cacheWrite, 500000);
  check("invalid config still reports the deterministically observable model ids (a broken rate card cannot price ANY of them)", invalidWithObservations.unpricedModels, ["gpt-5.6-sol", "totally-unknown"]);
  check("invalid config never prices anything: credits 0, usd null, pricedTokens 0, coverage 0", [invalidWithObservations.credits, invalidWithObservations.usd, invalidWithObservations.pricedTokens, invalidWithObservations.coveragePctEligible], [0, null, 0, 0]);
  check("invalid config status/reason stay 'unavailable'/'invalid_config' even with real observed usage", [invalidWithObservations.status, invalidWithObservations.unavailableReason], ["unavailable", "invalid_config"]);

  // -- gate: never falls back to Anthropic pricing for an Anthropic model id -
  const claudeModelRow = { model: "claude-sonnet-4-6", input: 1000000, cr: 1000000, out: 1000000 };
  const noFallback = computeCodexCreditEquivalent([claudeModelRow], pricing);
  check("an Anthropic model id is treated as an unpriced gap, never an Anthropic-pricing fallback", noFallback.status, "unavailable");
  check("an Anthropic model id never produces a nonzero credits/usd figure here", [noFallback.credits, noFallback.usd], [0, 0]);
  check("an Anthropic model id is recorded as unpriced, not silently dropped", noFallback.unpricedModels, ["claude-sonnet-4-6"]);
}

// ===========================================================================
// A3. build-report.js — computeScopedSessionSummary (shared full/current
//     session-attribution helper, gap-remediation item 1)
// ===========================================================================
//
// build-report.js is a script, not a module (no exports, runs its CLI body
// on require), so — same pattern already used above for
// applyCodexHostAdaptations/renderCodexCreditEquivalent in template.html —
// the function AND its small dependencies (isSubagentSession/
// isAcompactSessionId/usageTokens) are extracted verbatim from the shipped
// source via regex and executed in a vm sandbox. This tests the ACTUAL
// shipped implementation, not a reimplementation.
{
  const vmForSessionSummary = require("vm");
  const buildReportSrcForSessionSummary = fs.readFileSync(path.join(__dirname, "build-report.js"), "utf8");
  function extractVerbatim(src, re, label) {
    const m = src.match(re);
    if (!m) throw new Error(`could not extract ${label} from build-report.js — source shape changed`);
    return m[0];
  }
  const sessionSummarySrc = [
    extractVerbatim(buildReportSrcForSessionSummary, /const _subagentSep = \/\[\/\\\\\]subagents\[\/\\\\\]\/;\nfunction isSubagentSession\(session\) \{[\s\S]*?\n\}/, "isSubagentSession"),
    extractVerbatim(buildReportSrcForSessionSummary, /function isAcompactSessionId\(sessionId\) \{[\s\S]*?\n\}/, "isAcompactSessionId"),
    extractVerbatim(buildReportSrcForSessionSummary, /function usageTokens\(row\) \{[\s\S]*?\}/, "usageTokens"),
    extractVerbatim(buildReportSrcForSessionSummary, /function computeScopedSessionSummary\(scopedAllRows, timelines, sessionMapArg\) \{[\s\S]*?\n\}/, "computeScopedSessionSummary"),
  ].join("\n");

  const { round2 } = require("./lib/format");
  function runComputeScopedSessionSummary(scopedAllRows, timelines, sessionMap, isCodexHost) {
    const sandbox = { isCodex: isCodexHost, round2 };
    vmForSessionSummary.createContext(sandbox);
    vmForSessionSummary.runInContext(sessionSummarySrc + "\nvar __result = computeScopedSessionSummary(__scopedAllRows, __timelines, __sessionMap);", Object.assign(sandbox, {
      __scopedAllRows: scopedAllRows, __timelines: timelines, __sessionMap: sessionMap,
    }));
    return sandbox.__result;
  }

  // -- basic main+subtask split, Codex host (usage = tokens) -----------------
  const mainRow = { ts: 1, model: "gpt-5.6-sol", input: 100, cc: 0, cc5m: 0, cc1h: 0, cr: 0, out: 10, cost: 0 };
  const subRow = { ts: 2, model: "gpt-5.6-sol", input: 50, cc: 0, cc5m: 0, cc1h: 0, cr: 0, out: 5, cost: 0 };
  const timelines1 = new Map([["main1", [mainRow]], ["sub1", [subRow]]]);
  const sessionMap1 = new Map([
    ["main1", { sessionId: "main1" }],
    ["sub1", { sessionId: "sub1", isSubagent: true }],
  ]);
  const basic = runComputeScopedSessionSummary([mainRow, subRow], timelines1, sessionMap1, true);
  check("computeScopedSessionSummary splits main vs subtask correctly", [basic.sessionCount, basic.mainSessionCount, basic.subtaskCount], [2, 1, 1]);
  check("computeScopedSessionSummary invariant: mainSessionCount + subtaskCount === sessionCount", basic.mainSessionCount + basic.subtaskCount, basic.sessionCount);

  // -- acompact is excluded outright, even though it IS a subagent -----------
  const acompactRow = { ts: 3, model: "gpt-5.6-sol", input: 999, cc: 0, cc5m: 0, cc1h: 0, cr: 0, out: 999, cost: 0 };
  const timelines2 = new Map([...timelines1, ["agent-acompact-xyz", [acompactRow]]]);
  const sessionMap2 = new Map([...sessionMap1, ["agent-acompact-xyz", { sessionId: "agent-acompact-xyz", isSubagent: true }]]);
  const withAcompact = runComputeScopedSessionSummary([mainRow, subRow, acompactRow], timelines2, sessionMap2, true);
  check("computeScopedSessionSummary excludes acompact sessions entirely (not counted as a session at all)", [withAcompact.sessionCount, withAcompact.mainSessionCount, withAcompact.subtaskCount], [2, 1, 1]);

  // -- positive-usage-only: an all-zero-usage session is not "visible" -------
  const zeroUsageRow = { ts: 4, model: "gpt-5.6-sol", input: 0, cc: 0, cc5m: 0, cc1h: 0, cr: 0, out: 0, cost: 0 };
  const timelines3 = new Map([...timelines1, ["zero1", [zeroUsageRow]]]);
  const sessionMap3 = new Map([...sessionMap1, ["zero1", { sessionId: "zero1" }]]);
  const withZero = runComputeScopedSessionSummary([mainRow, subRow, zeroUsageRow], timelines3, sessionMap3, true);
  check("computeScopedSessionSummary excludes a session whose only rows have zero usage (positive usage only)", withZero.sessionCount, 2);

  // -- Claude host uses row.cost > 0, not token totals ------------------------
  const claudeMainRow = { ts: 1, model: "claude-sonnet-4-6", input: 100, cc: 0, cc5m: 0, cc1h: 0, cr: 0, out: 10, cost: 1.5 };
  const claudeZeroCostRow = { ts: 2, model: "claude-sonnet-4-6", input: 100, cc: 0, cc5m: 0, cc1h: 0, cr: 0, out: 10, cost: 0 };
  const claudeTimelines = new Map([["c-main", [claudeMainRow]], ["c-zero-cost", [claudeZeroCostRow]]]);
  const claudeSessionMap = new Map([["c-main", { sessionId: "c-main" }], ["c-zero-cost", { sessionId: "c-zero-cost" }]]);
  const claudeResult = runComputeScopedSessionSummary([claudeMainRow, claudeZeroCostRow], claudeTimelines, claudeSessionMap, false);
  check("computeScopedSessionSummary on the Claude host visibility-gates on cost>0, not token totals (a token-bearing but $0 row is not 'visible')", claudeResult.sessionCount, 1);

  // -- ONE helper for full and current mode: same session set, narrower
  // allRows scope (as current-mode filtering does in place) changes the
  // result via the Set-identity check alone, no second timestamp filter. ---
  const fullScope = runComputeScopedSessionSummary([mainRow, subRow], timelines1, sessionMap1, true);
  const currentScope = runComputeScopedSessionSummary([mainRow], timelines1, sessionMap1, true); // as if allRows were truncated to main1's window
  check("full-mode scope (all rows in allRows) counts both sessions", fullScope.sessionCount, 2);
  check("current-mode scope (allRows narrowed to one session's rows) counts only that session, via the SAME helper", [currentScope.sessionCount, currentScope.mainSessionCount, currentScope.subtaskCount], [1, 1, 0]);

  // -- identity coupling, documented via deliberate failure: allTimelines and
  // allRows MUST share row objects by reference. If a caller ever passes
  // CLONED rows in `scopedAllRows` (e.g. `{...row}` instead of the same
  // object), the Set-identity lookup silently treats every row as
  // out-of-scope — this is a fail-closed miscount (undercounts to zero),
  // not a crash, and it's a deliberate consequence of the identity coupling
  // documented on computeScopedSessionSummary, not a separate bug to fix.
  const clonedMainRow = { ...mainRow };
  const clonedSubRow = { ...subRow };
  const withClones = runComputeScopedSessionSummary([clonedMainRow, clonedSubRow], timelines1, sessionMap1, true);
  check("DELIBERATE cloned-row invariant failure: cloning rows before building allRows breaks the identity coupling and silently zeroes the count (fail-closed, not a crash)", withClones.sessionCount, 0);
  check("the same cloned-row scenario still returns a well-formed shape (no exception, no NaN)", [typeof withClones.sessionCount, typeof withClones.mainSessionCount, typeof withClones.subtaskCount], ["number", "number", "number"]);

  // -- sessionAttribution (gap-remediation item 2): component/role/model
  // conservation over a richer fixture — 1 main, 2 subtasks with DIFFERENT
  // roles and models, plus one subtask with neither (the "unknown" bucket).
  const attMain = { ts: 1, model: "gpt-5.6-sol", input: 1000, cc: 0, cc5m: 0, cc1h: 200, cr: 50, out: 100, cost: 0 };
  const attSubResearcher = { ts: 2, model: "gpt-5.5", input: 400, cc: 0, cc5m: 0, cc1h: 0, cr: 0, out: 40, cost: 0 };
  const attSubWorker = { ts: 3, model: "gpt-5.6-sol", input: 300, cc: 0, cc5m: 50, cc1h: 0, cr: 10, out: 30, cost: 0 };
  const attSubUnknown = { ts: 4, model: "gpt-5.6-sol", input: 200, cc: 0, cc5m: 0, cc1h: 0, cr: 0, out: 20, cost: 0 };
  const attTimelines = new Map([
    ["att-main", [attMain]],
    ["att-sub-researcher", [attSubResearcher]],
    ["att-sub-worker", [attSubWorker]],
    ["att-sub-unknown", [attSubUnknown]],
  ]);
  const attSessionMap = new Map([
    ["att-main", { sessionId: "att-main", model: "gpt-5.6-sol" }],
    ["att-sub-researcher", { sessionId: "att-sub-researcher", isSubagent: true, model: "gpt-5.5", agent: { role: "researcher", nickname: "Newton" } }],
    ["att-sub-worker", { sessionId: "att-sub-worker", isSubagent: true, model: "gpt-5.6-sol", agent: { role: "worker", nickname: "Lagrange" } }],
    ["att-sub-unknown", { sessionId: "att-sub-unknown", isSubagent: true, model: "gpt-5.6-sol" }], // no .agent at all
  ]);
  const attRows = [attMain, attSubResearcher, attSubWorker, attSubUnknown];
  const attFull = runComputeScopedSessionSummary(attRows, attTimelines, attSessionMap, true);
  const sa = attFull.attribution;

  check("sessionAttribution.total matches the exact sum of every visible row's components", sa.total, {
    input: 1900, output: 190, cacheWrite: 250, cacheRead: 60, total: 2400, sessions: 4,
  });
  check("sessionAttribution.main matches exactly the one main session's components", [sa.main.input, sa.main.output, sa.main.cacheWrite, sa.main.cacheRead, sa.main.total, sa.main.sessions], [1000, 100, 200, 50, 1350, 1]);
  check("sessionAttribution.subtasks matches exactly the three subtask sessions' components", [sa.subtasks.input, sa.subtasks.output, sa.subtasks.cacheWrite, sa.subtasks.cacheRead, sa.subtasks.total, sa.subtasks.sessions], [900, 90, 50, 10, 1050, 3]);
  check("main+subtasks conserves to total for every component (not just 'total')", ["input", "output", "cacheWrite", "cacheRead", "total"].every((k) => sa.main[k] + sa.subtasks[k] === sa.total[k]), true);
  check("main.pct + subtasks.pct reconstructs 100 exactly (2400 divides evenly here)", round2(sa.main.pct + sa.subtasks.pct), 100);
  check("main.pct is the exact fraction of total", sa.main.pct, round2(1350 / 2400 * 100));
  check("byRole has exact sorted buckets, including the 'unknown' fallback for a subagent with no .agent", Object.keys(sa.subtasks.byRole), ["researcher", "unknown", "worker"]);
  check("byModel has exact sorted buckets", Object.keys(sa.subtasks.byModel), ["gpt-5.5", "gpt-5.6-sol"]);
  check("byRole['researcher'] matches exactly that one subagent's components", sa.subtasks.byRole.researcher, { input: 400, output: 40, cacheWrite: 0, cacheRead: 0, total: 440, sessions: 1 });
  check("byRole['unknown'] matches exactly the no-.agent subagent's components", sa.subtasks.byRole.unknown, { input: 200, output: 20, cacheWrite: 0, cacheRead: 0, total: 220, sessions: 1 });
  check("byModel['gpt-5.6-sol'] merges the worker AND unknown-role subagents (same model, different roles)", sa.subtasks.byModel["gpt-5.6-sol"], { input: 500, output: 50, cacheWrite: 50, cacheRead: 10, total: 610, sessions: 2 });
  check("byRole partitions conserve to the subtasks total for every component", ["input", "output", "cacheWrite", "cacheRead", "total"].every((k) => Object.values(sa.subtasks.byRole).reduce((s, b) => s + b[k], 0) === sa.subtasks[k]), true);
  check("byModel partitions conserve to the subtasks total for every component", ["input", "output", "cacheWrite", "cacheRead", "total"].every((k) => Object.values(sa.subtasks.byModel).reduce((s, b) => s + b[k], 0) === sa.subtasks[k]), true);
  check("byRole/byModel session counts also conserve to subtasks.sessions", [Object.values(sa.subtasks.byRole).reduce((s, b) => s + b.sessions, 0), Object.values(sa.subtasks.byModel).reduce((s, b) => s + b.sessions, 0)], [3, 3]);
  check("integrity reports ok with zero errors on a well-formed fixture", [sa.integrity.ok, sa.integrity.errors], [true, []]);

  // -- current-mode parity: narrowing allRows to a subset must recompute
  // attribution from THAT subset only, via the same helper. --------------
  const attCurrent = runComputeScopedSessionSummary([attMain, attSubResearcher], attTimelines, attSessionMap, true).attribution;
  check("current-mode-scoped attribution only reflects rows within scope (main + 1 subtask)", [attCurrent.total.sessions, attCurrent.main.sessions, attCurrent.subtasks.sessions], [2, 1, 1]);
  check("current-mode-scoped attribution excludes the out-of-scope subtasks' tokens entirely", attCurrent.subtasks, { input: 400, output: 40, cacheWrite: 0, cacheRead: 0, total: 440, sessions: 1, pct: round2(440 / 1790 * 100), byRole: { researcher: { input: 400, output: 40, cacheWrite: 0, cacheRead: 0, total: 440, sessions: 1 } }, byModel: { "gpt-5.5": { input: 400, output: 40, cacheWrite: 0, cacheRead: 0, total: 440, sessions: 1 } } });
  check("current-mode-scoped attribution still passes integrity", attCurrent.integrity.ok, true);
}

// ===========================================================================
// B. plan-info.js — Codex plan order and "2" -> go
// ===========================================================================

{
  const { CODEX_PLAN_ORDER, normalizeCodexPlan, resolveCodexPlanChoice } = planInfo;
  check("plan order matches account.rs", CODEX_PLAN_ORDER, [
    "free", "go", "plus", "pro", "prolite", "team",
    "self_serve_business_usage_based", "business",
    "enterprise_cbp_usage_based", "enterprise", "edu", "unknown",
  ]);
  for (const key of CODEX_PLAN_ORDER.filter((k) => k !== "unknown")) {
    check(`normalizeCodexPlan recognizes "${key}"`, normalizeCodexPlan(key), { key, raw: key });
  }
  check("normalizeCodexPlan preserves an unrecognized plan_type verbatim", normalizeCodexPlan("some_future_plan"), { key: "unknown", raw: "some_future_plan" });
  check("normalizeCodexPlan(null) is unknown with no raw value fabricated", normalizeCodexPlan(null), { key: "unknown", raw: null });
  check('UI choice "2" maps to go', resolveCodexPlanChoice("2"), "go");
  check("plan key typed directly also resolves", resolveCodexPlanChoice("go"), "go");
  check('"unknown" is not a selectable UI choice', resolveCodexPlanChoice("unknown"), null);
}

// ===========================================================================
// C. codex-transcript.js — turn_context/token_count rows + cache invalidation
// ===========================================================================

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-usage-test-"));
const workCwd = path.join(tmp, "project");
fs.mkdirSync(workCwd, { recursive: true });
const codexHome = path.join(tmp, "codex-home");
fs.mkdirSync(path.join(codexHome, "sessions"), { recursive: true });
const fakeHome = path.join(tmp, "home");
fs.mkdirSync(fakeHome, { recursive: true });
process.env.CODEX_HOME = codexHome;

function row(obj) { return JSON.stringify(obj); }
function msg(role, text, ts) {
  return row({ timestamp: ts, type: "response_item", payload: { type: "message", role, content: [{ type: role === "assistant" ? "output_text" : "input_text", text }] } });
}
function turnContext(model, ts) {
  return row({ timestamp: ts, type: "turn_context", payload: { model, cwd: workCwd } });
}
function tokenCount(ts, total, last, rateLimits) {
  return row({ timestamp: ts, type: "event_msg", payload: { type: "token_count", info: { total_token_usage: total, last_token_usage: last, model_context_window: 828400 }, rate_limits: rateLimits } });
}

function writeRollout(name, meta, bodyLines) {
  const p = path.join(codexHome, "sessions", name);
  fs.writeFileSync(p, [row({ timestamp: meta.timestamp, type: "session_meta", payload: meta }), ...bodyLines].join("\n") + "\n");
  return p;
}

const sess1Meta = { session_id: "cccc0001-0000-4000-8000-000000000001", id: "cccc0001-0000-4000-8000-000000000001", cwd: workCwd, timestamp: "2026-01-01T00:00:00.000Z", thread_source: "user" };
const rl1 = { limit_id: "codex", plan_type: "prolite", primary: { used_percent: 80, window_minutes: 10080, resets_at: 1788160471 }, secondary: null };
const sess1Body = [
  turnContext("gpt-5.6-sol", "2026-01-01T00:00:01Z"),
  msg("user", "port the reader to rust", "2026-01-01T00:00:02Z"),
  tokenCount("2026-01-01T00:00:03Z",
    { input_tokens: 1000, cached_input_tokens: 200, cache_write_input_tokens: 0, output_tokens: 100, reasoning_output_tokens: 10, total_tokens: 1100 },
    { input_tokens: 1000, cached_input_tokens: 200, cache_write_input_tokens: 0, output_tokens: 100, reasoning_output_tokens: 10, total_tokens: 1100 },
    rl1),
  msg("assistant", "starting the port", "2026-01-01T00:00:04Z"),
  turnContext("gpt-5.6-sol-mini", "2026-01-01T00:00:05Z"), // model switch mid-session
  msg("user", "keep going", "2026-01-01T00:00:06Z"),
  tokenCount("2026-01-01T00:00:07Z",
    { input_tokens: 1500, cached_input_tokens: 200, cache_write_input_tokens: 0, output_tokens: 150, reasoning_output_tokens: 10, total_tokens: 1650 },
    { input_tokens: 500, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 50, reasoning_output_tokens: 0, total_tokens: 550 },
    { ...rl1, primary: { used_percent: 85, window_minutes: 10080, resets_at: 1788160471 } }),
];
const sess1Path = writeRollout("rollout-1.jsonl", sess1Meta, sess1Body);
const sess1MetaRead = codexTranscript.readSessionMeta(sess1Path);
const normalized1 = codexTranscript.normalizeCodexTranscript(sess1Path, sess1MetaRead);
const parsed1 = fs.readFileSync(normalized1, "utf8").replace(/\n$/, "").split("\n").map((l) => JSON.parse(l));

check("turn_context row translated to codex_turn_context with its model", () => [parsed1[1].type, parsed1[1].model], ["codex_turn_context", "gpt-5.6-sol"]);
check("token_count row translated to codex_token_count carrying total_token_usage", () => parsed1[3].totalTokenUsage.total_tokens, 1100);
check("token_count row carries rate_limits through untouched", () => parsed1[3].rateLimits.primary.window_minutes, 10080);
check("model switch mid-session produces a second codex_turn_context row", () => [parsed1[5].type, parsed1[5].model], ["codex_turn_context", "gpt-5.6-sol-mini"]);

// -- normalized cache invalidation: a stale v2-stamped file must be rewritten
const metaPath = normalized1 + ".meta.json";
fs.writeFileSync(metaPath, JSON.stringify({ version: 2 }));
fs.writeFileSync(normalized1, "stale content from a pre-v3 format\n");
const renormalized = codexTranscript.normalizeCodexTranscript(sess1Path, sess1MetaRead);
const stamp = JSON.parse(fs.readFileSync(renormalized + ".meta.json", "utf8"));
check("stale format-version stamp forces re-normalization", () => fs.readFileSync(renormalized, "utf8").includes("codex_token_count"), true);
check("re-normalization writes the current format version", stamp.version, 3);

// ===========================================================================
// D. End-to-end: analyze-usage.js --host codex
// ===========================================================================

const sess2Meta = { session_id: "cccc0002-0000-4000-8000-000000000002", id: "cccc0002-0000-4000-8000-000000000002", cwd: workCwd, timestamp: "2026-01-01T02:00:00.000Z", thread_source: "user" };
const sess2Body = [
  turnContext("gpt-5.6-sol", "2026-01-01T02:00:01Z"),
  msg("user", "another session, same rate-limit window", "2026-01-01T02:00:02Z"),
  tokenCount("2026-01-01T02:00:03Z",
    { input_tokens: 300, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 30, reasoning_output_tokens: 0, total_tokens: 330 },
    { input_tokens: 300, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 30, reasoning_output_tokens: 0, total_tokens: 330 },
    { limit_id: "codex", plan_type: "prolite", primary: { used_percent: 100, window_minutes: 10080, resets_at: 1788160471 }, secondary: null }),
  tokenCount("2026-01-01T02:00:04Z",
    { input_tokens: 300, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 30, reasoning_output_tokens: 0, total_tokens: 330 },
    { input_tokens: 0, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 0 },
    { limit_id: "codex_bengalfox", plan_type: "prolite", primary: { used_percent: 1, window_minutes: 300, resets_at: 1788160472 }, secondary: null }),
];
writeRollout("rollout-2.jsonl", sess2Meta, sess2Body);

const env = { ...process.env, CODEX_HOME: codexHome, HOME: fakeHome };
const analyzeOut = JSON.parse(execFileSync("node", [path.join(__dirname, "analyze-usage.js"), "--host", "codex", "--days", "all"], { encoding: "utf8", env }));

check("both Codex sessions are picked up", analyzeOut.sessions.length, 2);
const s1Out = analyzeOut.sessions.find((s) => s.sessionId === sess1Meta.id);
check("session totals sum authoritative per-row totals (1100 + 550)", s1Out.tokensCodex.total, 1650);
check("primaryModel reflects the LAST-seen model when counts tie (prospective, not majority-only)", s1Out.model === "gpt-5.6-sol" || s1Out.model === "gpt-5.6-sol-mini", true);
check("summary reports the Codex host and no cost data", [analyzeOut.summary.host, analyzeOut.summary.hasCostData, analyzeOut.summary.costKnownUSD], ["codex", false, null]);
check("no session carries a nonzero costUSD figure (0 is the safe neutral, N/A comes from summary.hasCostData, not this field)", analyzeOut.sessions.every((s) => s.costUSD === 0), true);

check("same limit_id/plan/lane/window/reset across the two sessions merges into one rate-limit sample", analyzeOut.rateLimitSamples.filter((s) => s.limitId === "codex" && s.lane === "primary" && s.resetsAt === 1788160471 && s.windowMinutes === 10080).length, 1);
const mergedSample = analyzeOut.rateLimitSamples.find((s) => s.limitId === "codex");
check("merged sample lists both sessions", (mergedSample.mergedSessions || []).sort(), [sess1Meta.id, sess2Meta.id].sort());
check("canonical rate limit ignores shorter additional buckets", [analyzeOut.canonicalRateLimits.primary.windowMinutes, analyzeOut.summary.windowMinutes], [10080, 10080]);

// -- Codex cache lives in its own sub-tree (codex/) under the shared base, so a
// tree walk on one host can never pick up the other's sessions. A stale/foreign
// summary.json at the Codex path must still not be misread as a valid Codex
// cache: isCodexCacheValid checks the `host` discriminator too.
const { projectNameFromCwd } = require("./lib/cache-paths");
const projectName = projectNameFromCwd(workCwd);
const summaryPath = path.join(fakeHome, ".claude", "super-token-saver-data", "codex", projectName, sess1Meta.id, "summary.json");
check("Codex session cache lives under the codex/ sub-tree of the shared base", fs.existsSync(summaryPath), true);
check("no Codex entry leaked into the Claude tree", fs.existsSync(path.join(fakeHome, ".claude", "super-token-saver-data", projectName, sess1Meta.id)), false);
const cachedSummary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
check("cached Codex summary is tagged with its host", cachedSummary.host, "codex");
const beforeMtime = fs.statSync(summaryPath).mtime;
// cacheVersion deliberately matches CODEX_CACHE_VERSION (1) so the version
// check alone would accept this entry — only the `host` field should reject
// it, isolating what that check actually contributes.
fs.writeFileSync(summaryPath, JSON.stringify({ host: "claude", cacheVersion: 2, decoy: true }));
fs.utimesSync(summaryPath, new Date(), new Date(Date.now() + 60000)); // newer than the transcript
const warmOut = JSON.parse(execFileSync("node", [path.join(__dirname, "analyze-usage.js"), "--host", "codex", "--days", "all"], { encoding: "utf8", env }));
const afterSummary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
check("a Claude-shaped cache entry at the same path is not read back as a valid Codex cache (host mismatch forces re-analysis)", afterSummary.host, "codex");
check("re-analysis overwrote the decoy content", afterSummary.decoy, undefined);
check("warm-cache canonical selection remains on limit_id=codex", [warmOut.canonicalRateLimits.primary.windowMinutes, warmOut.summary.windowMinutes], [10080, 10080]);
if (fs.statSync(summaryPath).mtime.getTime() === beforeMtime.getTime()) throw new Error("summary.json was not rewritten");

// -- Reuse of the real build-report.js/template.html pipeline, not a
// separate miniature builder: run the exact --host codex path the runner
// uses and check the output is the actual dashboard shell (calendar, donut
// chart, session-detail renderer, i18n plumbing), not bespoke Codex HTML.
const resultsFile = path.join(tmp, "results.json");
const analyzeOut2 = JSON.parse(execFileSync("node", [path.join(__dirname, "analyze-usage.js"), "--host", "codex", "--days", "all", "--force"], { encoding: "utf8", env }));
fs.writeFileSync(resultsFile, JSON.stringify(analyzeOut2));
const reportOut = path.join(tmp, "report.html");
const codexPromptOut = path.join(tmp, "codex-ai-prompt.txt");
execFileSync("node", [path.join(__dirname, "build-report.js"), "--host", "codex", "--data", resultsFile, "--export-data", path.join(tmp, "report-data.json"), "--export-prompt", codexPromptOut, "--output", reportOut], { encoding: "utf8", env });
const html = fs.readFileSync(reportOut, "utf8");
const codexAiPrompt = fs.readFileSync(codexPromptOut, "utf8");
const exportedReportData = JSON.parse(fs.readFileSync(path.join(tmp, "report-data.json"), "utf8"));
assertCodexDashboardParity(exportedReportData);

for (const marker of ['id="calendarGrid"', 'id="donutChart"', 'function renderContextCostCharts', 'class="container"', 'applyCodexHostAdaptations', 'applyI18N']) {
  check(`Codex report is the real dashboard template (has ${marker})`, html.includes(marker), true);
}
check("REPORT_DATA carries the Codex host flag for the template's own JS to branch on", exportedReportData.host, "codex");
check("REPORT_DATA marks cost as unavailable, not zero", [exportedReportData.summary.hasCostData, exportedReportData.summary.costKnownUSD], [false, null]);
check("Codex exports a full AI-analysis prompt instead of forcing no-ai", [codexAiPrompt.includes("## Codex Usage Data"), codexAiPrompt.includes("## Hourly Token Pattern"), codexAiPrompt.includes("## Context Size Distribution")], [true, true, true]);
check("Codex AI prompt does not reuse Claude dollar/cache-write claims", [codexAiPrompt.includes("Total cost: $"), codexAiPrompt.includes("Opus cache write is the most expensive")], [false, false]);
check("weekly rate limit is separate from the bounded calendar window", [exportedReportData.rateLimitWindowMinutes, exportedReportData.calendarWindowMinutes, exportedReportData.windowMinutes], [10080, 60, 60]);
check("weekly-only Codex uses analytics calendar buckets", [exportedReportData.calendarWindowSource, exportedReportData.windowSource], ["analytics_fallback", "analytics_fallback"]);
check("REPORT_DATA carries the merged rate-limit samples for the template's rate-limit card", exportedReportData.rateLimitSamples.some((s) => s.limitId === "codex"), true);
check("Codex window/session details survive zero-dollar pricing", exportedReportData.windows.some((w) => (w.windowSessions || []).length > 0), true);
check("Codex canonical windows do not overlap", () => exportedReportData.windows.slice(1).every((w, i) => exportedReportData.windows[i].endTs <= w.startTs), true);
check("Codex analytics windows are epoch-hour anchored", () => exportedReportData.windows.every((w) => w.startTs % 3600 === 0 && w.endTs - w.startTs === 3600), true);
check("weekly blocked moment is attached to its hourly calendar bucket", () => exportedReportData.windows.some((w) => w.usage === 100 && w.blockedAtTs > 0 && w.rlHours.length > 0), true);
check("Codex report exports an exact render horizon", () => exportedReportData.calendarDataEndExclusiveTs > 0, true);
check("calendar window identity uses stable startTs", html.includes("return slot.windowStartTs == null ? null : String(slot.windowStartTs)"), true);
check("Codex removes the redundant window/block toggle", [html.includes("clickModeToggle.remove()"), html.includes("REPORT_DATA.host === 'codex' ? 'block' : 'window'")], [true, true]);
check("Codex token usage slider is driven by hourly usage buckets", html.includes("var maxMetric = calendarUsageMetrics.length ? calendarUsageMetrics[0] : 0"), true);
check("Codex token threshold is applied by the calendar color renderer", () => /function getCellColor[\s\S]*?REPORT_DATA\.host === 'codex'[\s\S]*?cost < currentCostThreshold/.test(html), true);
check("Codex distinguishes token mix from the cost card via the donut heading", html.includes("Token Mix · snapshot"), true);
check("Codex context chart retains actual model ids", exportedReportData.contextUsageScatter.models.includes("gpt-5.6-sol"), true);
check("Codex context clusters retain bounded call samples for click drilldown", () => exportedReportData.contextUsageScatter.perAssistant.nonCW.bubbles.every((b) => Array.isArray(b.samples) && b.samples.length <= 12), true);
check("Codex context chart exposes an actual point-click drilldown", [html.includes("renderCodexContextSelection"), html.includes("onClick:function(event, elements)")], [true, true]);
check("Codex subscription report explains free cache creation and API-key caveat", [html.includes("codexCacheWriteNote"), html.includes("API-key usage may be billed")], [true, true]);
check("Codex context controls remove CW and consolidate Non-CW into API Calls", [html.includes("if (cwButton) cwButton.remove()"), html.includes("? 'API 호출' : 'API Calls'")], [true, true]);
check("Codex host adaptation does not hide CC chart sections", html.includes("['barChart', 'hourlyChart', 'dowChart', 'ctxCostAsstChart']"), false);
check("Codex chart labels are token-semantic 1:1 substitutions", [html.includes("Daily Token Trend"), html.includes("Hourly Token Pattern"), html.includes("Token Usage by Context Size")], [true, true, true]);
check("Codex visible chart notes are token-semantic substitutions", [html.includes("Average token usage for hours that had activity."), html.includes("Average token usage for active occurrences of each day."), html.includes("Shows how often each recorded context-size range occurred.")], [true, true, true]);

// ── Purchased-credit-equivalent headline cost, computed by the real pipeline ──
// sess1/sess2 fixtures mix a priced model (gpt-5.6-sol) with a genuinely
// unpriced one (gpt-5.6-sol-mini, mid-session model switch) — exercising the
// lower-bound path end to end, from the same final scoped allRows the rest
// of the report uses, not a hand-rolled fixture.
const ceExpectedCredits = 800 * 100 / 1e6 + 200 * 10 / 1e6 + 100 * 500 / 1e6 // sess1 row 1 (gpt-5.6-sol)
  + 300 * 100 / 1e6 + 30 * 500 / 1e6; // sess2 bootstrap row (gpt-5.6-sol)
check("REPORT_DATA carries the additive codexCreditEquivalent field", !!exportedReportData.codexCreditEquivalent, true);
check("E2E credit-equivalent is a lower bound (gpt-5.6-sol-mini has no rate-card entry)", exportedReportData.codexCreditEquivalent.status, "lower_bound");
check("E2E credit-equivalent sums exactly across sessions, ignoring the unpriced row", Math.round(exportedReportData.codexCreditEquivalent.credits * 1e6) / 1e6, Math.round(ceExpectedCredits * 1e6) / 1e6);
check("E2E credit-equivalent lists the exact unpriced model", exportedReportData.codexCreditEquivalent.unpricedModels, ["gpt-5.6-sol-mini"]);
check("E2E credit-equivalent eligible/priced token totals are exact", [exportedReportData.codexCreditEquivalent.eligibleTokens, exportedReportData.codexCreditEquivalent.pricedTokens], [1980, 1430]);
check("E2E credit-equivalent pricing metadata is carried through (retrievedAt/promotionThrough/promotionModel/scope/source)", [exportedReportData.codexCreditEquivalent.meta.retrievedAt, exportedReportData.codexCreditEquivalent.meta.promotionThrough, exportedReportData.codexCreditEquivalent.meta.promotionModel, exportedReportData.codexCreditEquivalent.meta.scope], ["2026-08-31", "2026-11-21", "gpt-5.6-sol", "purchased-credit-equivalent"]);
check("E2E deterministic insight (section1) scopes the promotion to gpt-5.6-sol only, not the whole rate card", [exportedReportData.aiAnalysis.section1.includes("Only gpt-5.6-sol is promotional, through 2026-11-21"), /every model.*promotional/i.test(exportedReportData.aiAnalysis.section1), /rate card is promotional/i.test(exportedReportData.aiAnalysis.section1)], [true, false, false]);
check("E2E Codex AI prompt scopes the promotion to gpt-5.6-sol only, not the whole rate card", [codexAiPrompt.includes("gpt-5.6-sol only is promotional through 2026-11-21"), codexAiPrompt.includes("does NOT apply to the rest of the rate card")], [true, true]);
check("E2E pricing metadata identifies the user-supplied OpenAI Codex rate card, dated, with no URL fabricated", [/user-supplied openai codex purchased-credit rate card/i.test(exportedReportData.codexCreditEquivalent.meta.source), exportedReportData.codexCreditEquivalent.meta.source.includes("2026-08-31"), /https?:\/\//.test(exportedReportData.codexCreditEquivalent.meta.source)], [true, true, false]);
check("E2E deterministic insight (section1) states the exact value/coverage and disclaims bill/savings/projection framing", [exportedReportData.aiAnalysis.section1.includes("≥$0.01"), exportedReportData.aiAnalysis.section1.includes("72.2%"), exportedReportData.aiAnalysis.section1.includes("not a bill, savings figure, or monthly projection")], [true, true, true]);
check("E2E Codex AI prompt receives the exact same value/coverage/unpriced-model figures and the strict framing rule", [codexAiPrompt.includes("≥$0.01"), codexAiPrompt.includes("72.2%"), codexAiPrompt.includes("gpt-5.6-sol-mini"), codexAiPrompt.includes("Never call it a bill, a savings figure, or a monthly projection")], [true, true, true, true]);

// build-report.js's insight/prompt text must branch per unavailableReason
// instead of universally claiming "no recorded model has a rate-card
// entry" for every unavailable state (that claim is only true for
// no_priced_models — it would misdescribe invalid_config/no_eligible_tokens).
const buildReportSrc = fs.readFileSync(path.join(__dirname, "build-report.js"), "utf8");
check("build-report.js's deterministic insight maps all three unavailableReasons in Korean", ["invalid_config", "no_eligible_tokens", "no_priced_models"].every((k) => buildReportSrc.includes(`ceUnavailableReasonKo`) && new RegExp(`${k}:`).test(buildReportSrc)), true);
check("build-report.js's deterministic insight has distinct English wording per reason (not one universal claim)", [
  /invalid_config:\s*'the rate-card configuration is invalid'/.test(buildReportSrc),
  /no_eligible_tokens:\s*'no eligible \(fresh\/cached\/output\) tokens were recorded'/.test(buildReportSrc),
  /no_priced_models:\s*'no recorded model has a rate-card entry'/.test(buildReportSrc),
], [true, true, true]);
check("build-report.js's AI prompt also branches per unavailableReason with the same three distinct reasons", [
  buildReportSrc.includes("the rate-card configuration is invalid"),
  buildReportSrc.includes("no eligible fresh/cached/output tokens were recorded"),
  (buildReportSrc.match(/no recorded model has a rate-card entry/g) || []).length >= 2, // once in the insight map, once in the AI-prompt map
], [true, true, true]);
check("template does NOT ship a fourth summary card for the credit-equivalent headline", html.includes('id="summaryCreditCard"'), false);
check("template reuses the first (cost) summary card's ids and keeps the explanatory note below the summary grid", [html.includes('id="summaryCostLabel"'), html.includes('id="summaryTotalCost"'), html.includes('id="summaryCostSub"'), html.includes('id="codexCreditEquivalentNote"')], [true, true, true, true]);
check("the credit-equivalent note sits right after the summary-bar, not buried in the token-details section", /<\/div>\s*<div id="codexCreditEquivalentNote"/.test(html), true);
check("Codex report's first summary card shows the purchased-credit-equivalent headline, not a raw token count", [html.includes("Purchased-Credit-Equivalent Cost"), /costLabelEl\.textContent = isKo \? '구매 크레딧 환산 비용' : 'Purchased-Credit-Equivalent Cost'/.test(html)], [true, true]);
check("Claude's first summary card keeps its original Total Cost behavior untouched", html.includes("document.getElementById('summaryTotalCost').textContent = '$' + REPORT_DATA.summary.totalCost.toLocaleString"), true);

// Directly exercise the pure host-adaptation function template.html ships —
// this project has no browser/DOM test runner (no build step, no npm deps),
// so this proves the *logic* (dynamic label, cost-unknown gating) is
// correct without needing a headless browser.
const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
const fnMatch = scriptMatch[1].match(/\(function applyCodexHostAdaptations\(\) \{[\s\S]*?\n\}\)\(\);/);
check("applyCodexHostAdaptations function is present verbatim in the shipped HTML", !!fnMatch, true);
const vm = require("vm");
function runHostAdaptations(reportData, i18nCalendar) {
  const classesAdded = [];
  const sandbox = {
    REPORT_DATA: reportData,
    I18N: { header: { title: "Claude Code Usage Report" }, calendar: i18nCalendar },
    document: { body: { classList: { add: (c) => classesAdded.push(c) } }, getElementById: () => ({ style: {}, closest: () => null, remove: () => {} }), querySelector: () => null },
  };
  vm.createContext(sandbox);
  vm.runInContext(fnMatch[0], sandbox);
  return { classesAdded, title: sandbox.I18N.header.title, calendar: sandbox.I18N.calendar };
}

{
  const { classesAdded, title, calendar } = runHostAdaptations(
    { host: "codex", windowMinutes: 10080 },
    { fiveHourWindow: "5-Hour Window", note: "Default view is 5-hour window — toggle to 1-hour blocks." },
  );
  check("applyCodexHostAdaptations adds the cost-unknown class for a Codex report", classesAdded, ["cost-unknown"]);
  check("applyCodexHostAdaptations changes the report title for Codex", title, "Codex Usage Report");
  check("applyCodexHostAdaptations computes a dynamic window label from REPORT_DATA (10080 min -> 7-Day Window)", calendar.fiveHourWindow, "7-Day Window");
  check("applyCodexHostAdaptations rewrites the calendar note to use the dynamic label, not '5-hour'", /5-hour/i.test(calendar.note), false);
}
{
  // A non-multiple-of-day/hour window (e.g. 90 min) still produces a sane,
  // non-hardcoded label — this is the "non-300-duration" case.
  const { calendar } = runHostAdaptations({ host: "codex", windowMinutes: 90 }, { fiveHourWindow: "5-Hour Window", note: "5-hour window" });
  check("a non-hour/non-day window (90 min) produces a minute-based label, not a fixed duration", calendar.fiveHourWindow, "90-Min Window");
}
{
  // Claude host: the function must return immediately and touch nothing.
  const { classesAdded, calendar } = runHostAdaptations({ host: "claude", windowMinutes: undefined }, { fiveHourWindow: "5-Hour Window", note: "5-hour window" });
  check("applyCodexHostAdaptations is a no-op for host=claude (Claude byte/behavior compatibility)", [classesAdded, calendar.fiveHourWindow], [[], "5-Hour Window"]);
}

// Directly exercise renderCodexCreditEquivalent() — same rationale as
// runHostAdaptations above: no headless browser here, so a vm sandbox with
// stub DOM elements is the only way to prove the Korean/English label,
// N/A-at-zero-coverage, and ≥-prefix-at-partial-coverage logic is correct.
const ceFnMatch = scriptMatch[1].match(/function renderCodexCreditEquivalent\(\) \{[\s\S]*?\n\}\n(?=\n\/\/ ─── Init)/);
check("renderCodexCreditEquivalent function is present verbatim in the shipped HTML", !!ceFnMatch, true);
function runCreditEquivalentRender(ce, locale) {
  const els = {};
  function el(id) { if (!els[id]) els[id] = { style: {}, textContent: "" }; return els[id]; }
  const sandbox = {
    REPORT_DATA: { codexCreditEquivalent: ce },
    I18N: { meta: { locale } },
    document: { getElementById: el },
  };
  vm.createContext(sandbox);
  vm.runInContext(ceFnMatch[0] + "\nrenderCodexCreditEquivalent();", sandbox);
  return els;
}

{
  const els = runCreditEquivalentRender(
    { status: "lower_bound", usd: 24.40, coveragePctEligible: 72.2222, unpricedModels: ["gpt-5.6-sol-mini"], creditsPerUsd: 25, meta: { retrievedAt: "2026-08-31", promotionThrough: "2026-11-21", promotionModel: "gpt-5.6-sol", source: "User-supplied OpenAI Codex purchased-credit rate card, dated 2026-08-31 (no URL supplied)" } },
    "en",
  );
  check("renderCodexCreditEquivalent relabels the FIRST (cost) summary card, not a new one", els.summaryCostLabel.textContent, "Purchased-Credit-Equivalent Cost");
  check("renderCodexCreditEquivalent prefixes a partial (lower-bound) value with ≥, in the existing value slot", els.summaryTotalCost.textContent, "≥$24.40");
  check("renderCodexCreditEquivalent lists coverage and the unpriced model in the existing sub-line slot", els.summaryCostSub.textContent, "Coverage 72.2% · Unpriced models: gpt-5.6-sol-mini");
  check("renderCodexCreditEquivalent English note states the rate-card caveat (not bill/allowance-valuation/savings/projection)", [/rate-card equivalent only/.test(els.codexCreditEquivalentNote.textContent), /not a savings figure or monthly projection/.test(els.codexCreditEquivalentNote.textContent)], [true, true]);
  check("renderCodexCreditEquivalent English note sources the rate card (user-supplied, dated, no URL)", [els.codexCreditEquivalentNote.textContent.includes("Rate card source: User-supplied OpenAI Codex purchased-credit rate card, dated 2026-08-31 (no URL supplied)"), /https?:\/\//.test(els.codexCreditEquivalentNote.textContent)], [true, false]);
  check("renderCodexCreditEquivalent does not touch a fourth card (none created/looked up)", "summaryCreditCard" in els, false);
  check("renderCodexCreditEquivalent English note scopes the promotion to gpt-5.6-sol only, not the whole rate card", els.codexCreditEquivalentNote.textContent.includes("Only gpt-5.6-sol is promotional, through 2026-11-21 — this does not apply to any other model on the rate card."), true);
  check("renderCodexCreditEquivalent English note never implies every model / the whole rate card is promotional", [/rate card is promotional/i.test(els.codexCreditEquivalentNote.textContent), /every model.*promotional/i.test(els.codexCreditEquivalentNote.textContent)], [false, false]);
  check("renderCodexCreditEquivalent English note renders the conversion using ce.creditsPerUsd, not a hardcoded 25", els.codexCreditEquivalentNote.textContent.includes("divided by 25 (25 credits = $1)"), true);
}
{
  const els = runCreditEquivalentRender(
    { status: "exact", usd: 24.40, coveragePctEligible: 100, unpricedModels: [], creditsPerUsd: 25, meta: { retrievedAt: "2026-08-31", promotionThrough: "2026-11-21", promotionModel: "gpt-5.6-sol", source: "User-supplied OpenAI Codex purchased-credit rate card, dated 2026-08-31 (no URL supplied)" } },
    "ko",
  );
  check("renderCodexCreditEquivalent uses the Korean label on the first card", els.summaryCostLabel.textContent, "구매 크레딧 환산 비용");
  check("renderCodexCreditEquivalent shows no ≥ prefix for a fully-priced ('exact') value", els.summaryTotalCost.textContent, "$24.40");
  check("renderCodexCreditEquivalent Korean note carries the same rate-card caveat", /요율표 기준 환산치일 뿐/.test(els.codexCreditEquivalentNote.textContent), true);
  check("renderCodexCreditEquivalent Korean note sources the rate card too", els.codexCreditEquivalentNote.textContent.includes("요율표 출처: User-supplied OpenAI Codex purchased-credit rate card, dated 2026-08-31 (no URL supplied)"), true);
  check("renderCodexCreditEquivalent Korean note scopes the promotion to gpt-5.6-sol only", els.codexCreditEquivalentNote.textContent.includes("gpt-5.6-sol 요율만 2026-11-21까지 프로모션이며, 다른 모델에는 적용되지 않습니다."), true);
  check("renderCodexCreditEquivalent Korean note renders the conversion using ce.creditsPerUsd, not a hardcoded 25", els.codexCreditEquivalentNote.textContent.includes("크레딧 25 = $1"), true);
}
{
  // Dynamic conversion proof: a non-25 creditsPerUsd fixture must show up
  // verbatim in both languages, never the literal "25" from a hardcoded string.
  const elsEn = runCreditEquivalentRender(
    { status: "exact", usd: 10, coveragePctEligible: 100, unpricedModels: [], creditsPerUsd: 40, meta: { retrievedAt: "2026-08-31", source: "test fixture" } },
    "en",
  );
  check("renderCodexCreditEquivalent (EN) renders a non-25 creditsPerUsd dynamically", elsEn.codexCreditEquivalentNote.textContent.includes("divided by 40 (40 credits = $1)"), true);
  check("renderCodexCreditEquivalent (EN) never leaks the old hardcoded 25 when creditsPerUsd is 40", elsEn.codexCreditEquivalentNote.textContent.includes("divided by 25"), false);
  const elsKo = runCreditEquivalentRender(
    { status: "exact", usd: 10, coveragePctEligible: 100, unpricedModels: [], creditsPerUsd: 40, meta: { retrievedAt: "2026-08-31", source: "test fixture" } },
    "ko",
  );
  check("renderCodexCreditEquivalent (KO) renders a non-25 creditsPerUsd dynamically", elsKo.codexCreditEquivalentNote.textContent.includes("크레딧 40 = $1"), true);
  check("renderCodexCreditEquivalent (KO) never leaks the old hardcoded 25 when creditsPerUsd is 40", elsKo.codexCreditEquivalentNote.textContent.includes("크레딧 25 = $1"), false);
  // No promotionModel/promotionThrough in this fixture -> no promo sentence, in either language.
  check("renderCodexCreditEquivalent omits the promotion sentence entirely when meta carries no promotionModel/promotionThrough", [/promotional/i.test(elsEn.codexCreditEquivalentNote.textContent), /프로모션/.test(elsKo.codexCreditEquivalentNote.textContent)], [false, false]);
}
{
  const els = runCreditEquivalentRender({ status: "unavailable", usd: 0, coveragePctEligible: 0, unpricedModels: [], meta: {} }, "en");
  check("renderCodexCreditEquivalent shows N/A when coverage is zero / status is unavailable", els.summaryTotalCost.textContent, "N/A");
}
// Each unavailableReason must render its OWN accurate subline text — an
// invalid config or an absence of eligible tokens is never worded as "no
// recorded model has a rate-card entry".
{
  const els = runCreditEquivalentRender({ status: "unavailable", unavailableReason: "invalid_config", usd: 0, coveragePctEligible: 0, unpricedModels: ["gpt-5.6-sol", "totally-unknown"], meta: {} }, "en");
  check("invalid_config renders N/A", els.summaryTotalCost.textContent, "N/A");
  check("invalid_config subline states the config is invalid, not a rate-card-entry gap", [els.summaryCostSub.textContent.includes("rate-card configuration is invalid"), els.summaryCostSub.textContent.includes("no recorded model has a rate-card entry")], [true, false]);
  check("invalid_config subline does not list unpricedModels as if they were a genuine pricing gap", els.summaryCostSub.textContent.includes("Unpriced models:"), false);
}
{
  const els = runCreditEquivalentRender({ status: "unavailable", unavailableReason: "no_eligible_tokens", usd: 0, coveragePctEligible: 0, unpricedModels: [], meta: {} }, "en");
  check("no_eligible_tokens renders N/A", els.summaryTotalCost.textContent, "N/A");
  check("no_eligible_tokens subline states no eligible tokens were recorded, not a rate-card-entry gap", [els.summaryCostSub.textContent.includes("no eligible tokens recorded"), els.summaryCostSub.textContent.includes("no recorded model has a rate-card entry")], [true, false]);
}
{
  const els = runCreditEquivalentRender({ status: "unavailable", unavailableReason: "no_priced_models", usd: 0, coveragePctEligible: 0, unpricedModels: ["totally-unknown"], meta: {} }, "en");
  check("no_priced_models renders N/A", els.summaryTotalCost.textContent, "N/A");
  check("no_priced_models subline correctly states the rate-card-entry gap AND lists the unpriced model", [els.summaryCostSub.textContent.includes("no recorded model has a rate-card entry"), els.summaryCostSub.textContent.includes("Unpriced models: totally-unknown")], [true, true]);
}
{
  const elsKo = runCreditEquivalentRender({ status: "unavailable", unavailableReason: "invalid_config", usd: 0, coveragePctEligible: 0, unpricedModels: ["gpt-5.6-sol"], meta: {} }, "ko");
  check("invalid_config Korean subline states a config error, not a model-coverage gap", [elsKo.summaryCostSub.textContent.includes("요율표 설정 오류"), elsKo.summaryCostSub.textContent.includes("미가격 모델")], [true, false]);
}
{
  // Claude never calls this (guarded by summary.hasCostData===false at the
  // init call site), but even a direct call with no codexCreditEquivalent
  // must render an explicit N/A on the reused card rather than stale text,
  // and must not create/reference a fourth card.
  const els = runCreditEquivalentRender(null, "en");
  check("renderCodexCreditEquivalent falls back to N/A on the reused card when codexCreditEquivalent is absent", els.summaryTotalCost.textContent, "N/A");
  check("renderCodexCreditEquivalent never creates/looks up a fourth card when codexCreditEquivalent is absent", "summaryCreditCard" in els, false);
}

check("Codex report keeps a scoped cost-unknown marker without deleting chart sections", html.includes("body.cost-unknown .cost-only-control"), true);
check("Codex report does not claim it is a bill anywhere in the AI/summary text", /is a bill/i.test(html), false);
check("Codex report always includes usage insight comments", () => [exportedReportData.aiAnalysis.section1, exportedReportData.aiAnalysis.section2, exportedReportData.aiAnalysis.section3].every((text) => typeof text === "string" && text.length > 20), true);
const koDataFile = path.join(tmp, "ko-report-data.json");
execFileSync("node", [path.join(__dirname, "build-report.js"), "--host", "codex", "--locale", "ko", "--data", resultsFile, "--export-data", koDataFile, "--output", path.join(tmp, "ko-report.html")], { encoding: "utf8", env });
const koInsight = JSON.parse(fs.readFileSync(koDataFile, "utf8")).aiAnalysis.section2;
check("Korean insight uses a localized weekday", [/[A-Z][a-z]{2}요일/.test(koInsight), /[일월화수목금토]요일/.test(koInsight)], [false, true]);

// Two-lane current mode: primary may be a short interactive window while
// secondary is the weekly allowance. Current scope must follow the longest
// canonical lane, while the calendar remains bounded to analytics hours.
const twoLaneResults = JSON.parse(JSON.stringify(analyzeOut2));
twoLaneResults.canonicalRateLimits = {
  limitId: "codex",
  primary: { limitId: "codex", lane: "primary", usedPercent: 20, windowMinutes: 300, resetsAt: 1767243600, ts: "2026-01-01T02:00:04Z" },
  secondary: { limitId: "codex", lane: "secondary", usedPercent: 40, windowMinutes: 10080, resetsAt: 1767830400, ts: "2026-01-01T02:00:04Z" },
};
twoLaneResults.summary.windowMinutes = 10080;
const twoLaneFile = path.join(tmp, "two-lane-results.json");
const twoLaneDataFile = path.join(tmp, "two-lane-report-data.json");
fs.writeFileSync(twoLaneFile, JSON.stringify(twoLaneResults));
execFileSync("node", [path.join(__dirname, "build-report.js"), "--host", "codex", "--current", "--data", twoLaneFile, "--export-data", twoLaneDataFile, "--output", path.join(tmp, "two-lane-report.html")], { encoding: "utf8", env });
const twoLaneData = JSON.parse(fs.readFileSync(twoLaneDataFile, "utf8"));
check("two-lane current mode scopes by weekly secondary", [twoLaneData.rateLimitWindowMinutes, twoLaneData.calendarWindowMinutes, twoLaneData.windowSource], [10080, 60, "analytics_fallback"]);
check("two-lane current mode retains bounded clickable detail windows", () => twoLaneData.windows.length > 0 && twoLaneData.windows.every((w) => w.endTs - w.startTs === 3600 && (w.windowSessions || []).length > 0), true);
check("current mode still computes the credit-equivalent headline, scoped to the filtered allRows", !!twoLaneData.codexCreditEquivalent, true);

// ===========================================================================
// D2. Session-detail attribution/privacy (gap-remediation items 2 & 3),
//     full pipeline: sessionAttribution export + per-session detail fields
//     (isSubtask/taskThreadId/parentSessionId/agentRole/agentNickname/orphan)
//     + private-mode redaction. Uses an ISOLATED fixture/tmp dir so these
//     assertions never entangle with the hand-computed numbers exercised
//     above (which are tied exactly to the sess1/sess2 fixture).
// ===========================================================================
{
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), "codex-usage-test-attribution-"));
  const workCwd2 = path.join(tmp2, "project");
  fs.mkdirSync(workCwd2, { recursive: true });
  const codexHome2 = path.join(tmp2, "codex-home");
  fs.mkdirSync(path.join(codexHome2, "sessions"), { recursive: true });
  const fakeHome2 = path.join(tmp2, "home");
  fs.mkdirSync(fakeHome2, { recursive: true });

  function writeRollout2(name, meta, bodyLines) {
    const p = path.join(codexHome2, "sessions", name);
    fs.writeFileSync(p, [row({ timestamp: meta.timestamp, type: "session_meta", payload: meta }), ...bodyLines].join("\n") + "\n");
    return p;
  }

  const mainMeta2 = { session_id: "dddd0001-0000-4000-8000-000000000001", id: "dddd0001-0000-4000-8000-000000000001", cwd: workCwd2, timestamp: "2026-02-01T00:00:00.000Z", thread_source: "user" };
  const mainBody2 = [
    turnContext("gpt-5.6-sol", "2026-02-01T00:00:01Z"),
    msg("user", "build the feature", "2026-02-01T00:00:02Z"),
    tokenCount("2026-02-01T00:00:03Z",
      { input_tokens: 1000, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 100, reasoning_output_tokens: 0, total_tokens: 1100 },
      { input_tokens: 1000, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 100, reasoning_output_tokens: 0, total_tokens: 1100 },
      { limit_id: "codex", plan_type: "prolite", primary: { used_percent: 5, window_minutes: 10080, resets_at: 1900000000 }, secondary: null }),
  ];
  writeRollout2("rollout-main.jsonl", mainMeta2, mainBody2);

  // Subagent sharing the main session's threadId (session_id) — Codex never
  // verifies a parent-child edge, so this is the "shared-thread, orphan"
  // scenario item 3 asks for: same task thread, no verified parent.
  const subMeta2 = {
    session_id: mainMeta2.session_id,
    id: "dddd0002-0000-4000-8000-000000000002",
    cwd: workCwd2,
    timestamp: "2026-02-01T00:05:00.000Z",
    thread_source: "subagent",
    source: { subagent: { thread_spawn: { parent_thread_id: mainMeta2.session_id, agent_role: "researcher", agent_nickname: "Newton" } } },
  };
  const subBody2 = [
    turnContext("gpt-5.5", "2026-02-01T00:05:01Z"),
    msg("user", "research the API", "2026-02-01T00:05:02Z"),
    tokenCount("2026-02-01T00:05:03Z",
      { input_tokens: 400, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 40, reasoning_output_tokens: 0, total_tokens: 440 },
      { input_tokens: 400, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 40, reasoning_output_tokens: 0, total_tokens: 440 },
      null),
  ];
  writeRollout2("rollout-sub.jsonl", subMeta2, subBody2);

  // A second subagent with NO agent_role/agent_nickname at all — exercises
  // the "unknown" fallback.
  const subMeta2b = {
    session_id: mainMeta2.session_id,
    id: "dddd0003-0000-4000-8000-000000000003",
    cwd: workCwd2,
    timestamp: "2026-02-01T00:10:00.000Z",
    thread_source: "subagent",
    source: { subagent: { thread_spawn: { parent_thread_id: mainMeta2.session_id } } },
  };
  const subBody2b = [
    turnContext("gpt-5.6-sol", "2026-02-01T00:10:01Z"),
    msg("user", "do the unnamed subtask", "2026-02-01T00:10:02Z"),
    tokenCount("2026-02-01T00:10:03Z",
      { input_tokens: 200, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 20, reasoning_output_tokens: 0, total_tokens: 220 },
      { input_tokens: 200, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 20, reasoning_output_tokens: 0, total_tokens: 220 },
      null),
  ];
  writeRollout2("rollout-sub-unknown.jsonl", subMeta2b, subBody2b);

  const env2 = { ...process.env, CODEX_HOME: codexHome2, HOME: fakeHome2 };
  const analyzeOut2b = JSON.parse(execFileSync("node", [path.join(__dirname, "analyze-usage.js"), "--host", "codex", "--days", "all"], { encoding: "utf8", env: env2 }));
  check("attribution fixture: main + 2 subagents (shared thread) are all picked up", analyzeOut2b.sessions.length, 3);

  const resultsFile2 = path.join(tmp2, "results.json");
  fs.writeFileSync(resultsFile2, JSON.stringify(analyzeOut2b));
  const reportDataFile2 = path.join(tmp2, "report-data.json");
  execFileSync("node", [path.join(__dirname, "build-report.js"), "--host", "codex", "--data", resultsFile2, "--export-data", reportDataFile2, "--output", path.join(tmp2, "report.html")], { encoding: "utf8", env: env2 });
  const attributionReportData = JSON.parse(fs.readFileSync(reportDataFile2, "utf8"));
  const sa2 = attributionReportData.sessionAttribution;

  check("E2E sessionAttribution reports 3 visible sessions total (1 main + 2 subtasks)", [sa2.total.sessions, sa2.main.sessions, sa2.subtasks.sessions], [3, 1, 2]);
  check("E2E sessionAttribution main+subtasks sessions conserve to total", sa2.main.sessions + sa2.subtasks.sessions, sa2.total.sessions);
  check("E2E sessionAttribution token components conserve: main+subtasks=total for every component", ["input", "output", "cacheWrite", "cacheRead", "total"].every((k) => sa2.main[k] + sa2.subtasks[k] === sa2.total[k]), true);
  check("E2E sessionAttribution byRole has exact sorted buckets including 'unknown'", Object.keys(sa2.subtasks.byRole), ["researcher", "unknown"]);
  check("E2E sessionAttribution byModel has exact sorted buckets", Object.keys(sa2.subtasks.byModel), ["gpt-5.5", "gpt-5.6-sol"]);
  check("E2E byRole partitions conserve to subtasks total for every component", ["input", "output", "cacheWrite", "cacheRead", "total"].every((k) => Object.values(sa2.subtasks.byRole).reduce((s, b) => s + b[k], 0) === sa2.subtasks[k]), true);
  check("E2E byModel partitions conserve to subtasks total for every component", ["input", "output", "cacheWrite", "cacheRead", "total"].every((k) => Object.values(sa2.subtasks.byModel).reduce((s, b) => s + b[k], 0) === sa2.subtasks[k]), true);
  check("E2E sessionAttribution integrity reports ok with no errors", [sa2.integrity.ok, sa2.integrity.errors], [true, []]);

  // -- per-session detail fields ----------------------------------------
  function collectDetails(reportData) {
    const out = [];
    for (const w of reportData.windows) {
      for (const ws of (w.windowSessions || [])) {
        for (const d of (ws.details || [])) out.push(d);
      }
    }
    return out;
  }
  const allDetails2 = collectDetails(attributionReportData);
  const subDetails = allDetails2.filter((d) => d.isSubtask);
  const mainDetails = allDetails2.filter((d) => !d.isSubtask);
  check("windowSessions details include both subagent detail entries", subDetails.length, 2);
  const named = subDetails.find((d) => d.agentRole === "researcher");
  const unnamed = subDetails.find((d) => d.agentRole === "unknown");
  check("named subagent detail carries its exact role/nickname", () => [named.agentRole, named.agentNickname], ["researcher", "Newton"]);
  check("unnamed subagent detail falls back to 'unknown' for role/nickname", () => [unnamed.agentRole, unnamed.agentNickname], ["unknown", "unknown"]);
  check("Codex subagent detail's taskThreadId is the SHARED thread id, never claimed as an immediate parent", () => [named.taskThreadId, unnamed.taskThreadId], [mainMeta2.session_id, mainMeta2.session_id]);
  check("Codex subagent detail's parentSessionId stays null — Codex has no verified parent linkage", () => [named.parentSessionId, unnamed.parentSessionId], [null, null]);
  check("Codex subagent detail is explicitly marked orphan (no verified parent), not silently defaulted", () => [named.orphan, unnamed.orphan], [true, true]);
  check("main session detail is not a subtask and makes no orphan/role/nickname/parent claims", () => {
    const m = mainDetails[0];
    return [m.isSubtask, m.parentSessionId, m.orphan, m.agentRole, m.agentNickname];
  }, [false, null, false, null, null]);

  // -- UI: the calendar detail table marks subtask/role/model/thread status
  const html2 = fs.readFileSync(path.join(tmp2, "report.html"), "utf8");
  check("template ships the subtask type-cell/tooltip helpers", [html2.includes("function formatSubtaskTypeCell"), html2.includes("function formatSubtaskTitle")], [true, true]);
  check("subtask type-cell formatting never phrases an unverified taskThreadId as a claimed parent", () => {
    const fnMatch = html2.match(/function formatSubtaskTitle\(d\) \{[\s\S]*?\n\}/);
    return fnMatch && fnMatch[0].includes("not verified") && !/return .*Parent:.*\+ d\.taskThreadId/.test(fnMatch[0]);
  }, true);
  {
    const vmForUi = require("vm");
    const scriptMatch2 = html2.match(/<script>([\s\S]*)<\/script>/);
    const typeCellFn = scriptMatch2[1].match(/function formatSubtaskTypeCell\(d\) \{[\s\S]*?\n\}/)[0];
    const titleFn = scriptMatch2[1].match(/function formatSubtaskTitle\(d\) \{[\s\S]*?\n\}/)[0];
    const sandbox = { I18N: { meta: { locale: "en" } } };
    vmForUi.createContext(sandbox);
    vmForUi.runInContext(typeCellFn + "\n" + titleFn, sandbox);
    const cellText = sandbox.formatSubtaskTypeCell({ isSubtask: true, type: "sub", agentRole: "researcher", model: "gpt-5.5" });
    const titleText = sandbox.formatSubtaskTitle({ isSubtask: true, taskThreadId: "dddd0001-full-id", parentSessionId: null, orphan: true, agentNickname: "Newton" });
    check("formatSubtaskTypeCell visibly marks subtask + role + model", cellText, "sub · researcher · gpt-5.5");
    check("formatSubtaskTitle shows the task thread and an explicit 'not verified'/orphan state, without naming a parent", [titleText.includes("Task thread: dddd0001"), titleText.includes("Parent: not verified (orphan)"), /Parent \(verified\)/.test(titleText)], [true, true, false]);
    const mainCellText = sandbox.formatSubtaskTypeCell({ isSubtask: false, type: "main" });
    check("formatSubtaskTypeCell leaves main-session type text untouched", mainCellText, "main");
  }

  // -- private mode: consistent redaction of session/thread/nickname ids --
  const privateReportDataFile2 = path.join(tmp2, "private-report-data.json");
  execFileSync("node", [path.join(__dirname, "build-report.js"), "--host", "codex", "--private", "--data", resultsFile2, "--export-data", privateReportDataFile2, "--output", path.join(tmp2, "private-report.html")], { encoding: "utf8", env: env2 });
  const privateReportData = JSON.parse(fs.readFileSync(privateReportDataFile2, "utf8"));
  const privateDetails = collectDetails(privateReportData);
  const privateSub = privateDetails.filter((d) => d.isSubtask);
  const privateNamed = privateSub.find((d) => d.agentNickname !== "unknown");
  const privateUnnamed = privateSub.find((d) => d.agentNickname === "unknown");

  check("private mode redacts the subagent's own session id (no longer the raw UUID)", privateNamed.id !== "dddd0002-0000-4000-8000-000000000002" && privateNamed.id.startsWith("sess_"), true);
  check("private mode redacts taskThreadId (no longer the raw shared session_id)", privateNamed.taskThreadId !== mainMeta2.session_id && privateNamed.taskThreadId.startsWith("thread_"), true);
  check("private mode redacts agentNickname (no longer the literal human-readable name)", privateNamed.agentNickname !== "Newton" && privateNamed.agentNickname.startsWith("nick_"), true);
  check("private mode leaves the 'unknown' nickname fallback alone (nothing identifying to redact)", privateUnnamed.agentNickname, "unknown");
  check("private mode's redaction is CONSISTENT: the same raw taskThreadId redacts to the same token on both subagent details", privateSub[0].taskThreadId, privateSub[1].taskThreadId);
  check("private mode redaction never breaks the orphan/parentSessionId=null contract", () => privateSub.every((d) => d.parentSessionId === null && d.orphan === true), true);
  check("private mode preserves token/cost numbers untouched (only identifiers are redacted)", [privateNamed.input, privateNamed.output], [400, 40]);
  check("private mode does not alter sessionAttribution's aggregate numbers (no identifiers exposed there)", privateReportData.sessionAttribution.subtasks, sa2.subtasks);
  check("private mode still marks the report as private", privateReportData.privateMode, true);
}

// ===========================================================================
// E. Regression — Claude path and existing gates unaffected
// ===========================================================================

const claudeEnv = { ...process.env, HOME: fakeHome };
const claudeOut = JSON.parse(execFileSync("node", [path.join(__dirname, "analyze-usage.js"), "--project", "__nonexistent_project__"], { encoding: "utf8", env: claudeEnv }));
check("default host is still claude", claudeOut.summary.host, "claude");
check("Claude path with no matching project still returns a well-formed empty result", claudeOut.summary.sessionCount, 0);

// build-report.js with no --host must behave exactly as it did before this
// port existed: no Codex-only keys leak into REPORT_DATA, and the additive
// summary fields carry Claude's own truthful values.
const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), "codex-usage-test-claude-"));
const claudeResultsFile = path.join(tmp2, "results.json");
const claudeSessionId = "dddd0001-0000-4000-8000-000000000001";
const claudeCacheDir = path.join(fakeHome, ".claude", "super-token-saver-data", "claude-fixture", claudeSessionId);
fs.mkdirSync(claudeCacheDir, { recursive: true });
fs.writeFileSync(path.join(claudeCacheDir, "summary.json"), JSON.stringify({ sessionId: claudeSessionId }));
fs.writeFileSync(path.join(claudeCacheDir, "timeline.csv"), "ts,model,input,cc,cc5m,cc1h,cr,out,cost,win,rl,evt,line,req\n1767225603,claude-sonnet-4-6,1000000,200000,0,200000,500000,100000,20,,,,3,req-1\n");
const claudeFixtureSession = { sessionId: claudeSessionId, filePath: path.join(fakeHome, ".claude", "projects", "claude-fixture", claudeSessionId + ".jsonl"), firstTs: "2026-01-01T00:00:00Z", lastTs: "2026-01-01T00:01:00Z", firstUserMsg: "nonempty Claude fixture", lastUserMsg: "nonempty Claude fixture", userMsgs: 1, asstMsgs: 1 };
fs.writeFileSync(claudeResultsFile, JSON.stringify({ sessions: [claudeFixtureSession], summary: { totalTokens: 1800, sessionCount: 1, dateRange: { from: "2026-01-01T00:00:00Z", to: "2026-01-01T00:01:00Z" }, host: "claude", hasCostData: true } }));
const claudeReportDataFile = path.join(tmp2, "report-data.json");
execFileSync("node", [path.join(__dirname, "build-report.js"), "--data", claudeResultsFile, "--export-data", claudeReportDataFile, "--output", path.join(tmp2, "report.html")], { encoding: "utf8", env: claudeEnv });
const claudeReportData = JSON.parse(fs.readFileSync(claudeReportDataFile, "utf8"));
check("Claude REPORT_DATA host is 'claude'", claudeReportData.host, "claude");
check("Claude REPORT_DATA still reports real cost data (hasCostData true)", claudeReportData.summary.hasCostData, true);
check("Claude REPORT_DATA carries no Codex-only keys (rateLimitSamples/windowMinutes)", [("rateLimitSamples" in claudeReportData), ("windowMinutes" in claudeReportData)], [false, false]);
check("Claude REPORT_DATA carries no codexCreditEquivalent key (additive-only, host-gated)", "codexCreditEquivalent" in claudeReportData, false);
check("nonempty Claude fixture preserves priced usage", claudeReportData.summary.totalCost > 0, true);
check("nonempty Claude fixture preserves window/session detail", claudeReportData.windows.some((w) => (w.windowSessions || []).length > 0), true);
fs.rmSync(tmp2, { recursive: true, force: true });

try {
  execFileSync("node", [path.join(__dirname, "test-codex-adapter.js")], { encoding: "utf8" });
  check("existing codex-adapter gate (line-parity, subagent id, compaction vocabulary) still passes", true, true);
} catch (e) {
  check("existing codex-adapter gate (line-parity, subagent id, compaction vocabulary) still passes", `FAILED: ${e.stdout || e.message}`, true);
}

try {
  execFileSync("python3", [path.join(__dirname, "test_product_parity.py")], { encoding: "utf8", cwd: path.join(__dirname, "..") });
  check("product-parity gate (manifests, skill set, plugin-root rule) still passes", true, true);
} catch (e) {
  check("product-parity gate (manifests, skill set, plugin-root rule) still passes", `FAILED: ${e.stdout || e.message}`, true);
}

// ===========================================================================
// `fakeHome` lives inside `tmp`, so removing `tmp` also removes every cache
// entry the child processes above wrote. Section C called
// codexTranscript.normalizeCodexTranscript() directly in this process, which
// resolves NORMALIZED_ROOT from *this* process's real HOME (env HOME is only
// overridden for the child execFileSync calls) — same as the precedent in
// test-codex-adapter.js, and cleaned up the same way here.
fs.rmSync(tmp, { recursive: true, force: true });
try { fs.rmSync(normalized1, { force: true }); } catch {}
try { fs.rmSync(normalized1 + ".meta.json", { force: true }); } catch {}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
