# super-token-saver

**The only Claude Code plugin that reads CC's source to find where your tokens go, then plugs the leaks automatically. Spend less. Code longer.**

> Measured: a real $326/day workload dropped to **$180/day, a 45% cut.** Automatic SubTask delegation, zero-cost context restoration, a full analytics dashboard, and a guard for cache expiry. One install, zero config.

Works on **Max Plan ($200/mo)** and **API pay-per-use**. Same plugin, same features. It matters more on pay-per-use, where there is no monthly buffer and every leaked token lands on the invoice.

![Usage dashboard — see exactly where your tokens go](docs/images/usage-view-overview.png)

### What it does in 30 seconds

| Feature | What happens | Impact |
| ------- | ------------ | ------ |
| 🧠 Session Architect | Hands heavy work to SubTasks (37.5% cheaper cache) and bundles tool calls to cut round-trips | Smaller context, fewer round-trips, lower bills |
| 🪶 Concise Mode | Trims the padding from responses and keeps the substance | Fewer output tokens per reply |
| 🔄 /s-continue | Replaces /compact. Zero LLM calls, zero cost, zero information loss. Restores **Codex** sessions too | Free context restoration in both tools |
| 🤝 /s-compact | Writes a handoff that /s-continue loads automatically, including subagent findings and tool results the transcript never keeps | The next session inherits the hidden context |
| 📊 Status Line | Live cost, context size, and rate limit, under 50ms | See trouble before it costs you |
| 📈 /usage-view | Interactive HTML dashboard with AI analysis | Full cost forensics in one click |
| ✂️ /setup-git-lite | Removes the 2,200 hidden tokens CC injects every session | About $48/mo saved on git instructions alone |
| 🛡️ Token Guardian | Warns you the moment a cache expiry re-sends your context, or blocks it in `block` mode | No more silent $9 surprises |

---

## 😤 The Problem

**Invisible costs.** There's no live view of what you're spending. No "your context is at 800K" warning, no "cache expired 3 minutes ago" alert. You find out after the money is gone.

**Context bloat.** The same prompt costs 4x more at 800K context than at 200K. Every Read, Grep, and Edit re-sends the whole context. One complex prompt can fire 15+ API calls, and each one is multiplied by your context size.

**Cache expiry.** You come back from lunch and the cache is gone. Your next prompt re-sends 900K tokens at full price. That's $9 in one shot.

**All of it manual.** Context management, cache timing, SubTask delegation, session cleanup. Nobody can keep track of all that while actually writing code.

**On Max Plan ($200/mo)?** Add a 5-hour rate limit that stops your work with no timer and no ETA.

**On API pay-per-use?** Add the fact that there is no ceiling. One cache miss is $9 of real money. Ten a week is $360/mo on accidents alone. One bad Tuesday with a bloated context can cost more than a Max Plan subscriber pays in a month.

super-token-saver handles all of it for you. **Install once. Done.**

---

## 🚀 Installation

```
/plugin marketplace add ww-w-ai/marketplace
/plugin install super-token-saver@ww-w-ai
```

It works as soon as it's installed. Nothing to configure. Requires [Claude Code](https://claude.ai/claude-code) v2.1.71 or later.

For live monitoring:

```
/setup-statusline install
```

To remove the 2,200 hidden tokens in CC's built-in git instructions ([details](#%EF%B8%8F-feature-4-setup-git-lite--trim-ccs-built-in-git-instructions)):

```
/setup-git-lite install
```

---

## 🧠 Feature 1: Smart Session Architecture

**Install it and the cheaper way of working switches on by itself.**

Most people do everything in the Main session: file reads, code generation, test runs. Every output piles into the context and gets re-sent with every message. The session gets heavy and the bill grows with it.

Session Architect injects two cost strategies when a session starts.

**1. SubTask delegation.** Heavy work runs in SubTasks, which have a smaller context and a cheaper cache tier.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Role             | Design, decisions, review         | Implementation, code gen, multi-file  |
| Cache tier       | 1 hour (ephemeral_1h)             | 5 min                                 |
| Cache write cost | ＄10/MTok                          | ＄6.25/MTok                            |
| Context size     | ~94K avg                          | ~33K avg                              |

