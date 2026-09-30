# Claude's Weekly Limit Moved Exactly as Announced

**So why does it feel smaller? Five months of Claude Code statusline data, checked against every official announcement**

**Period**: 2026-04-09 to 2026-09-27
**Setup**: Claude Code on macOS, one Max 20x account
**Sample**: 21,531 usage readings across 834 sessions; 257 five-hour windows met the inclusion rules
**Method**: 5-hour % and weekly % from super-token-saver's statusline log (`ratelimit.csv`). Only values Claude itself reports to the statusline are used
**Official sources checked**: anthropic.com news and engineering posts, the claude.com blog, the Help Center, the Claude Code CHANGELOG, the status page, and @claudeai and @ClaudeDevs on X

> 한국어: [weekly-limit-vs-5h-window.ko.md](./weekly-limit-vs-5h-window.ko.md)

---

## 0. Summary

### Since May, the weekly limit has dropped once: on 9/14, by exactly the announced amount

We measured the weekly limit as "how many full 5-hour windows fit in one week," and split the timeline at each official change.

| Period | Official change | 5h windows | Weekly = N full 5h windows | Expected from announcements |
|---|---|---|---|---|
| 04-09 to 05-05 | Baseline | 36 | 8.8 (peak hours 11.0, off-peak 8.2) | — |
| 05-06 to 05-12 | Claude Code 5-hour limit doubled; peak-hour reduction removed | 3 | 3.8 | 4.1 |
| 05-13 to 09-13 | Claude Code weekly +50% promotion | 194 | 5.4 | 6.2 |
| 09-14 to 09-21 | Promotion ends; weekly permanently +25% | 15 | **4.5** | **4.5** |
| 09-22 onward | Opus 5.5 launch; Claude Code 5-hour limit +20% | 9 | 4.5 | 3.75 |

- **The 9/14 change matches the announcement exactly.** Going from +50% to +25% scales the weekly limit by 1.25 / 1.5 = 0.83. 5.4 × 0.83 = 4.5, and we measured 4.5.
- **No silent cut during the four-month promotion.** 5/13–5/27: 5.2. 5/28–6/29: 5.1. 6/30–9/13: 5.5.
- **In April units, today's weekly limit is about 10% larger than April's.** The 5-hour window doubled on 5/6, so today's 4.5 windows equal about 9.0 April windows. April was 8.2. The announcements imply +25%, or 10.3, so we come up about 12% short.
- That 12% gap appeared at the 5/6 change and has not moved since. Because this metric is a ratio of the two limits, **it cannot tell whether the weekly limit is 12% smaller or the 5-hour window grew 12% more than 2x.**
- **The 9/22 5-hour +20% doesn't show yet.** With the weekly limit unchanged, the ratio should fall to 4.5 / 1.2 = 3.75. It is still 4.5. That period has only nine windows, too few to call.

This data does not support the claim that the weekly limit keeps shrinking.

### Six reasons it still feels smaller

