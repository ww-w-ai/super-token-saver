# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Claude Code plugin (super-token-saver) that automates token/cache management, cost tracking, session control, and research-backed thinking patterns. No npm dependencies, zero config. Pure Node.js + Bash (two pure-JS image codecs are vendored under `scripts/lib/vendor/`, still no install step).

## Architecture

```
hooks/          → Host-specific lifecycle registries plus their Bash commands and injected guidance.
skills/         → 5 SKILL.md-based skills invoked via /s-continue, /s-compact, /usage-view, /setup-statusline, /report-limit
scripts/        → Node.js processing pipeline (no npm, no build step)
                  + shrink-img.js — image downscaler for cheaper file attachments
scripts/lib/    → Shared utilities (pricing, cache paths, locale, window calculations)
scripts/lib/vendor/ → Vendored pure-JS third-party (pngjs MIT, jpeg-js BSD) for shrink-img; see THIRD-PARTY-NOTICES.md
locales/        → 23 language JSON files for dashboard UI strings
```

**Data flow**: transcripts (JSONL) → `preprocess.js` / `analyze-usage.js` → cached artifacts → skills consume them.

### Two transcript sources, one pipeline

`/s-continue` and `/s-compact` read Claude Code AND Codex sessions. A Codex rollout is not parsed
by a second parser — `scripts/lib/codex-transcript.js` rewrites it into the shape CC writes, **one
output line per input line**, and everything downstream runs unchanged.

- **Why line parity matters**: every `L{n}` marker must still address the Codex original's line. A
  normalizer that dropped non-message rows would silently shift them.
- **Key on `payload.id`, never `session_id`.** In Codex `session_id` is the THREAD id and a spawned
  subagent inherits its parent's, so three files can carry the same one and overwrite each other's
  cache. Subagent rollouts are excluded from the list, as CC subtask transcripts already are.
- **Codex compaction is translated into `system/compact_boundary`**, so a compacted Codex session
  gets the same `#0` pre-loss restore a compacted CC session gets.
- `CODEX_HOME` is honoured. **Everything Codex lives under `…-data/codex/`**: normalized copies in
  `codex/.normalized/{projectHash}/`, analysis cache and `compact.txt` in `codex/{projectHash}/{sid}/`.
  Claude Code stays at the root of the same base (the Bash statusline hook writes there). Get paths
  from `cache-paths.forHost('codex')`; the root getters and `listProjects()` are the Claude tree and
  never return `codex`. The one-time move of pre-split entries is `migrateCodexSubdir()` (it
  runs while `.codex-normalized` still exists at the root). Gate: `node scripts/test-cache-host-split.js`.
- Gate: `node scripts/test-codex-adapter.js` — synthetic fixture, no real transcript needed.
- **The Claude path is byte-identical** and must stay so; `preprocess.js` only changes its footer
  when `--original` is passed. Verify by diffing against `git show main:scripts/preprocess.js`.

### One repo, two hosts

This plugin ships to Claude Code AND Codex from this single tree — the pattern `ai-native-cowork`
established (read that repo before changing anything here). There is no separate Codex build and no
second copy of the scripts; a forked copy is exactly how the earlier Codex port froze at 1.7.0 while
this repo moved to 2.4.x.

Three manifests, **one version between them**:

| File | Read by |
|---|---|
| `.claude-plugin/plugin.json` | Claude Code |
| `.codex-plugin/plugin.json` | Codex |
| `manifest.json` | Codex marketplace listing |

The hook registries are host-specific. Claude Code auto-discovers `hooks/hooks.json`, which keeps
the prompt-cache, statusline, git-context, architecture, and compact-restoration hooks. Codex's
manifest points to `hooks/hooks-codex.json`, which injects `session-architecture-codex.md` and keeps
compact restoration without loading the three Claude Code-only hook contracts.

**The after-compact hook restores; it does not ask the model to.** It runs `scripts/restore.js` at
level 1 and injects the result as `additionalContext`. Do not turn it back into an instruction: an
earlier version said "there is no exception" and was skipped anyway on a real autonomous run, which
is what a declinable instruction is worth. `SessionStart(source=compact)` is the only event that
carries injected context on both hosts — Codex's `PostCompact` returns an outcome with no context
field, Claude Code's is absent from the union — so neither host may be moved to `PostCompact`.

