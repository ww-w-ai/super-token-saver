# Codex port backlog — the rest of the dual-host surface

`s-continue`, `s-compact` and `usage-view` ship to both hosts. The two remaining skills do not,
and one of them is a deliberate stop rather than a task.

## What Codex actually records

Verified against a real rollout, `~/.codex/sessions/2026/08/25/rollout-…-01a035f9….jsonl`.
Every turn emits an `event_msg` row of type `token_count`:

```json
{"type":"token_count",
 "info":{"total_token_usage":{"input_tokens":23570,"cached_input_tokens":6912,
          "cache_write_input_tokens":0,"output_tokens":154,
          "reasoning_output_tokens":0,"total_tokens":23724},
         "last_token_usage":{…same shape…},
         "model_context_window":828400},
 "rate_limits":{"limit_id":"codex","primary":{"used_percent":87.0,
          "window_minutes":10080,"resets_at":1788160471},
          "secondary":null,"credits":{…},"plan_type":"prolite",
          "rate_limit_reached_type":null}}
```

The model id is not in that row — it is on the `turn_context` row (`"model":"gpt-5.6-sol"`), which
also carries `cwd`, `approval_policy` and `sandbox_policy`.

**This is more than Claude Code gives us, not less.** Claude Code makes the plugin reconstruct a
window from token counts and pricing; Codex states the used percentage and the reset instant
outright.

## 1. `usage-view` → Codex (shipped in 3.3.0)

The timeline consumes running-total deltas (`createSessionUsageTracker` in `scripts/lib/codex-usage.js`), cost is
reported as a purchased-credit equivalent, and the window length is data, not a constant. The
rules live in `CLAUDE.md` under the dual-host skills.

## 2. `report-limit` → Codex (port)

`report-limit` exists because Anthropic does not publish the 5-hour rate-limit formula, so the
plugin infers it. **That premise does not hold on Codex**, which reports the limit directly.

So the Codex version is a different skill wearing the same name:

- Read `rate_limits.primary` — `used_percent`, `window_minutes`, `resets_at` — and report it.
- Nothing needs deriving, so there is nothing to crowd-source. **Decide whether the Codex build
  submits anything to the GitHub discussion at all**, or simply displays the limit locally. Sending
  data nobody has to reverse-engineer is noise.
- `plan_type` (`prolite`, …) and `credits.balance` have no Claude Code counterpart; both belong in
  the local display.

**Window mismatch — the single biggest assumption to break.** Claude Code's window is 5 hours and it
is hardcoded across `window-utils.js`, the dashboard timeline, and the statusline. The observed
Codex `primary.window_minutes` is **10080 (7 days)**, and `secondary` was null in the sample. Treat
the window length as data carried alongside each sample, not as a constant. Until that is done, a
Codex sample rendered on a 5-hour axis is simply wrong.

Verify against more than one plan before fixing the shape: this sample is one account on
`plan_type: prolite`, and `secondary`/`individual_limit` may be populated elsewhere.

## 3. `setup-statusline` → research, not a port

Codex already has a status line, and it is configured, not scripted. From `~/.codex/config.toml`:

```toml
status_line = ["model-with-reasoning", "context-used", "five-hour-limit", "git-branch", "task-progress", "context-window-size", "weekly-limit"]
status_line_use_colors = true
```

Those segment names appear in the Codex binary as a fixed set, and `status_line` /
`status_line_use_colors` are keys of the TUI config struct. Claude Code's status line runs an
arbitrary command; nothing found so far says Codex will run one.

**Research question, in order:**

1. Does any Codex status-line segment execute a user command or read a user-supplied file? If not,
   this skill has no Codex form and should say so permanently instead of staying "not yet ported".
2. If a custom segment exists, what is it fed and how often is it invoked? `statusline-logger.sh`
   assumes Claude Code's JSON-on-stdin contract and a 60-second idle timeout.
3. Failing both, is there anything worth doing at all? Codex's built-in segments already cover
   context used, the five-hour limit, the weekly limit and the context window — most of what
   `setup-statusline` installs. **A port that adds nothing is not a port.** Record that verdict
   rather than leaving the question open.

Do this research BEFORE promising a Codex status line anywhere user-visible.