1. **The weekly limit dropped 17% on 9/14.** Anthropic's developer account [@ClaudeDevs announced it on 8/29 and gave the number: "a 17% reduction"](https://x.com/ClaudeDevs/status/2093742322525810912). It never appeared on anthropic.com news or @claudeai.
2. **The unit changed.** When the 5-hour window doubled on 5/6, the number of full windows you can burn in a week fell from 8.8 to 4.5. Run full windows back to back and the week is gone in about 22 hours. That is why the weekly limit runs out before you ever hit a 5-hour limit.
3. **Global resets came in a cluster, then stopped.** From 6/1 to 7/16, about seven weeks, @ClaudeDevs announced seven all-user resets. From 7/16 to 9/1, about seven weeks, there were none. After weeks of frequent resets, an unchanged limit feels like a cut.
4. **Newer models use more tokens.** The Opus 4.8 and Sonnet 5 launch posts say limits were raised "to accommodate the higher token usage of higher effort levels." The same task now spends more of your limit. This ratio cannot measure that effect.
5. **The promotion and the +25% apply to Claude Code only.** Usage on the web and in the apps fills the same weekly limit with no bonus.
6. **Since 9/25, hitting the 5-hour limit draws a little from the weekly limit.** Claude Code takes a small fixed allowance from your weekly limit so it can wrap up instead of stopping mid-edit. On Max and Team Premium this happens every time you hit the 5-hour limit; on Pro, once a week ([@ClaudeDevs](https://x.com/ClaudeDevs/status/2103561342057943314)).

### Max 20x's "20x" is stated for the 5-hour limit only

The Help Center lists the 5-hour limit as 5x Pro (Max 5x) and 20x Pro (Max 20x). For the weekly limit it says only "Max plans also have a weekly usage limit." No number is published for the weekly gap between the two plans. One user measured the same account on Max 5x in July and Max 20x in August: the 5-hour window was 4.4x larger, the weekly limit 2.2x ([Zapador, r/ClaudeAI](https://www.reddit.com/r/ClaudeAI/comments/1why2zx/a_lot_of_talk_about_reduced_weekly_limits_but_a/)). That post's August Max 20x figure (weekly ≈ 5 full 5-hour windows) is close to ours for the same period (5.5).

### Send us your data with `/report-limit`

These results come from one Max 20x account. Comparing plans takes data from many accounts.

Install super-token-saver and run `/report-limit` in Claude Code. It opens a draft GitHub Discussion in your browser with a per-window usage table. The raw 5-hour and weekly readings are attached as a gist link; if a gist can't be created, you get the path of a zip file to attach instead. Review it, then submit. You don't need to have hit a limit. By default it sends every 5-hour window from the last 7 days; `/report-limit blocked` sends only the windows where you hit the limit. Home paths and API keys in the body are masked. Claude Code only for now.

---

## 1. What we measured

### The ratio of the two limits inside one 5-hour window

Claude Code passes the account's 5-hour and weekly usage percentages to the statusline on every response. super-token-saver's `statusline-logger.sh` appends a row to the session's `ratelimit.csv` whenever they change.

The metric is **the rise in 5-hour % within one 5-hour window, divided by the rise in weekly % over the same span.** A value of 4.5 means 4.5 full 5-hour windows fill the weekly limit. Both numbers come from the same account and the same requests, so what's left is **the relative size of the two limits**, regardless of which model ran. We use no dollar costs and no token-based coefficients. Dollars swing 2–3x under the same limit depending on model and cache mix.

### Which windows count

- Within one window and one session, 5-hour % must rise at least 10 points and weekly % at least 1 point.
- A window is dropped if any value goes down inside it (a reset, or a stale value from another session).
- A window is dropped if it falls within one hour of a global reset confirmed officially or by the community (§3).
- If several sessions logged the same window, only the session with the largest 5-hour rise counts.
- Rows logged right at session start are dropped: the 5-hour value is empty and the weekly value may be cached.
- The weekly value is written only when it changes, so it is carried forward within a session.
- Each period's value is the sum of 5-hour rises divided by the sum of weekly rises, not an average of per-window ratios. This cancels the rounding error from integer weekly percentages.

257 of 1,730 windows qualified. Most were dropped for rising too little.

### Picking the account

Every row carries the weekly reset time, which identifies the account. This account's reset time moved from 23:00 UTC to 06:00 UTC at the 4/23 all-subscriber reset; we selected its rows by the reset time before and after that date.

---

## 2. Every official announcement, checked

We looked for every 2026 official announcement about limits. We scanned about 500 anthropic.com news and engineering posts and claude.com blog posts by title and read 28 in full. We also read 19 Help Center articles, the Claude Code CHANGELOG, the status page, and @claudeai, @ClaudeDevs and @AnthropicAI on X. @AnthropicAI posted nothing about subscription limits.

**Most Claude Code limit changes landed first, or only, on the developer account @ClaudeDevs.** That includes the promotion extensions, the 9/14 switch, and the resets. The Help Center lists only the final promotion window (5/13–9/13), written after the extensions ended.

| Date | What changed | Official source | Our measurement |
|---|---|---|---|
| 03-14 to 03-28 | 2x usage outside weekday peak hours (5–11am PT) and all day on weekends. Free, Pro, Max, Team, including Claude Code | [@claudeai](https://x.com/claudeai/status/2032911276226257206) (the Help Center article now returns 404) | before our data |
| 05-06 | Claude Code 5-hour limit doubled; peak-hour reduction removed for Pro and Max | [News](https://www.anthropic.com/news/higher-limits-spacex), [@ClaudeDevs](https://x.com/ClaudeDevs/status/2052064938840228237) | 8.8 → 3.8. In April, peak-hour windows were about 25% smaller than off-peak |
| 05-13 | Claude Code weekly +50% through 7/13; "stacks with the 2x increase to 5-hour limits" | [@ClaudeDevs](https://x.com/ClaudeDevs/status/2054639777685934564) | 5.2 |
| 07-12 · 07-18 · 08-18 | +50% extended to 7/19, then 8/19, then 8/31 | [@claudeai](https://x.com/claudeai/status/2076351399999557669), [@ClaudeDevs](https://x.com/ClaudeDevs/status/2078511173759324328), [@ClaudeDevs](https://x.com/ClaudeDevs/status/2089798442306711646) | — |
| 05-28 | Opus 4.8: "increased rate limits in Claude Code" (amount not stated) | [News](https://www.anthropic.com/news/claude-opus-4-8) | 5.2 → 5.1, no change |
| 06-30 | Sonnet 5: "increased rate limits across Chat, Cowork, Claude Code" (amount not stated) | [News](https://www.anthropic.com/news/claude-sonnet-5) | 5.1 → 5.5 |
| 07-01 to 07-19 | Fable 5 included for up to 50% of the weekly limit | [News](https://www.anthropic.com/news/redeploying-fable-5), [@claudeai](https://x.com/claudeai/status/2076351401006154204) | — |
| 07-20 onward | Fable 5 standard on Max and Team Premium at 50% of limits; one-time $100 credit for Pro and Team Standard | [@claudeai](https://x.com/claudeai/status/2078302415804379218) | — |
| 08-29 | From 9/14, weekly permanently +25%; +50% stays until then. "A 17% reduction" compared to today | [@ClaudeDevs](https://x.com/ClaudeDevs/status/2093742321473065266), [Help Center](https://support.claude.com/en/articles/15910845-claude-code-may-august-2026-weekly-limits-promotion) | 4.5 from 9/14, matches |
| 09-22 | Opus 5.5: Claude Code 5-hour limit +20%; Opus 5.5 is cheaper, so limits go 25% further; one reset to use any time until 10/22 | [News](https://www.anthropic.com/claude-opus-5-5), [@ClaudeDevs](https://x.com/ClaudeDevs/status/2102438800836489554) | 4.5 (announcement implies 3.75); nine windows |
| 09-23 | Cloud sessions generally available; one-time credit separate from limits ($100 Pro, $250 Max), claim by 10/7 | [Blog](https://claude.com/blog/claude-code-on-the-web), [@ClaudeDevs](https://x.com/ClaudeDevs/status/2102871550974427462) | — |
| 09-25 | Hitting the 5-hour limit draws a small wrap-up allowance from the weekly limit. Max and Team Premium every time, Pro once a week | [@ClaudeDevs](https://x.com/ClaudeDevs/status/2103561342057943314) | — |

Products outside Claude Code changed too: Claude Design token limits doubled (5/18), and Cowork usage limits doubled (6/5 to 8/5).

**Not found in any official channel**: the `/limit-reset` command that appeared on 9/2 (resets the 5-hour limit only, once a week) and the 9/4 global reset. Both are confirmed only by Reddit reports.

**The 5/28 and 6/30 raises don't show up in the ratio.** Either both limits rose by the same proportion, or the raise was small. This metric can't tell which. "Opus 5.5 goes 25% further" applies to both limits equally, so it doesn't show in the ratio either.

---

## 3. Global resets

In 2026, @ClaudeDevs announced 12 limit resets, or 13 counting the 9/22 "use it whenever you choose" reset. We also list when this account's weekly % dropped to near zero mid-week. Rows are logged only during use, so the time we see the drop is later than the actual reset.

| Date (UTC) | What happened | Source | This account |
|---|---|---|---|
| 04-16 20:02 | Reset after fixing a bug in how Opus 4.7 long-context requests counted against limits | [@ClaudeDevs](https://x.com/ClaudeDevs/status/2044868953206612154) | — |
| 04-23 21:15 | All-subscriber reset alongside the Claude Code quality postmortem | [@ClaudeDevs](https://x.com/ClaudeDevs/status/2047371123185287223), [Postmortem](https://www.anthropic.com/engineering/april-23-postmortem) | reset time changed |
| 04-27 | — | — | 36% → 0% (between 07:22 and 15:20) |
| 05-06 16:20 | Reset alongside the 5-hour doubling | [Reddit](https://www.reddit.com/r/ClaudeAI/comments/1t5hxcs/did_claude_just_double_usage_limits_for_everyone) (the official posts don't mention a reset) | — |
| 05-15 18:00 | All-user reset | [@ClaudeDevs](https://x.com/ClaudeDevs/status/2055347539923308703) | — |
| 06-01 17:35 | Pro and Max reset after fixing a bug that spawned too many parallel subagents | [@ClaudeDevs](https://x.com/ClaudeDevs/status/2061501787769893055) | 65% → 6% |
| 06-09 21:48 | All-user reset on Fable 5 launch day | [@ClaudeDevs](https://x.com/ClaudeDevs/status/2064464557951852643) | 76% → 0% |
| 06-13 02:24 | All-user reset | [@ClaudeDevs](https://x.com/ClaudeDevs/status/2065621176735646006) | — |
| 06-19 02:50 | Reset for affected users after a bug showed a wrong weekly limit (about 3% of users) | [@ClaudeDevs](https://x.com/ClaudeDevs/status/2067802163498352929) | — |
| 06-20 00:05 | All-user reset across all plans | [@ClaudeDevs](https://x.com/ClaudeDevs/status/2068122937308426676) | — |
| 07-01 21:16 | All-user reset as Fable 5 returned | [@ClaudeDevs](https://x.com/ClaudeDevs/status/2072429181565288665) | 64% → 3% |
| 07-09 18:01 | All-user reset | [@ClaudeDevs](https://x.com/ClaudeDevs/status/2075279141352706215) | — |
| 07-16 03:58 | All-user reset | [@ClaudeDevs](https://x.com/ClaudeDevs/status/2077603834453770467) | — |
| 07-29 | — | — | 98% → 5% (between 7/28 08:53 and 7/29 06:47) |
| 09-01 18:35 | All-user reset with the Fable 5.1 launch | [@ClaudeDevs](https://x.com/ClaudeDevs/status/2094856679250919746) | 76% → 0% |
| 09-02 | `/limit-reset` appears: resets the 5-hour limit only, once a week | [Reddit](https://www.reddit.com/r/ClaudeAI/comments/1w5r094/this_is_new_limitreset_resets_your_session_limit) | — |
| 09-04 20:00 | Global reset; many Pro users report not getting it | [Reddit](https://www.reddit.com/r/ClaudeAI/comments/1w7ffob/we_got_a_limits_reset) | 7% → 0% |
| 09-22 | One reset to use any time until 10/22 | [@ClaudeDevs](https://x.com/ClaudeDevs/status/2102438803013333469) | used on 9/27 |

- Global resets clustered around model launches and bug fixes: seven from 6/1 to 7/16, then none until 9/1.
- Two mid-week resets appear only in this account's data (4/27, 7/29). We could not find the cause. Several users reported their per-account reset time shifting in mid-to-late April.

---

## 4. What we couldn't confirm

- **The cause of the 12% gap since 5/6.** This metric can't separate a weekly limit smaller than announced from a 5-hour window that grew more than 2x. The 5/6–5/12 period has only three windows, so its value (3.8) is the least certain.
- **Absolute size.** We measured a ratio only, so we can't say how many tokens the weekly limit holds. The higher token use of newer models (reason 4 above) is outside what this measures.
- **Before 4/10.** One user reported a large cut at the 4/10 weekly reset ([xeviltimx, r/ClaudeCode](https://www.reddit.com/r/ClaudeCode/comments/1si6gll/claude_max_just_slashed_my_limits_by_10x_and_i/)). Our data starts 4/9, so we can't compare.
- **The 9/22 5-hour +20%.** The announcement implies 3.75; we see 4.5. With only nine windows, this needs more data.
- **Other plans.** One Max 20x account only.
- **Precision.** 5-hour % and weekly % are integers and are logged only when the statusline refreshes.

---

## Appendix. Reproduce it yourself

1. Install super-token-saver and turn on statusline logging with `/setup-statusline`. From then on, `~/.claude/super-token-saver-data/{project}/{session}/ratelimit.csv` collects 5-hour % and weekly %. Columns: `ts,5h,5h_reset,7d,7d_reset,alert,version`.
2. Read each session in time order, carry the weekly value forward, and drop rows with an empty 5-hour value.
3. Group by `5h_reset` (the 5-hour window) and session, and apply the rules in §1.
4. Split the timeline at the official change dates and compute, per period, the sum of 5-hour rises divided by the sum of weekly rises.
5. With several accounts, split by the time in `7d_reset`. `/usage-view` also records a hashed login account per session (`accountChanges`), which works too.