**`scripts/restore.js` is the only implementation of the level slicing.** Both the skill and the
hook call it. It used to be an inline Python block inside `SKILL.md`, which the hook could only
copy, and the copy drifted. Never reinstate a second copy in either caller.

- **`s-continue`, `s-compact` and `usage-view` are dual-host.** `usage-view --host codex` reuses
  `scripts/lib/codex-transcript.js` for discovery/normalization and `scripts/lib/codex-usage.js` for
  the token-delta/rate-limit math, then renders through the **same** `build-report.js` →
  `skills/usage-view/template.html` pipeline Claude Code uses — Codex sessions land in the same cache
  tree and CSV shape (tagged `host: "codex"` in `summary.json`), so no second discovery path or
  template exists. `build-report.js` gates the handful of genuinely host-specific spots — cost math
  (`ratesFor()`, all-zero for Codex so `model-pricing.json`'s Anthropic rates never touch a Codex
  token count), the rate-limit window length (`WINDOW_SECONDS`, dynamic per Codex's own
  `rate_limits.primary.window_minutes` instead of the fixed 5h `FIVE_HOURS_S`), and plan resolution
  (`CODEX_PLAN_INFO`). `report-limit` and `setup-statusline` still read Claude Code's own
  billing/rate-limit records and stay single-host.
- **A dual-host skill must not hardcode one host's plugin root.** Claude Code exports
  `CLAUDE_PLUGIN_ROOT`; Codex does not reliably export `CODEX_PLUGIN_ROOT`. Use
  `PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-${CODEX_PLUGIN_ROOT}}"`, falling back to the skill's own
  directory. A bare `${CLAUDE_PLUGIN_ROOT}` resolves to nothing under Codex and the command silently
  runs against `/scripts/...`.
- **Gate**: `python3 scripts/test_product_parity.py` — skills set, manifest name/version agreement,
  the plugin-root rule, and the four exact install commands in every `README-CODEX.*`.
- **The other three skills are a backlog item, not a boundary** — `docs/CODEX-PORT-BACKLOG.md`
  records what Codex actually writes (`event_msg/token_count`, `rate_limits`) and the one
  assumption that has to break first: the 5-hour window is Claude Code's, and Codex reported a
  10080-minute one.