**2. Fewer round-trips.** Total cost is context size times round-trips, and every round-trip re-reads the whole conversation. Five sequential tool calls on a 50K context cost 250K cache-read tokens. Bundle them into two round-trips and it's 100K: **60% saved, same output.** The injected rules make Claude bundle independent tool calls, plan the batch first, stop early once it has the answer, and let SubTasks absorb their own round-trips.

**Result:** context stays under 250K instead of growing past 600K, round-trips drop, and the same work comes out cheaper. Fully automatic.

---

## 🪶 Concise Mode

**Same substance, less padding. On by default.**

The SessionStart hook injects response-style rules into **every session and every model**, with no flags and no setup. Three things change.

- **No preamble.** No "Let me take a look…", no restating your question, no summary of what the diff already shows.
- **Length matches the job.** A yes/no gets a sentence or two. A status update gets a few. An architecture or debugging answer runs as long as it needs to. Bullets for lists, prose for reasoning.
- **Only what moves your next decision.** Essential context plus the actual choices. Things you'd already infer are cut. Things that explain *why* stay.

The line is clear: no dropping content, no skipping verification, no flattening nuance into one sentence. The substance stays; only the wrapping shrinks.

Install once, applies everywhere.

---

## 🔄 Feature 2: /s-continue — Context Restoration

**Replaces `/compact`. Zero LLM calls. Zero token cost. Zero information loss.**

`/compact` sends your whole context (~1M tokens) to the LLM and compresses it into a summary 3.3% the size. If the cache has already expired, that one call triggers a full re-cache. Losing information is unavoidable.

`/s-continue` works differently. It preprocesses the previous session's transcript and loads it directly. No LLM call, no cost. The original conversation comes back as it was.

|                         | /compact                          | /s-continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| How it works            | Sends full context to LLM for summary | Preprocesses transcript, reads directly |
| LLM calls               | Required (typically 100K+ tokens) | 0                                |
| Token cost              | High                              | 0                                |
| Information loss        | Yes (3.3% summary)                | None (original preserved)        |
| Processing speed        | Tens of seconds                   | < 1 sec (even 60MB+ files)       |
| When cache is expired   | Full re-cache cost on top         | No impact                        |
| Multi-session restore   | Not possible                      | Supported                        |

Usage: `/clear`, then `/s-continue`. You get a list of previous sessions. Pick one. For the quick path: `/s-continue last`.

**Result:** pick up where you left off for free, with nothing lost. A 60MB+ transcript is processed in under a second.

### 🤝 Its pair: `/s-compact` — hand off the hidden layer

`/s-continue` restores the transcript, meaning what you and Claude said. But the most useful knowledge from a working session often lives outside that dialogue: what a subagent found (its transcript is a separate file the restore never loads), a decisive number in a tool output (a test count, a benchmark), a lesson from the process ("couldn't reproduce headless, and it turned out to be the build, not the code").

Run `/s-compact` at the end of a session and it distills exactly that hidden layer into a handoff, saved to `~/.claude/super-token-saver-data/<project>/handoff.md`. Next session, `/s-continue` loads it automatically on top of the restored transcript. Nothing to paste.

|                     | `/s-continue` alone            | `/s-compact` + `/s-continue` (the set)          |
| ------------------- | ------------------------------- | ------------------------------------------------ |
| Recovers            | The transcript (what was said)  | The transcript plus the hidden layer             |
| Subagent findings   | Lost (separate files)           | Distilled into the handoff                       |
| Tool-output numbers | Only if quoted into the chat    | Extracted deliberately                           |
| Process lessons     | —                               | Captured so dead ends aren't re-run              |

**The workflow:** end a session with `/s-compact`, start the next with `/s-continue`.

### 🔀 Start in Claude Code, continue in Codex, come back

Claude Code and Codex can't read each other's history. One writes to `~/.claude/projects/`, the other to `~/.codex/sessions/`. `/s-continue` reads both, and the handoff file `/s-compact` writes is shared per project. So a sprint you started in Claude Code can continue in Codex and return to Claude Code with nothing lost. When one side runs out of budget, the other picks up from the same line. **No other plugin restores both tools' history.**

It's fast, too. A Codex rollout isn't run through a second parser. It's rewritten into the shape Claude Code already writes, **line for line**, so one pipeline serves both and every `L{n}` marker still points at the exact line in the original Codex file. A 12 MB, 1,540-line rollout takes **0.13 s**.

