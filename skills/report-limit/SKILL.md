---
name: report-limit
description: 'Report your 5h and weekly limit data (Claude Code or Codex) - we''re mapping how many tokens a limit is, which neither host publishes'
when_to_use: Use when the user wants to contribute rate-limit data, hit a limit or not. Triggers on "report limit", "limit report", "rate limit report".
host: dual
---

Dual-host. Detect the host you are running under:

- **Claude Code**: Claude Code does not state its 5h window, so the script rebuilds it from cached timelines and statusline samples. Ask the plan (below), then run with `--host claude`.
- **Codex**: Codex states each limit outright — used percent, window length, reset instant. The script pairs every recorded limit window with the tokens spent inside it. Do not ask the plan: Codex records it. Run with `--host codex`.
- Resolve `PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-${CODEX_PLUGIN_ROOT}}"`, falling back to two levels above this skill's directory if both are unset.

Report 5-hour and weekly limit windows to GitHub Discussions. Pure rule-based — no LLM reasoning needed.

## Help

**ONLY show help if the user's argument literally contains the word "help" (e.g. `/report-limit help`). If no argument or any other argument is given, SKIP this section entirely and proceed to execution.**

If the user provides "help" as argument, show usage summary and stop:

```
/report-limit — Report your rate limit data

Help map the unpublished rate-limit formula. This skill collects
your 5-hour windows from cached timeline data and opens a pre-filled
GitHub Discussion to ww-w-ai/super-token-saver — no rate limit needed.

No manual input needed. Just run it and confirm in your browser.

Options:
  (nothing)     Every 5h window of the last 7 days, limited or not
  <date>        Every 5h window on that date (e.g. /report-limit 2026-04-01)
  blocked       Only windows where you hit the limit, across all cached data
  help          Show this help

Examples:
  /report-limit              Last 7 days
  /report-limit 2026-04-01   All 5h windows on April 1st
  /report-limit blocked      Only the windows where you hit the limit
```

Do not run any analysis. Just display the help text and stop.

## Execution

**Claude Code only:** before running, ask the user's plan if not already known. The prompt message MUST be in the user's language (detect from conversation context). The table content (Plan names, prices) stays in English since they are proper nouns.

> Select your current Claude plan. The report will be generated based on your plan type.
>
> (Translate the above message naturally into the user's language.)
>
> | # | Plan | Price |
> |---|------|-------|
> | 1 | Pro | $20/mo |
> | 2 | Max 5x | $100/mo |
> | 3 | Max 20x | $200/mo |
> | 4 | Team Standard | $20/seat/mo |
> | 5 | Team Premium | $100/seat/mo |
> | 6 | Enterprise | custom |
> | 7 | Amazon Bedrock | usage-based |
> | 8 | Microsoft Foundry | usage-based |
> | 9 | Google Vertex AI | usage-based |
>
> Enter number or name (e.g. "3" or "max200"):

Map user input to `--plan` values: 1=pro, 2=max100, 3=max200, 4=team, 5=team_premium, 6=enterprise, 7=bedrock, 8=foundry, 9=vertex

Run the standalone script for your host (`--plan` on Claude Code only) and at most one of `--date` / `--blocked`:

```bash
node "${PLUGIN_ROOT}"/scripts/report-limit.js --host claude --plan <plan> [--date <YYYY-MM-DD> | --blocked]
node "${PLUGIN_ROOT}"/scripts/report-limit.js --host codex [--date <YYYY-MM-DD> | --blocked]
```

- No argument → every window of the last 7 days, limit hit or not.
- A date argument (e.g. `/report-limit 2026-04-01`) → pass `--date 2026-04-01`: every window overlapping that date.
- `blocked` (e.g. `/report-limit blocked`) → pass `--blocked`: only windows where the limit was hit (Codex: reached 100%), across all cached data.

Windows per host:
- Claude Code: 5h windows, rebuilt from the cache.
- Codex: every limit lane Codex reports (e.g. `codex primary`, 7 days), as Codex reports it. A window reset early ends where the next one starts. A lane that stayed at 0% is left out.

If the user doesn't know or skips plan on Claude Code, run without `--plan` (reports as "unknown").

With two or more login accounts on record, one report covers them all, split by account: each account has its own windows, rows, and files. Accounts appear as `Account 1` (the current login), `Account 2`, … — never as hashes. `--plan` describes Account 1.

### Unknown model handling (Claude Code only; run inline, do NOT stop the skill)

The script fails with exit code 2 and prints an `ERROR:UNKNOWN_MODEL` block to stderr when it encounters a model not registered in `scripts/model-pricing.json`. Handle it inline, then continue:

1. Parse the `models:` line from stderr to extract the list of unregistered model names.
2. WebFetch `https://platform.claude.com/docs/en/about-claude/pricing#model-pricing` and confirm each model's `input` / `output` / `cacheCreate5m` / `cacheCreate1h` / `cacheRead` / `contextWindow`.
3. **If all 6 fields are confirmed**: Read `scripts/model-pricing.json`, then add each model with one Edit per model in the same format as existing entries `{ "input": N, "cacheCreate5m": N, "cacheCreate1h": N, "cacheRead": N, "output": N, "contextWindow": N }`. Do not use guessed or derived values.
4. **If any field cannot be confirmed on the page**: Do not fill the JSON arbitrarily — stop the skill and show the user the message below.
   ```
   ⚠️ Cannot confirm the full pricing (especially the 5m/1h cache tiers) for unregistered model {model} on the official page.
   Please update the plugin to the latest version:
     /plugin update super-token-saver
   If the problem persists after updating, please report it at https://github.com/ww-w-ai/super-token-saver/issues
   ```
5. (After step 3 succeeds) Re-run the same Bash command as-is. Thanks to fail-fast there is no stale cache, so `--force` is unnecessary.
6. Once the re-run succeeds, proceed to the summary output step below.

The script outputs JSON to stdout. Parse the result and show the user a brief summary:

```
💀 Found {N} window(s).

| Account | Window | Cost | Requests |
|---------|--------|------|----------|
| {account or "-"} | {date} {start}-{end} | ${cost} | {n} |

(Codex: add Limit (`limitId lane`) and Used % (`usedFirst → usedLast`) columns; Window is start → activeEnd; Cost is N/A — Codex has no per-token price.)

{If gistUrl: "📎 Data uploaded: {gistUrl}"}
{If no gistUrl: "⚠️ GitHub CLI not authenticated. Run `gh auth login` first, or manually attach the zip file."}
{If zipFile: "📎 Zip ready: {zipFile}"}

Discussion opened in browser. Review and submit.
```

## Error Handling

- If the script exits with code 1: "No cached data found. Run `/usage-view` first."
- If the script exits with code 2: stderr contains `ERROR:UNKNOWN_MODEL`. Handle it inline via the "Unknown model handling" procedure above — do NOT treat as a fatal failure.
- If the script exits with code 0 and prints no JSON: "No windows found." (`blocked`: "No rate-limited windows found.")

## Prerequisites

- GitHub Discussion category "Rate Limits" must exist on ww-w-ai/super-token-saver
- `gh` CLI authenticated for gist upload (optional — falls back to local files)
