---
name: report-limit
description: 'Max plan hit the wall? Report your 5h window data - we''re mapping the rate limit formula that is not published anywhere'
when_to_use: Use when user hits a rate limit and wants to contribute data. Triggers on "report limit", "limit report", "rate limit report".
host: claude-code
---

> Claude Code only **today**. Codex reports its rate limits directly (`rate_limits.primary.used_percent`, `resets_at`), so this is a port that has not been done yet, not a limitation — see `docs/CODEX-PORT-BACKLOG.md`.

Report rate-limited 5-hour windows to GitHub Discussions. Pure rule-based — no LLM reasoning needed.

## Help

**ONLY show help if the user's argument literally contains the word "help" (e.g. `/report-limit help`). If no argument or any other argument is given, SKIP this section entirely and proceed to execution.**

If the user provides "help" as argument, show usage summary and stop:

```
/report-limit — Report your rate limit data

Got rate limited? This skill automatically finds your blocked
5-hour windows from cached timeline data and opens a pre-filled
GitHub Discussion to ww-w-ai/super-token-saver.

No manual input needed. Just run it and confirm in your browser.

Options:
  (nothing)     Auto-detect and report all rate-limited windows
  <date>        Report a specific date (e.g. /report-limit 2026-04-01)
  help          Show this help

Examples:
  /report-limit              Report all rate-limited windows
  /report-limit 2026-04-01   Report all 5h windows on April 1st
```

Do not run any analysis. Just display the help text and stop.

## Execution

Before running, ask the user's plan if not already known. The prompt message MUST be in the user's language (detect from conversation context). The table content (Plan names, prices) stays in English since they are proper nouns.

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

Run the standalone script with `--plan` and optionally `--date`:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/report-limit.js --plan <plan> [--date <YYYY-MM-DD>]
```

If the user provided a date argument (e.g. `/report-limit 2026-04-01`), pass it as `--date 2026-04-01`. This reports ALL 5h windows for that date, not just rate-limited ones.

If the user doesn't know or skips plan, run without `--plan` (reports as "unknown").

### Unknown model handling (run inline, do NOT stop the skill)

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
💀 Found {N} rate-limited window(s).

| Window | Cost | Requests |
|--------|------|----------|
| {date} {start}-{end} | ${cost} | {n} |

{If gistUrl: "📎 Data uploaded: {gistUrl}"}
{If no gistUrl: "⚠️ GitHub CLI not authenticated. Run `gh auth login` first, or manually attach the zip file."}
{If zipFile: "📎 Zip ready: {zipFile}"}

Discussion opened in browser. Review and submit.
```

## Error Handling

- If the script exits with code 1: "No cached data found. Run `/usage-view` first."
- If the script exits with code 2: stderr contains `ERROR:UNKNOWN_MODEL`. Handle it inline via the "Unknown model handling" procedure above — do NOT treat as a fatal failure.
- If the script exits with code 0 but `windows` is empty: "No rate-limited windows found."

## Prerequisites

- GitHub Discussion category "Rate Limits" must exist on ww-w-ai/super-token-saver
- `gh` CLI authenticated for gist upload (optional — falls back to local files)