**Auto-compact doesn't break the conversation either.** When Claude Code compacts on its own, the after-compact hook pulls the pre-compact turns (yours and Claude's) back out of the transcript and re-injects them before you type anything. Original text, not a summary, with no gap. Codex compaction and thread rollback are restored the same way.

|                        | Claude Code session | Codex session |
| ---------------------- | ------------------- | ------------- |
| Listed by `/s-continue` | Yes | Yes, scoped to the current project |
| Restored at zero LLM cost | Yes | Yes |
| `L{n}` seek into the original | Yes | Yes — line numbers are the rollout's own |
| Context-loss (`#0`) restore | `/compact`, auto-compact | Codex compaction and thread rollback |
| `/s-compact` handoff | Shared per project — write it in one tool, load it in the other |

```
/s-continue codex                    only Codex sessions
/s-continue codex : rust migration   the turns matching a topic, restored in full
```

Two details separate a correct list from a plausible-looking wrong one. First, Codex's `session_id` is the **thread** id, and a spawned subagent inherits it, so sessions are keyed on `payload.id` and subagent rollouts are filtered out the same way Claude Code's subtask transcripts already are. Second, `<codex_internal_context source="goal">` is machine-injected, so it stays in the restored context but is never counted as a turn you typed.

The plugin installs into Codex as well. See **[README-CODEX.md](./README-CODEX.md)** ([한국어](./README-CODEX.ko.md) · [日本語](./README-CODEX.ja.md) · [简体中文](./README-CODEX.zh-Hans.md)). `usage-view` reads Codex sessions too and reports their cost as a purchased-credit equivalent. `report-limit` and `setup-statusline` are still Claude Code only.

---

## 📊 Feature 3: Live Status Line

**Live token and cost monitoring. Under 50ms overhead.**

Run `/setup-statusline install` once and a status bar stays pinned to the bottom of Claude Code.

**Normal operation.** Every metric at a glance, no switching windows.

![Status line in normal state](docs/images/statusline-normal.png)

**Rate limit hit.** 5H turns red at 102%, the countdown shows exactly when you're back, and a one-tap `/report-limit` action appears on its own.

![Status line when rate limited](docs/images/statusline-rate-limited.png)

| Indicator        | What it shows                       | 🟢 Normal | 🟡 Warning | 🔴 Critical |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | Cost of the last API call           | < ＄0.30   | >= ＄0.30   | >= ＄1.00    |
| RUN (cumulative) | Cumulative cost for this folder     | —         | —          | —           |
| 5H               | 5-hour window usage + reset countdown | < 70%     | >= 70%     | >= 90%      |
| CTX              | Context window usage                | < 35%     | >= 35%     | >= 70%      |

When any indicator reaches warning or critical, a `→ /usage-view current` hint appears automatically.

To remove it: `/setup-statusline uninstall`. Your previous config comes back on its own.

**Result:** every cost problem is visible as it happens. Under 50ms overhead, so you won't feel it.

> **On pay-per-use?** The 5H and W indicators hide themselves, since you have no rate-limit windows. What's left is what matters: RUN (live cost per turn) and CTX (context size). The two levers that decide your bill, always in view.

---

## 📈 Usage Dashboard (/usage-view)

**Finally, an answer to "where did all that money go?"**

Max Plan users hit the rate limit and wonder why. API users open the Anthropic invoice and wonder how. Either way the questions are the same. Which session burned the most tokens? When did costs spike? What does my usage pattern look like? Until now, none of it was visible.

`/usage-view` shows all of it. An interactive HTML dashboard opens in your browser, so you can study your usage patterns and trace a cost spike back to its cause. No external dependencies. Runs on its own. Shareable as a single file.

**$4,196 in 31 days. Where did it go?** One glance gives you total cost, tokens by type, cache efficiency, and session count. The donut chart shows right away that 65% of the spend is cache reads, which is normal and healthy.

![Usage dashboard overview](docs/images/usage-view-overview.png)

**Before and after, measured rather than guessed.** The orange dashed "Plugin installed" marker splits the cost timeline in two. Daily bars are stacked by token type (Input/Output/Cache Write/Cache Read), so you can see exactly which part changed after install. The average line shows the trend.

![Daily cost trend](docs/images/usage-view-daily-trend.png)

**When do you burn the most?** Cost by hour of day and by day of week. Switch between active-day average, all-day average, and max. Fire icons mark your most expensive hours, so patterns like late-night binges or Wednesday spikes stand out immediately.