- **Codex publication needs the marketplace repo too**: `.agents/plugins/marketplace.json` plus a
  vendored copy under `plugins/<name>/` (Codex installs `source: local`, unlike Claude Code's git URL).

## No Build System

No npm dependencies. No package.json, no npm install, no build step. Scripts run directly with Node.js. The only third-party code is two pure-JS image codecs (pngjs, jpeg-js) vendored verbatim under `scripts/lib/vendor/` — they use Node built-ins only (`zlib`), so the "no install step" property holds; attribution is in `THIRD-PARTY-NOTICES.md`. Test by invoking skills in Claude Code.

## Before Any Release

A version bump touches 27 files across two repos (23 README locales, CHANGELOG, plugin.json, and
`marketplace.json` in the separate marketplace repo). **Read `docs/CONVENTION.md` §3 before
bumping** — it lists every surface with verification commands. Missing one ships a version
mismatch that no test catches.

## Critical Rules

### Hooks are latency-sensitive
- `cache-expiry-check.sh` runs on every user prompt (10s timeout). Must stay fast.
- `UserPromptSubmit` also fires for prompts CC enqueues itself (`<task-notification>` from background agents, `<tick>`, `<local-command-stdout>`). `cache-expiry-check.sh` exempts any prompt starting with `<` + a letter, before the flag/timestamp logic. Blocking one strands a subagent report — the notification is consumed off the queue. Match by shape, never by a tag list.
- All hooks receive JSON via stdin, output JSON decision to stdout.
- Hook stderr goes to user; stdout is parsed by CC. Never mix them.

### preprocess.js and analyze-usage.js parse transcripts independently
No cross-dependency between these two. Each reads JSONL from `~/.claude/projects/` on its own.

### Pricing lives in model-pricing.json
All model rates (input, cacheCreate5m, cacheCreate1h, cacheRead, output, contextWindow) in `scripts/model-pricing.json`. When a new model appears, add it there — `pricing.js` auto-resolves aliases and warns on unknown models via stderr.

### i18n
- Bash hooks: hardcoded `case` statements per locale (23 languages).
- JS dashboard: loads `locales/{xx}.json` via `resolveLocale()`.
- Charts/graphs/tables must remain LTR even for RTL locales (ar, he).
- Calendar tooltips are intentionally English-only.

### Plugin installation paths
- Source repo: this directory (editable).
- Plugin cache: `~/.claude/plugin-cache/super-token-saver/` (read-only, overwritten on `plugin install`). **Always edit source repo, never plugin cache.**
- Dev mode symlink may exist — check with `ls -la ~/.claude/plugin-cache/super-token-saver`.

### Skills execute via LLM instruction
Skills have no runtime code — `SKILL.md` files contain the full execution plan that Claude follows. The LLM is the runtime.

### Rate-limit burn analysis: read the doc, do not re-derive
Before any "5h/7d window consumption by model" or "is Fable cheaper on Max" analysis, read
`docs/RATE-LIMIT-BURN-METHOD.md`. It fixes the data sources (plugin cache only, never re-parse
JSONL), the 5-point interval cut, the joint NNLS, the confirmed per-model factors, and a known
`build-report.js` undercount (`--all` drops sessions that `cd` across worktrees). Extend that doc;
do not recompute from scratch.

### /usage-view runs as background agent
`/usage-view` launches a background Agent (SubTask) so the user can keep working. The agent runs `analyze-usage.js` → `build-report.js` → opens browser. Agent prompt is in `skills/usage-view/agent-prompt-template.txt`.

### /s-continue restores sessions at zero LLM cost
Reads preprocessed `compact.txt` directly — no summarization, no token expenditure. Topic matching (`/s-continue : topic`) loads only relevant sessions to save context size. `--current-source` names the host tool so `isCurrent` marks the running session rather than whichever transcript is newest.

## Key Constants

- Prompt cache TTL: 3600s (1 hour). Warning threshold: 3590s (10s buffer).
- SubTask cache: 5 min, $6.25/MTok write. Main session: 1 hour, $10/MTok write.
- Statusline turn idle timeout: 60s.
- Cache guard mode: `CC_TOKEN_SAVER_CACHE_GUARD` = `off` (default) | `warn` | `block`. Off by default because of Remote Control: a hook block is rendered locally and never reaches the remote client, so the guard behaved differently by seat; re-enable the default once Remote Control forwards hook messages. `warn` passes the prompt and attaches `additionalContext` so Claude's reply announces the expiry; it is the mode that works under Remote Control, where a hook block is a local `system/informational` message the remote client never receives (`bridge/bridgeMessaging.ts` `isEligibleBridgeMessage`).
- Gate flag (block mode only): `$TMPDIR/claude-cache-warn-{SESSION_ID}` (one-time block per idle period). Machine-injected prompts never touch it — the exemption runs first.

## File Relationships

```
skills/usage-view/SKILL.md
  → calls scripts/run-usage-view.js
    → calls scripts/analyze-usage.js (per-session JSONL → timeline.csv)
    → calls scripts/build-report.js  (timeline CSVs → HTML via template.html)

skills/s-continue/SKILL.md
  → calls scripts/list-sessions.js   (enumerate sessions, both sources)
    → calls scripts/lib/codex-transcript.js (Codex rollout → CC-shaped JSONL)
  → calls scripts/preprocess.js      (JSONL → compact.txt)

scripts/test_product_parity.py
  → gates the three manifests + Codex READMEs + the dual-host skill rules

scripts/test-session-project-map.js
  → gates build-report's session→project resolution (a session id can sit under many
    project dirs because statusline-logger writes ratelimit.csv per cwd; only the
    transcript's project has timeline.csv)

hooks/cache-expiry-check.sh
  → reads CC transcript JSONL directly (last assistant timestamp)

scripts/statusline-logger.sh
  → registered by /setup-statusline into user's settings.json
```
