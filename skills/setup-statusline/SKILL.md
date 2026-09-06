---
name: setup-statusline
description: 'Live token counter in your CLI. Shows real-time input/output/cache token counts in the Claude Code status bar'
when_to_use: Use when user wants to install, uninstall, or configure the token-saver statusline. Triggers on "setup statusline", "install statusline", "statusline install".
host: claude-code
---

> Claude Code only. Codex has its OWN status line, configured through `status_line` in `config.toml` from a fixed set of named segments rather than a command — see `docs/CODEX-PORT-BACKLOG.md`.

Manage the super-token-saver statusline in Claude Code's `~/.claude/settings.json`.

## Help

**ONLY show help if the user's argument literally contains the word "help" (e.g. `/setup-statusline help`). If no argument or any other argument is given, SKIP this section entirely and proceed to Step 1.**

If the user provides "help" as argument, show usage summary and stop:

```
/setup-statusline — Install or uninstall the live usage monitor

Format:
  [RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [W🟡] 65% ⏳1d3h | [CTX🟢] 22%
  ─────   last / total     5h window usage    weekly (≥60% only)  context window
                           (subscribers only)

Options:
  install       Register statusline (default)
  uninstall     Remove and restore previous config
  help          Show this help

Examples:
  /setup-statusline install
  /setup-statusline uninstall
```

Do not modify any settings. Just display the help text and stop.

## Args

- `install` (default if no arg) — register the statusline script
- `uninstall` — remove and restore backup if available

## Install Flow

1. Read `~/.claude/settings.json`
2. Check current `statusLine` field:

   **Case A: No statusLine** — install directly.

   **Case B: Already our script** — check if path matches current `${CLAUDE_PLUGIN_ROOT}`.
   If version differs, update path silently, then print "Updated to current version." and stop.
   If same version, print "Already installed." and stop.
   Check by matching the command path containing `super-token-saver/scripts/statusline-logger.sh`.

   **Case C: Different statusLine exists** — warn and ask the user:
   ```
   ⚠️ Existing statusline detected:
     command: {existing command}

   Options:
   1. Replace (backup existing to _statusLineBackup)
   2. Cancel

   Which? (1/2)
   ```
   Wait for user response. If "1", backup to `_statusLineBackup` then install. If "2", stop.

3. Install: set `statusLine` to:
   ```json
   {
     "type": "command",
     "command": "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-logger.sh"
   }
   ```

4. Verify the script is executable:
   ```bash
   chmod +x "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-logger.sh"
   ```

5. Output:
   ```
   ✅ Statusline installed.
   It will appear after your next interaction with Claude.

   Subscriber format:
     [RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [W🟡] 65% ⏳1d3h | [CTX🟢] 22%

   API key format:
     [RUN🟢] $0.10/$12.23 | [CTX🟢] 22%

   Fields:
   - [RUN]  $0.10/$12.23 — **Current user turn cost** / cumulative cost since `claude` started.
                        The turn cost accumulates across follow-up tool calls so a $1.43 warning
                        stays visible until you start a new prompt. A new turn is detected when
                        no API call happens for 60 seconds (tunable via
                        `CC_UPGRADER_TURN_IDLE_SEC`). Resets when you exit and restart claude.
   - [5H]  9% ⏳1h32m — Anthropic 5-hour rate limit usage (subscribers only).
                        ⏳ shows time until the window resets.
   - [W]   65% ⏳1d3h — 7-day weekly rate limit. Only shown when ≥60%.
                        ⏳ shows time until the weekly window resets.
   - [CTX] 22%         — Context window usage. Higher = more tokens per call.

   Color thresholds:
   | Indicator | 🟢 Normal | 🟡 Warning | 🔴 Critical |
   |-----------|-----------|------------|-------------|
   | RUN       | < $0.30  | ≥ $0.30   | ≥ $1.00   |
   | 5H        | < 70%     | ≥ 70%      | ≥ 90%      |
   | W         | (hidden)  | ≥ 60%      | ≥ 90%      |
   | CTX       | < 35%     | ≥ 35%      | ≥ 70%      |

   When 5H reaches 🔴, → /report-limit hint appears.
   Other warnings show → /usage-view current for detailed analysis.

   To remove: /setup-statusline uninstall
   ```

## Uninstall Flow

1. Read `~/.claude/settings.json`
2. Check current `statusLine`:

   **Not our script** — print "super-token-saver statusline is not installed." and stop.

   **Our script** — remove `statusLine` field. If `_statusLineBackup` exists, restore it to `statusLine` and delete `_statusLineBackup`.

3. Output:
   ```
   ✅ Statusline removed.
   {If restored: "Previous statusline restored from backup."}
   {If no backup: "No previous statusline to restore."}
   ```

## Important

- Always use `node -e` for JSON manipulation (safe parsing, no jq dependency).
- Never modify fields other than `statusLine` and `_statusLineBackup`.
- The script path must use `${CLAUDE_PLUGIN_ROOT}` to stay portable.