![Hourly and day-of-week cost pattern](docs/images/usage-view-hourly-pattern.png)

**Are you getting more efficient?** The Total/Output ratio measures how many tokens it takes to produce one output token. Lower is better. The "Plugin installed" marker lets you compare before and after. A spike means a cache miss or a session restart.

![Efficiency trend](docs/images/usage-view-efficiency.png)

**Every API call, plotted by context size and cost.** This is the chart that makes the cost structure click. Each dot is one API call. Red is Opus, blue is Sonnet, green is Haiku. The dashed lines are the theoretical price; dots above the line mean you're overpaying. Switch to the **User Turn** view to see cost per conversation turn instead of per API call.
Hover any dot for the actual prompt text, the token count, and the full cost breakdown (Input/Output/Cache Write/Cache Read).

![Cost by Context Size — scatter chart](docs/images/usage-view-cost-scatter.png)

**How big are your contexts?** Most calls cluster under 250K. The long tail above 350K is where costs explode. This chart shows exactly how often you're in that zone.

![Context Size Distribution](docs/images/usage-view-context-dist.png)

**Your coding schedule, priced by the hour.** A heatmap of 5-hour windows across 30 days. Green is under $15/h, orange is $15-30/h, red is $30+/h. The skull icon (💀) marks windows where you hit the rate limit. The cost slider at the top hides the cheap windows so the expensive ones stand out. Drag it to find your worst days. Switch between 5-hour windows and 1-hour blocks.

![Hourly usage calendar heatmap](docs/images/usage-view-calendar.png)

**Click any cell to open that window's sessions.** Every session in that slot, with cost, message count, token breakdown, and the actual first and last messages of each conversation. Expand "Top Token Conversations" to see which exchanges burned the most. Each entry shows the prompt text, cost alert tags, and optimization hints.

![Session detail panel](docs/images/usage-view-session-drilldown.png)

**AI analysis (optional).** Run `/usage-view` without `--no-ai` and an AI analyst reads the full dashboard data, with the API price list built in, and writes a report: what drove the cost, what looks off, and what to change. It's shown in your OS language (23 languages, RTL included; charts and tables always stay LTR).

**Where the money went.** Total spend, cost drivers by token type, the weekly trend, and the plugin's effect measured in real numbers:

![AI analysis — cost breakdown](docs/images/usage-view-ai-report-1.png)

**When and how you work.** Peak hours, busiest days, API call distribution, and the rate-limit patterns that show where the slack is:

![AI analysis — work patterns](docs/images/usage-view-ai-report-2.png)

**What to do about it.** Concrete recommendations based on your actual usage. Model switching, context management, session strategy:

![AI analysis — recommendations](docs/images/usage-view-ai-report-3.png)

**Share it.** The whole dashboard is one self-contained HTML file. All the data is embedded, so there's no server. Send it to your team, your manager, or your accountant. No external dependencies, works offline. Use `private` mode to strip the prompt text before sharing. The cost analytics stay, the conversation content goes.

```
/usage-view                  # All time, all projects
/usage-view current          # Current 5-hour window only
/usage-view last 7 days      # Last 7 days
/usage-view locale ja        # Japanese
/usage-view --no-ai          # Skip AI analysis (faster)
/usage-view private          # Strip prompt text (safe to share)
```

---

## 🔬 Rate Limit Research (/report-limit)

**A community project to reverse-engineer the rate-limit formula.**

Anthropic doesn't publish the exact formula for the 5-hour window. Let's work it out together.

When you hit a rate limit, run `/report-limit`. Your current usage data is submitted as a GitHub Discussion automatically. The more data we collect, the clearer the formula gets.

---

## ✂️ Feature 4: /setup-git-lite — Trim CC's Built-in Git Instructions

**We read Claude Code's source. We found 2,200 tokens slipped into every session that you were paying for without knowing.**

### The discovery

On 2026-04-12, a [GitHub issue](https://github.com/anthropics/claude-code/issues/47107) showed that Claude Code's built-in `includeGitInstructions` setting burns tokens every session. We reproduced it independently with [this gist by spilist](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) and confirmed the numbers: **+6,031 tokens of cache writes** per session after each git commit, and **+1,690 tokens of cache reads** on every API call.

### CC source analysis — where the tokens go

We traced the tokens to two separate injection points in the Claude Code source (v2.1.88).

**1. The `gitStatus` snapshot (~500 tok), in the system prompt**
- `getGitStatus()` in `context.ts:36-111` collects the branch, the main branch, user.name, the full status (up to 2000 chars), and the **5 most recent commits**
- It's appended to the system prompt through `appendSystemContext` (`utils/api.ts:437`)
- Every new commit, every newly modified file, every branch switch changes the text and invalidates the prefix cache

**2. The commit/PR workflow instructions (~1,700 tok), in the Bash tool description**
- `tools/BashTool/prompt.ts:53` appends 60+ lines of safety protocol, a step-by-step commit procedure, HEREDOC examples, and PR creation templates to the `Bash` tool's description
- It's cached alongside the system prompt but shipped in the `tools[]` parameter

### Why it's expensive

The cache structure (`splitSysPromptPrefix` in `utils/api.ts:321`) takes one of three paths depending on whether you have MCP tools active.

- **Path A** (MCP active, which is most users): `gitStatus` sits inside a `cacheScope: 'org'` block. Any change re-caches the whole block on the next session start. That's a 6K-token `cache_create` miss.
- **Path B** (no MCP): `gitStatus` moves to a `cacheScope: null` dynamic block, so it's re-sent as fresh `input_tokens` on every API call. No cache miss, but no cache savings either.
- **Path C** (third-party provider, or experimental betas off): same as Path A.

In a typical interactive session, the commit/PR instructions (1.7K tok) are billed as `cache_read` **on every API call**. Over a 100-call session at Opus 4.7 pricing, that's roughly **$0.08 per session** for instructions Claude's training already covers.

### How super-token-saver handles it

`/setup-git-lite` turns off the native path and injects a **curated 280-token replacement** through a SessionStart hook. We kept only what overrides Claude's default behavior (the safety rules) and dropped everything Claude already knows from training (step-by-step workflows, PR templates, gh usage).

**Kept: 11 critical override rules** (the ones that turn Claude's default helpfulness into caution):
- Never commit/push/amend/PR/tag/merge without an explicit user request
- Never skip hooks, force-push to main/master, run destructive ops, or modify git config
- Never commit files matching `.env`, `credentials`, `*.pem`, `secret.*`
- Avoid `git add -A` / `git add .`
- HEREDOC for multi-line commit messages, plus the `Co-Authored-By: Claude` trailer
- No interactive flags (-i), no empty commits
- If a pre-commit hook fails, create a new commit (not `--amend`)

**Dropped:** the step-by-step commit workflow (3 steps), the step-by-step PR workflow (3 steps), the PR title/body template, `gh` command references, the `-uall` flag warning, the `--no-edit` with rebase warning, and the `NEVER use TodoWrite or Agent tools during commit` constraint. These are procedure details Claude gets right from training alone.

**Added:** a compact git state line with the branch, HEAD short-sha and subject, and the current status (up to 20 modified files, otherwise a count). No recent-commits list, since Claude can run `git log` when it needs one.

### Expected savings (Opus 4.7 pricing, $25/MTok output, $5/MTok input, $0.50/MTok cache read)

| Item | Original | With setup-git-lite | Saved |
| ---- | -------- | ------------------- | ----- |
| System prompt load (per new session) | ~2,200 tok cache_create | ~280 tok cache_create | ~1,920 tok |
| Repeat calls in same session | ~1,700 tok cache_read/call | ~280 tok cache_read/call | ~1,420 tok/call |
| 100-call session (Opus 4.7) | — | — | **~$0.11 saved** |
| 20 sessions/day × 22 workdays | — | — | **~$48 saved/month** |

### Usage

```bash
/setup-git-lite status     # Read-only diagnostic — current state + what would change
/setup-git-lite install    # Disable CC native + enable our minimal hook
/setup-git-lite revert     # Restore default (aggressive; see below)
/setup-git-lite dismiss-banner    # Silence the occasional recommendation tip
/setup-git-lite undismiss-banner  # Re-enable the tip
/setup-git-lite help       # Full usage
```

### Install semantics

`install` changes **two** places, to be safe.

1. `~/.claude/settings.json` gets `"includeGitInstructions": false`
2. Your shell profile (`~/.zshrc`, `~/.bashrc`, etc.) gets a marker block exporting `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

Either one alone disables CC native. We set both so an environment override can't quietly turn the native behavior back on. The shell change applies to new shells only.

### Revert semantics — aggressive

`revert` **removes every `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` export from your shell profile**, including any you added by hand before installing this skill. That's deliberate: you ran `revert`, so you get the clean default back. A timestamped backup of the shell profile is always made first.

If you need that variable for something else, note it down before running `revert` and add it back afterwards.

### Before uninstalling super-token-saver

**Run `/setup-git-lite revert` first.** Otherwise you're left with `includeGitInstructions: false` in settings.json and no replacement hook, so Claude gets no git guidance at all. Claude Code has no plugin-uninstall hook yet, so we can't do this for you.

### Trade-offs

What you give up, and why it's usually fine:
- Claude no longer gets a precomputed `git status` / `git log -n 5` at session start. Ask "what's changed?" in a new session and Claude runs those commands itself. One extra tool call, about 300 tokens.
- Claude no longer sees CC's canonical 3-step commit procedure. Across hundreds of commit flows in our testing, training-level knowledge handled it, because the parts that matter (HEREDOC formatting, no `--amend`, no force-push) are kept as explicit rules.
- The PR body template (`## Summary` + `## Test plan`) isn't injected. If you want exactly that format, put it in your project's CLAUDE.md.

### Recommendation banner

While CC's native git instructions are still active on your machine, super-token-saver shows a one-paragraph tip at session start **about 20% of the time** (and in `/usage-view` and `/report-limit` output). Dismiss it for good with `/setup-git-lite dismiss-banner`.

---

## 🛡️ Feature 5: Token Guardian

**Tells you the moment a cache expiry costs you. Can block the $9 re-send if you ask it to.**

Claude Code's prompt cache lives for 1 hour. Step away longer than that and it expires. Your next message re-sends the entire context at full price. At 900K tokens, that's $9 in one shot.

Token Guardian remembers when the last reply arrived. If more than 3,590 seconds have passed (the TTL minus a 10-second buffer), it can step in. **It is off by default, because of Remote Control.** A hook's block message is rendered locally as a system message the remote client never receives, so a remote user saw the prompt vanish with no explanation. Rather than ship a guard that behaves differently depending on where you sit, we turned it off. When Remote Control starts forwarding hook messages, the default comes back on. Until then, turn it on yourself with one of two modes.

```
export CC_TOKEN_SAVER_CACHE_GUARD=warn    # Claude mentions the expiry in its first line
export CC_TOKEN_SAVER_CACHE_GUARD=block   # the prompt is refused once with the message below
```

In `warn` the prompt goes through, and Claude opens its reply with one line saying the cache had expired, this turn paid for the whole context, and after a break of an hour or more `/clear` → `/s-continue` is the cheaper way back. This one does reach a remote client, because Claude's reply is forwarded even though hook messages are not.

In `block` the prompt is refused once with the message below. Send it again and it goes through. Use it in a local terminal when you want the hard stop.

```
🚨 Cache expired (68m 23s idle)

The prompt cache has expired. Continuing will resend the full context.
Cost may increase significantly.

👉 /context — Check current context usage before deciding
👉 /clear → /s-continue — Reset, then restore previous context (recommended, cheapest)
👉 Re-send — Continue as-is (full re-cache cost incurred)
```

The block message is shown in 23 languages, picked from your OS locale, and fires once per idle period.

**Background agents are never blocked.** Only prompts a human typed get the check. Completion reports from background agents and tasks, which these days often arrive more than an hour after launch, pass straight through. A long-running agent's result is never held up or lost.

**Result:** in warn mode you always know when a $9 re-send happened, and why. In block mode it doesn't happen: every expiry caught saves $9, and at one a day that's $270/mo of pure waste gone.

> **On pay-per-use this hits harder.** A Max Plan subscriber loses $9 inside a $200 buffer. You lose $9 of real money, quietly, every time you step away. Block mode stops it every time.

---

## 💡 How Cache Actually Works (And Why Most Users Waste 40%+ on It)

Claude Code sends the entire conversation history to the model on every API call. And "API call" doesn't mean "one message you typed." A single prompt triggers internal tool calls (Grep, Read, Edit, Write), and each of those is its own API call. One prompt easily turns into 10+ API calls.

Prompt caching cuts that cost by 90%. But the cache has a lifespan.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 hour (ephemeral_1h)                 | 5 min                                  |
| Cache write         | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache read          | ＄0.50/MTok                            | ＄0.50/MTok                             |
| When cache expires  | Full context re-sent at full price    | Low impact (context is small)          |

Even with the cache alive, costs add up. Here's an extreme scenario to show the difference.

### Scenario: Full-day coding (3h morning → 2h lunch/meeting → 3h afternoon)

Conditions: Opus 4 pricing, 1 prompt per minute, ~5 API calls per prompt (~300 calls/hour).

#### ❌ Without super-token-saver

Most work happens in the Main session. Context grows fast.

| Phase       | Situation                         | Context size               | Cost                                   |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| Morning 3h  | Coding (mostly in Main)           | 100K → 600K (avg 350K)    | 900 calls × 350K × ＄0.50/M = ＄157.50  |
| Lunch/mtg   | Away for 2 hours                  | —                          | —                                      |
| Return      | Cache expired → full re-send      | 600K full price            | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Return      | /compact (summarize)              | 600K → sent to LLM        | 600K × ＄0.50/M + summary output = ~＄1.50 |
| Afternoon 3h | Coding continues (context regrows) | 100K → 600K (avg 350K)   | 900 calls × 350K × ＄0.50/M = ＄157.50  |
|             | Total                             |                            | ~＄326                                  |

> At this level you'll probably hit the 5-hour rate limit too. **The cost is bad, but the real problem is that your work stops dead. That's the moment Claude Code goes dark.**

#### ✅ With super-token-saver

Heavy work goes to SubTasks. Main handles design and decisions only.

| Phase       | Situation                                    | Context size                | Cost                               |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| Morning 3h  | Coding (Main: design, SubTask: implementation) | Main 100K → 300K (avg 200K) | 900 calls × 200K × ＄0.50/M = ＄90 |
| Lunch/mtg   | Away for 2 hours                             | —                           | —                                  |
| Return      | ⚡ Token Guardian (block mode) → /clear + /s-continue | —                           | ＄0 (no LLM calls)                 |
| Afternoon 3h | Coding continues                             | Main 100K → 300K (avg 200K) | 900 calls × 200K × ＄0.50/M = ＄90 |
|             | Total                                        |                             | ~＄180                              |

#### 💰 Result

> **＄326 → ＄180. ＄146 saved per day. A 45% cost cut.**
>
> **Max Plan:** fewer tokens means you don't hit the rate limit. Your work doesn't stop. That's the real difference.
>
> **API pay-per-use:** ＄146/day × 22 workdays is **＄3,200/mo straight off your invoice.** A heavy month without this plugin crosses ＄7,000. With it, under ＄4,000. Same output.

### Where super-token-saver steps in

```
[Session Start]
    │
    ├─ Session Architect → Auto-injects SubTask delegation pattern
    │                       Keeps Main context under 250K
    │
[Working]
    │
    ├─ Status Line → Real-time cost/context/rate limit monitoring
    │                  Instant alert when entering warning zone
    │
[1+ hour idle]
    │
    ├─ Token Guardian → Detects cache expiry, warns (or blocks in block mode)
    │
[Session restart]
    │
    └─ /s-continue → Restores previous context at zero cost (no LLM calls)
```

---

## 🔧 Source Install & Customization

```bash
git clone https://github.com/ww-w-ai/super-token-saver.git
/plugin marketplace add /path/to/super-token-saver
/plugin install super-token-saver@ww-w-ai
```

super-token-saver is open source (Apache-2.0). Plain JavaScript and Bash: no compiled binaries, no external API calls, no telemetry. Every line can be read. Every claim in this README points to a file you can open.

- **hooks/** — cache expiry threshold, warning messages, session architecture rules
- **scripts/** — analysis logic, report builder, status line formatting
- **skills/** — how /s-continue and /usage-view work, prompt templates
- **locales/** — add or edit translations, add new languages
- **skills/usage-view/** — dashboard UI/UX

Make it yours. Fork it, experiment, and send a PR if you find something better.

---

## 🌐 Supported Languages

23 languages. We picked them by crossing the top 20 countries by Claude Code usage with the top 20 languages by speaker count. The display language is detected from your OS locale. You can also set it by hand: `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

The current translations are AI-generated. Native speakers are welcome to improve them: edit the JSON file for your language in `locales/` and send a PR.

---

## ⚖️ What This Plugin Costs You

The plugin injects context at session start. Here's exactly how much.

| Injection | When | Tokens | Purpose |
| --------- | ---- | ------ | ------- |
| Session Architect | SessionStart (once) | ~1,100 | SubTask delegation + round-trip minimization + concise mode rules |
| Git context (if git-lite enabled) | SessionStart (once) | ~280 | Replaces CC's native ~2,200 tok git instructions |
| Cache expiry warning | On idle > 59m (once) | ~200 | Flags the expensive re-send, shows the cheaper path |
| Status line | Every API call | 0 | Renders to terminal status bar, not conversation context |

**Net overhead per session: ~1,400 tokens (one-time, cached after the first call).**

At Opus pricing ($0.50/MTok cache read), that's **$0.0007 per API call**, less than a tenth of a cent. Over a 100-call session: $0.07.

With git-lite enabled, the plugin actually **saves** ~1,920 tokens per session (2,200 replaced by 280). The net effect is negative: it removes more than it adds.

**For pay-per-use users:** at $3,000/mo of spend, the plugin's overhead is under $2/mo. One blocked $9 re-send pays for a year of it.

---

## 💡 Tips

### Understand cache and you'll see where the money goes

- **1 prompt ≠ 1 API call.** Every time Claude calls Grep, Read, or Edit, the whole context is re-sent. One prompt easily becomes 10+ API calls. Clear prompts mean fewer unnecessary tool calls and a lower bill.
- **The cache timer resets on the last API call, not your last prompt.** Keep working and the cache never expires. The danger is stepping away. Token Guardian tells you when it happened, and in `block` mode stops the prompt once so you can choose: reset the context, or carry on as is.
- **Context size is your cost multiplier.** The same API call costs 4x more at 800K than at 200K. When the status line's [CTX] passes 35% (🟡), that's the signal to push more work into SubTasks.

### Habits that cut costs

- **Keep CLAUDE.md lean.** It's loaded into the system prompt on every API call. Every line costs money.
- **Send heavy work to SubTasks.** Code generation, multi-file edits, and test runs don't belong in Main. SubTasks have a smaller context and a cheaper cache tier.
- **Away for an hour or more?** `/clear`, go, come back, `/s-continue`. Context restored at $0.
- **[5H] above 70% (🟡)?** Slow down. Switch to light review work or push more into SubTasks to cut Main's API call count.
- **Use `/btw` for side questions.** It stays out of the conversation history, so your context stays lean.

### API pay-per-use: the habits that matter most

Everything above applies. On pay-per-use, add these:

- **Watch [CTX] like a speedometer.** No rate limit will stop you, but at 500K+ every API call costs 2-3x what it should. `/clear` → `/s-continue` is free and resets the multiplier to baseline.
- **Run `/usage-view` weekly.** Max Plan users get a natural "ouch" when they hit the rate limit. You don't; costs just climb quietly. The dashboard is your early warning.
- **Set a daily budget in your head.** Without a cap, a $200 day slips past unnoticed. The status line's RUN indicator shows cost per turn. If one turn passes $1 (🔴), your context is too big.

---

## 📚 Documentation

- [Prompt Cache Guide](guides/prompt-cache-guide.md) — Why most of your cost is cache, how caching works across providers (Anthropic, OpenAI, Gemini), and how to manage it ([한국어](guides/prompt-cache-guide-ko.md) · [日本語](guides/prompt-cache-guide-ja.md) · [中文](guides/prompt-cache-guide-zh.md) · [Español](guides/prompt-cache-guide-es.md) · [Français](guides/prompt-cache-guide-fr.md) · [Deutsch](guides/prompt-cache-guide-de.md) · [+16 languages](guides/))
- [Fable 5.1 vs Opus 5 Cost Analysis](guides/fable-5-1-vs-opus-5-cost-analysis.md) — At least 24–38% cheaper than Opus 5 at equal quality, measured across 2,782 sessions
- [Fable 5.1 vs Opus 5 Cost Analysis (한국어)](guides/fable-5-1-vs-opus-5-cost-analysis.ko.md)
- [Opus 4.7 vs 4.6 Cost Analysis](guides/opus-4-7-vs-4-6-cost-analysis.md) — Side-by-side cost comparison across 8,563 API calls
- [Opus 4.7 vs 4.6 Cost Analysis (한국어)](guides/opus-4-7-vs-4-6-cost-analysis.ko.md)

---

## License

Apache-2.0
