# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.5.0] - 2026-09-04

### Fixed: `/usage-view --all` counted about half the real total

`statusline-logger.sh` writes a `ratelimit.csv` under every cwd a session visits, so one session
left a folder under several projects. `build-report.js` let the last-sorted folder win, and that
folder had no `timeline.csv`, so the session's cost became zero — 97 main sessions and $7.2K over
26 days on one account. The project now resolves from the transcript path (the same rule
`analyze-usage.js` uses to place the cache). Sessions whose transcript is gone but whose cache
survives are counted too. Verified against an independent JSONL sum to within 0.13% on every token
type. Gate: `scripts/test-session-project-map.js`.

### Changed: Codex cache moved under `codex/`

Codex and Claude Code caches shared one tree with identical filenames, so every tree-walking tool
mixed the two hosts. Everything Codex now lives under `~/.claude/super-token-saver-data/codex/`
(`cache-paths.forHost('codex')`); the Claude tree stays at the root. A one-time migration moves
existing entries. Gate: `scripts/test-cache-host-split.js`.

### Changed: Token Guardian is off unless you turn it on

`CC_TOKEN_SAVER_CACHE_GUARD` now defaults to `off`. Under Remote Control a hook's block message is
rendered locally and never reaches the remote client, so the guard behaved differently depending on
where the user sat; it is off until Remote Control forwards hook messages, at which point the
default returns. `warn` and `block` are unchanged but opt-in. The `warn` instruction was rewritten
so the one-line notice reads like a passing remark in the user's language instead of a translated
system message.

### Added

- `docs/RATE-LIMIT-BURN-METHOD.md`: how 5-hour-window burn is measured from the plugin's own cache,
  and the controlled result that cache-read tokens consume the window at the same rate on Opus 5 and
  Fable 5.1 (0.013 pt per million). The Fable cost report gets a price-basis line and an appendix.
- `claude-opus-4-8` in `scripts/model-pricing.json` (official price page).

## [3.4.0] - 2026-09-04

### Changed: Token Guardian now warns by default instead of blocking

`hooks/cache-expiry-check.sh` gains a mode switch, `CC_TOKEN_SAVER_CACHE_GUARD` = `warn` (default)
| `block` | `off`. In `warn` the expired-cache prompt goes through and the hook attaches
`additionalContext`, so Claude opens its reply by telling the user the cache had expired and this
turn was billed as a full re-send. `block` is the previous behaviour, opt-in.

Why: a hook `decision: block` is rendered as a local `system/informational` message, and Remote
Control forwards only `user`, `assistant` and `system/local_command` messages
(`bridge/bridgeMessaging.ts` `isEligibleBridgeMessage`). A remote user saw the prompt disappear
with no explanation and could not tell whether it ran. Claude's reply is forwarded, so the warning
now rides on that. No hook input or environment variable exposes "this session is remote", so the
hook cannot pick the mode itself.

READMEs (en, ko): Token Guardian moves from Feature 1 to Feature 5 and the other features are
renumbered; the git-lite anchor in the install section follows. Both READMEs were also rewritten
for readability, the Korean one throughout; Feature 1 (Session Architecture) and Concise Mode now
describe what `hooks/session-architecture.md` actually injects (round-trip minimization; length
matched to the job rather than a fixed sentence count). The other 21 locales carry the same restructure and the translated
Feature 5. README-CODEX (en, ko, ja, zh-Hans) states the cross-tool handoff works in both directions.

## [3.3.0] - 2026-09-01

### Added: `/usage-view` reads Codex sessions, priced in purchased credits

A Codex subscription bills in credits bought up front, not per token, so a dollar figure computed
from Anthropic rates would be a fabrication. The dashboard now reports what a Codex session used as
a **credit equivalent**: model-weighted fresh/cached/output rates per million tokens from a pinned
rate card, divided by 25 credits per dollar. Cache creation is excluded — it is known to carry no
charge on a subscription, so it is not counted as an unpriced gap.

Coverage is stated rather than assumed. A model whose exact id is not on the rate card makes the
figure a lower bound and is named; zero coverage reports N/A instead of a number. The rate card
carries its own provenance (retrieved 2026-08-31, promotional pricing through 2026-11-21) and a
malformed one fails closed rather than pricing anything at zero.

Discovery, normalization and rendering are the paths Claude Code already uses — the same
`codex-transcript.js`, the same `build-report.js`, the same template. Only cost math, the
rate-limit window length and plan resolution branch by host, so there is no second dashboard to
keep in step. Claude Code output is unchanged.

This work was written and reviewed against the marketplace's vendored copy and had never reached
this repository; it is committed here in the state its gates left it.

## [3.2.0] - 2026-09-01

### Changed: after a compaction the restore runs itself, instead of being requested

The compact hook used to inject an instruction telling the model to run the s-continue skill. An
instruction can be declined, and was: on a real autonomous run the text landed in context saying
there was no exception, and the restore was skipped anyway, leaving the run to proceed on a summary
that had flattened the user's standing orders.

The hook now performs the restore and injects the result. It renders the pre-compact turns at level
1 and hands them over framed as restored history — explicitly not a new request — so there is
nothing left for the model to comply with. Level 1 is forced because compaction happens when
context runs short: the refill has to stay bounded, and the model can still ask the skill for level
2 or 3. Every failure falls back to the previous instruction text, and any error at all prints
nothing, so a broken hook can never block a session.

Codex reaches the same script through its own `compact` matcher on `SessionStart`, which is the one
event that carries injected context on both hosts — Codex's `PostCompact` returns an outcome with
no context field, and Claude Code's is absent from the union entirely.

### Added: `scripts/restore.js`, the single implementation of the level slicing

The slicing lived as an inline Python block inside `SKILL.md`, which meant the hook could not call
it — only copy it. It is now a script both callers run. The skill's Step 3 boundary cut is folded
in: `--before-boundary` finds the last compaction from the compact file's own boundary block rather
than from a line number, so no separate session scan is needed. Codex rollouts are normalized on the
way in and keep their original line numbers. Output is byte-identical to the Python it replaces.

## [3.1.6] - 2026-08-30

### Fixed: release verification tolerates transient local process load

The Codex hook parity probe now allows 30 seconds for a subprocess that normally completes in a
fraction of a second. This avoids a false release failure observed once in the exact vendored copy
while preserving the same assertions and production hook timeouts.

## [3.1.5] - 2026-08-30

### Fixed: the source release now contains its declared Codex hook registry

The Codex manifest had pointed to `hooks/hooks-codex.json`, while the host-specific registry and
its architecture prompt existed only in the marketplace's vendored snapshot. Both files and their
parity gates now live in the source of truth. Codex SessionStart commands also use the same
fail-open boundary as Claude Code, including after compaction.

## [3.1.4] - 2026-08-30

### Fixed: compact recovery hooks no longer surface missing-runtime warnings

Claude Code may run `SessionStart` after compaction with a reduced `PATH` or without a usable
plugin root. The affected hooks now fail open at the registry boundary: successful context output
is preserved, while missing runtimes or files no longer produce exit-code 1 or 127 warnings.

A regression test executes every registered `SessionStart` command with a missing plugin root,
an empty plugin directory, and a reduced runtime path, then verifies both exit zero and silent
stderr. It also checks that normal session-architecture output is unchanged.

## [3.1.3] - 2026-08-30

### Fixed: `/s-continue` no longer hides fresh Codex sessions on cache-write failure

Codex session normalization now fails closed when its cache cannot be written. Previously,
`list-sessions.js` silently skipped every affected session and could present an older session as
the latest one. The visible error lets Codex request the required filesystem approval and retry
without returning a misleading partial list.

## [3.1.2] - 2026-08-30

### Fixed: Codex no longer runs Claude Code-only hooks

Codex now loads a host-specific hook registry and session architecture. The cache-expiry,
statusline-version, and git-context hooks remain available to Claude Code but are no longer run by
Codex. The shared post-compaction restoration hook remains enabled on both hosts.

## [3.1.1] - 2026-08-30

### Fixed: Codex loads the hook configuration file instead of its directory

The Codex plugin manifest now points `hooks` at `hooks/hooks.json`. Codex 0.151.0 reads this field
as a file path; the previous `hooks/` directory path failed at startup with OS error 21 (`Is a
directory`) and skipped this plugin's hooks.

## [3.1.0] - 2026-08-28

### Added: auto-compact now restores itself, on both hosts

`SessionStart` fires with `source: "compact"` after an auto-compact, on Claude Code and on Codex
alike — same event, same field name, same enum. The plugin now ships a hook on that matcher that
tells the model to run `/s-continue` before it does anything else, naming the session id from the
payload. Auto-compact keeps the id and keeps writing the same transcript, so the pre-compact turns
are still on disk; only the model's view of them is gone.

`PostCompact` cannot do this on either host — it is absent from the hook-specific-output union, and
the Codex binary spells it out: `*: this event cannot emit additionalContext`.

### Added: `/s-continue --level 1|2|3`

How deeply each selected session is read. Default 3, unchanged from before.

| Level | User turns | Replies at each end | Replies in the middle | Measured |
|---|---|---|---|---|
| 1 | last 30, cut to 150 + 100 | first 6 + last 6, at 100 chars | 50 chars | 6.2 K tok |
| 2 | last 30, as stored | first 12 + last 12, as stored | 50 chars | 9.4 K tok |
| 3 | all | first 24 + last 24, as stored | 50 chars | 44.3 K tok |

Measured on a 170-turn Claude Code session; a real Codex session came out 4.3 / 7.5 / 7.5 K.

No turn and no reply is dropped at any level — the middle of a long turn is shortened, not removed,
and the `-> N AI responses at lines X-Y` pointer above it still addresses the originals. The caps
are per turn as well as per session: one user turn is otherwise unbounded, and an autonomous run
puts hundreds of replies under a single message. Without a per-turn cap, level 1 measured *larger*
than level 2.

After an auto-compact the hook asks for level 1 — a summary is already in context, so what is
missing is the thread, not the bulk.

## [3.0.1] - 2026-08-25

### Fixed: the 3.0.0 rename could strand the entire existing cache

`cache-paths.js` renamed the old data directory to the new name only when the new one did not exist
yet. That guard does not hold: `statusline-logger.sh` is a Bash hook that writes `ratelimit.csv`
straight to the cache base with `mkdir -p`, never going through that module. It fires on the first
prompt after an upgrade — so by the time any script called in, the new base already existed and held
one small file, the migration was skipped, and every `compact.txt` and `handoff.md` stayed behind
under the old name. Nothing was lost, but nothing was found either, and it failed silently.

Measured on one real machine: **140 MB, 2,864 compact caches and 8 handoffs** orphaned.

The move is now done entry by entry instead of as one directory rename. It is still a rename, so a
large cache is never duplicated, and it is idempotent — anything already present in the new cache is
left alone and its legacy copy is kept rather than overwritten.

The same change fixes an older bug in that code: it stopped at the FIRST legacy name it found, so a
machine carrying more than one predecessor kept the rest forever. The recovery on that same machine
pulled in a further **641 entries** from two directories that had never been migrated at all.

New gate: `node scripts/test-cache-migration.js`.

## [3.0.0] - 2026-08-25

### Changed: the plugin is now `super-token-saver`, and its two shared skills are `/s-continue` and `/s-compact`

2.5.0 made this plugin run on Claude Code and Codex from one tree. A name claiming one host was
then telling half its users the product was not for them.

**This release renames things and nothing else.** Cache format, transcript handling, pricing data
and every skill's behaviour are untouched.

| Was | Is |
|---|---|
| plugin `claude-code-token-saver` | `super-token-saver` |
| `/cc-continue` | `/s-continue` |
| `/cc-compact` | `/s-compact` |
| `github.com/ww-w-ai/claude-code-token-saver` | `github.com/ww-w-ai/super-token-saver` |
| `~/.claude/claude-code-token-saver-data/` | `~/.claude/super-token-saver-data/` |

`usage-view`, `report-limit`, `setup-statusline` and `setup-git-lite` keep their names.

**A plugin's name is its install identity, so you reinstall rather than upgrade** — the steps for
both hosts are in `docs/MIGRATION-3.0.md`. Your cached sessions and handoffs move themselves: the
data directory is **renamed** on first run, the same mechanism that carried the cache through three
earlier renames.

Two things that bite if missed, both covered in the migration note: re-run `/setup-statusline`,
because it wrote the old plugin path into your `settings.json` and will silently stop updating; and
the old command names are gone rather than deprecated, so a skill never answers to a name the
product no longer has.

Entries below this one keep the names they shipped under. They are history and were not rewritten.

## [2.5.0] - 2026-08-25

### Added: /cc-continue and /cc-compact read Codex sessions too

Work stopped in Codex was unreachable from Claude Code and the reverse, so a session that ran
out of budget mid-task had to be re-derived by hand.

Both skills now list and restore sessions from `~/.codex/sessions/` alongside
`~/.claude/projects/`. A Codex rollout is not given a second parser: it is rewritten into the
shape Claude Code writes, **one output line per input line**, so every `L{n}` marker still
addresses the Codex original's line and the existing pipeline runs unchanged. The Claude path
is byte-identical, verified against the previous revision on real transcripts.

- Codex compaction (`compacted`, `context_compacted`, `thread_rolled_back`) is translated into
  the `system/compact_boundary` vocabulary the detector already reads, so a compacted Codex
  session earns the same `#0` pre-loss restore a compacted Claude session gets.
- Sessions are keyed on `payload.id`, not `session_id` — in Codex the latter is the thread id,
  which a spawned subagent inherits, so three files can share one. Subagent rollouts are
  excluded from the list, as Claude subtask transcripts already are.
- `--source claude|codex|all`, `--cwd`, and `--current-source` on `list-sessions.js`;
  `--original` on `preprocess.js` for the footer reference.
- `CODEX_HOME` is honoured.
- New gate: `node scripts/test-codex-adapter.js` (synthetic fixture, no real transcript needed).

### Added: the plugin ships to Codex from this same tree

Following the pattern `ai-native-cowork` established: `.codex-plugin/plugin.json` and a root
`manifest.json` alongside the existing Claude Code manifest, all three pinned to one version,
plus `README-CODEX.*` and a parity gate (`scripts/test_product_parity.py`) that fails on version
drift, a missing Codex README, or a dual-host skill that hardcodes one host's plugin root.

There is no separate Codex build. The previous Codex port kept its own copy of the preprocessor
and stayed at 1.7.0 while this repo moved on — one tree is what prevents that.

`cc-continue` and `cc-compact` are the dual-host pair; `usage-view`, `report-limit` and
`setup-statusline` read Claude Code's own billing records and remain Claude Code only.

## [2.4.1] - 2026-07-27

### Fixed: cache-expiry hook no longer blocks background task notifications

`UserPromptSubmit` fires not only for what a human types, but also for prompts Claude Code
enqueues itself — above all `<task-notification>`, the completion report of a background
agent or task. With long-running agents (an hour or more is now routine), those reports
were arriving after the 1-hour cache window and getting blocked by the expiry warning.

That is wrong twice over: nobody is at the keyboard to read the warning, so the one-time
gate never receives its second attempt; and the notification is consumed off the queue when
blocked, so **the agent's report is lost**.

- `hooks/cache-expiry-check.sh` now approves immediately when the submitted prompt starts
  with an XML-ish tag (`<` + a letter), before any of the flag or timestamp logic runs — so
  a notification never consumes the one-time warning flag either.
- The check is by shape, not by a list of tag names (`task-notification`, `tick`,
  `local-command-stdout`, …), so notification types added by future Claude Code releases are
  exempt automatically. A raw `<task-notification>` substring match backs it up in case the
  prompt field cannot be parsed.
- Natural-language prompts are unaffected and still get the expiry warning.

## [2.4.0] - 2026-07-22

### Changed: skill trigger/description surfaces normalized to English

The plugin ships to 23 locales, so its trigger surfaces should read as English while
per-user language detection happens at runtime. Several skills still carried Korean text
baked into the parts Claude matches against — cleaned up here. No behavior or script
changes; only trigger, description, and instruction text.

- `cc-compact`: removed hardcoded personal Korean shorthand triggers from `description`/`when_to_use` (`세핸프`, `ㅅㅎㅍ`, `핸드오프`, `인계`, `세션 마무리`) so the trigger surface matches the all-English convention of the other skills.
- `report-limit`: translated the inline unknown-model handling procedure to English; dropped the Korean example line under the plan prompt and the `💀` emoji from the description.
- `usage-view`: translated the unknown-model user-facing message in the agent prompt template to English.
- `cc-continue`: topic-restore examples changed from `PDCA 구현` to `PDCA implementation`.

## [2.3.0] - 2026-07-22

### Added: `/cc-compact` — session handoff that captures what `/cc-continue` can't recover

- New skill `skills/cc-compact`: writes a **session handoff** for the next session — the write-side pair of `/cc-continue`. `/cc-continue` restores the transcript (what the user and Claude said); `/cc-compact` distills what lives OUTSIDE that dialogue and is therefore invisible to transcript restore: **subagent findings** (their transcripts are separate files the restore never loads), **decisive numbers in tool output** (test counts, benchmarks, grep results), and **lessons learned from the process** (e.g. "couldn't reproduce headless → the cause was the build, not the code").
- The handoff is saved to `~/.claude/claude-code-token-saver-data/<project>/handoff.md`. `/cc-continue` now **auto-loads** it (new Step 7) on top of the restored transcript and marks it consumed (`handoff.applied.md`) so a stale handoff is never silently re-applied. No pasting required.
- The skill enforces coverage, not brevity: a mandatory extraction checklist (every subagent, every decisive tool-output number, every process lesson, every reverted approach, every non-committed artifact, every open gap) plus a red-flags table, because the common failure of a handoff is being too short to carry the hidden layer.
- Workflow: end a session with `/cc-compact` → start the next with `/cc-continue`.

### Changed: `/continue` renamed to `/cc-continue` (BREAKING)

- The context-restoration skill `continue` is now **`cc-continue`**. Rationale: Claude Code's own `resume`/`--continue` feature made the bare `/continue` name collide and read as a duplicate. The `cc-` prefix disambiguates it and pairs cleanly with the new `/cc-compact`.
- **Action required**: use `/cc-continue` instead of `/continue`. All docs, hooks, locale strings, and keywords updated. The scripts and behavior are unchanged — only the invocation name.

## [2.2.0] - 2026-07-02

### Added: `shrink-img` — zero-dependency image downscaler for cheaper file attachments

- New `scripts/shrink-img.js`: when an image FILE is attached (to read layout / text / dividers, or just to save tokens), a full-res original costs many tokens and can blow the tool-call payload (32MB cap → "Request too large"). This shrinks it to a sensible preview first. Payload example: a 1672×941 PNG drops from ~6.0MB to ~2.1MB decoded (64% less) at longest side 1000px, staying fully legible.
- Zero runtime dependencies, cross-platform: macOS uses the built-in `sips`; other platforms use pure-JS codecs that need no external tool — **pngjs** (MIT) for PNG and **jpeg-js** (BSD-3-Clause) for JPEG, both vendored under `scripts/lib/vendor/` and using only Node built-ins (`zlib`). No `npm install`, no ffmpeg/ImageMagick required for PNG/JPEG (those are a last resort only for other formats).
- No artificial size limits: jpeg-js's built-in 100MP / 512MB caps are lifted, so arbitrarily large images work (a 110MP JPEG downscales fine); tiny images are kept as-is (never upscaled).
- Flexible sizing — combine freely, tightest bound wins, aspect preserved, never upscales: `--scale <f>` (relative), `--maxdim <px>` (longest side), `--width` / `--height` (per-axis), `--maxmp <mp>` (total-pixel budget). `--quality <1-100>` tunes JPEG output. Default with no flag: longest side 1000px.
- The SessionStart architecture guide now recommends shrinking most image-file attachments before sending (exception: already-tiny images or when fine text detail must be read at full resolution).
- Third-party attributions recorded in the new `THIRD-PARTY-NOTICES.md`.

## [2.1.2] - 2026-06-16

### Fixed: `/continue` last/first message masked by ESC-interrupt markers

- When a turn is interrupted with ESC, Claude Code injects a synthetic user message `[Request interrupted by user]` (or `[Request interrupted by user for tool use]`). These were counted as genuine user turns, so they leaked into the `/continue` picker's first/last message column and into the preprocessed transcript's "Last N messages" — masking the user's real last typed message (observed as the last message appearing one or two turns stale).
- `list-sessions.js`: `isGenuineUserMessage()` now filters any text starting with `[Request interrupted by user`. Matches the marker prefix only — genuine messages that happen to start with `[` (`[Image #1] …`, `[중요] …`, pasted blocks) are preserved.
- `preprocess.js`: added the same marker to `SKIP_USER_PATTERNS` and bumped `COMPACT_FORMAT_VERSION` 6 → 7 so existing caches regenerate cleanly.

## [2.1.1] - 2026-06-15

### Fixed: `/continue` session list polluted by automated review sessions

- The built-in `/security-review` and `/code-review` commands spawn separate headless sessions with their own JSONL transcripts. Their first "user" message is a programmatic review prompt (`Review this change for security vulnerabilities…`), which `list-sessions.js` mistook for a genuine user turn — so these noise sessions appeared in the `/continue` picker, burying the user's real conversations.
- Added the review-prompt markers to `SUBTASK_PREFIXES`, so review-spawned sessions now register zero genuine user messages and are excluded from the main session list.

## [2.1.0] - 2026-05-28

### Round-trip minimization + decision-focused concise mode

- Session Architecture hook now injects round-trip minimization rules (parallel tool bundling, batch planning, early-exit, SubTask absorption) alongside the existing context-growth controls.
- Concise Mode overhauled: 1-3 sentence default with hard bans on 9 verbose patterns (agreement-expansion, table compulsion, preemptive code, etc.) and a depth-on-demand principle.

## [2.0.1] - 2026-05-21

### Renamed to claude-code-token-saver

- Plugin renamed from `claude-code-upgrader` to `claude-code-token-saver` — clearer purpose ("token saver" vs generic "upgrader")
- Cache directory auto-migrates from `claude-code-upgrader-data/` → `claude-code-token-saver-data/`
- Legacy migration chain: `cc-token-saver` → `cc-token-saver-data` → `claude-code-upgrader-data` → `claude-code-token-saver-data`

## [2.0.0] - 2026-05-20

### Breaking: Renamed to claude-code-token-saver

- Plugin renamed from `claude-code-upgrader` to `claude-code-token-saver` (history: `cc-token-saver` → `claude-code-upgrader` → `claude-code-token-saver`)
- Cache directory auto-migrates from previous names (`claude-code-upgrader-data/`, `cc-token-saver-data/`) to `~/.claude/claude-code-token-saver-data/`
- Environment variable renamed: `CC_UPGRADER_TURN_IDLE_SEC` (old `CC_TOKEN_SAVER_TURN_IDLE_SEC` still works)
- Cross-platform path fix: Windows/Linux backslash paths now handled correctly in subagent detection and project name extraction

## [1.7.0] - 2026-05-06

### Fixed: 5h window minute-precision (post-2026-04-23)

- Anthropic switched 5h rate-limit window resets from hour-aligned to first-message+5h around 2026-04-23 — boundaries are now minute-precise (e.g. 13:20, 18:40)
- usage-view used hour-floor mapping for window assignment, causing boundary-hour activity and sessions to be miscounted in the wrong window
- Refactor: `window-utils.js` adds `buildGlobalTsMapper` (raw `ts` → window via merged ratelimit boundaries); `build-report.js` replaces hour-floor normalize with ts-precision mapping
- timeline CSV schema unchanged — automatic migration from existing data
- 4/23 이전 hour-aligned data is handled by the same algorithm naturally
- Verified on 52,671 timeline rows × 91 ratelimit windows: 781 boundary-hour reattributions, 0 invariant violations, 270/270 sessions within window boundary

## [1.6.2] - 2026-04-28

### New: Concise Mode (built-in response style)

- SessionStart hook now injects a response-style rule alongside the existing session architecture guidance — applies to **every session and every model**, no flags or setup
- Cuts preamble ("Let me check…", "I'll now…"), question restatements, and redundant summaries of work already shown in tool calls/diffs
- Picks bullets for lists, prose for reasoning (tradeoffs, causation, rationale) — neither forced
- Hard limits prevent over-compression: never drop content, skip verification, or collapse nuance into a single sentence ("Compress expression, not analysis")
- README updated in all 22 translated languages with a dedicated `🪶 Concise Mode` section

### `/usage-view` dashboard improvements

- **Efficiency chart**: denominator changed from `cc / output` to `cc / (input+output)` for fairer ratio interpretation; chart now ships with an in-place guide card explaining both Total/Output and Cache/(Input+Output) metrics
- **Context cost chart**: new in-place guide card explains CW / Non-CW / User Turn options and price-line semantics; dot/line color legend (red=Opus, blue=Sonnet, green=Haiku) added to Non-CW chart for parity with CW
- **Hourly / Day-of-Week**: new "Max" annotation describes single-day/single-week peak; "Partial" annotation now shows concrete normalization example (e.g., 20 min → ×3)
- **Per-user-turn model accuracy**: model attribution now reads from each call's row instead of the first row of the turn, fixing mixed-model turns
- **Cache write floor removed**: $0.05 minimum on CW dots removed so all calls render
- **Calendar cost filter**: new `💰 비용 ≥` slider hides cells below threshold for noise reduction
- **Daily token chart**: input tokens now tracked separately for finer-grained efficiency math
- **Plugin-installed marker**: label moved below the chart axis to avoid overlap with chart titles

### i18n

- New keys across all 23 locales: `effLabelTotal`, `effLabelCache`, `effGuideLine1/2/3`, `hourlyNoteMax`, `dowNoteMax`, `ctxGuideLine1/2`, `ctxCostCWNote4`, `ctxCostNonCWNote3/4`, `costFilterLabel`, `costFilterCount`
- Refined `hourlyNotePartial` / `dowNotePartial` with normalization examples in all 23 languages

## [1.6.1] - 2026-04-24

### New: Prompt Cache Guide (23 languages)

- New `guides/prompt-cache-guide.md` (+ 22 translations) explaining why cache dominates Claude Code costs, how Claude Code / Codex / Gemini CLI differ in caching behavior, and concrete strategies to cut cache spend with claude-code-token-saver features
- Linked from README documentation section

### `/usage-view` private mode

- New private mode strips raw prompt text from generated reports so dashboards can be shared without leaking prompt content
- 29 new i18n keys across all 23 locales (dashboard buttons, axis labels, descriptions)

### `totalCost` dedup fix

- Sum from `tokenBreakdown` instead of the `analyze-usage.js` rolled-up value — eliminates double-counting when parent/subtask sessions share replayed rows
- Removed the dedup-unsafe `totalCost` field from `analyze-usage.js` output with an inline comment explaining why

### Hook architecture: context-growth minimization

- `session-architecture.md` gains a guide on tool choice impact (Grep/Glob/LSP → Read partial → Read full as last resort, Edit > Write, `git diff` > dual Read)

### Repo housekeeping

- `research/` docs moved to `guides/` to match documentation structure

## [1.6.0] - 2026-04-22

### `/setup-git-lite` simplification

- Dropped the `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` env var and shell-profile marker block — `settings.json` alone is sufficient since CC reads `includeGitInstructions` natively
- `dismiss` / `undismiss` renamed to `dismiss-banner` / `undismiss-banner` for clarity
- Default no-arg invocation now runs `status` (was `help`) — first-time users see actionable diagnostic
- SKILL.md gains an i18n translation directive
- All 23 README translations + 23 locale files updated to match

## [1.5.0] - 2026-04-20

### New: `/setup-git-lite` skill

- Skips Claude Code's built-in git instructions (~2,200 tok/session + ~1,700 tok/commit) and injects a compact, locale-aware replacement via SessionStart hook
- Adoption tip surfaces at ~20% sampling rate in SessionStart only (single owner — removed from `/usage-view` and other commands to avoid duplicate nagging)
- New helper: `scripts/lib/git-lite-state.js` (`getRecommendationTip()` is locale-aware)
- Pricing fail-fast: unknown models now error out instead of silently assuming costs

### Full i18n for `/setup-git-lite`

- All 22 translated READMEs updated with the new Feature 5 section
- All 23 `locales/*.json` files gain a `gitLite.tip` key
- SessionStart hook now detects `LANG` and loads the localized tip from the JSON — no hard-coded translations in Bash

### Hook architecture: `session-architecture.md` redesign

- Restored `claude -p` guidance (removed in 1.4.0) — parallel design work goes through `claude -p` (1h cache tier, thinking active), execution work goes through SubTask (5m cache tier, Sonnet default)
- Sonnet weekly-limit caveat softened (not confirmed by Anthropic; likely falls back to Opus based on prior source evidence)
- Tighter size budget: 29 lines / 1.8KB despite added content

### Research report: Opus 4.7 vs 4.6 cost analysis

- New `research/opus-4-7-vs-4-6-cost-analysis.md` (EN) and `.ko.md` (KO)
- Based on 8,563 real API calls across two projects + 100-turn simulation
- Key finding: 4.7 costs ~1.43x of 4.6 on English/code workloads (23% on mixed, 12% on Korean-heavy), driven by tokenizer shift, 3.5× thinking frequency in main sessions, and 27~34% verbosity increase
- Includes methodology, simulation scripts, CC source analysis, and recommended mitigation (`/model claude-opus-4-6[1m]`)

### usage-view refactor

- Split into `analyze-usage.js` (per-session CSV) and `build-report.js` (HTML) with cleaner dependency boundary
- Unknown model detection surfaces as hard error with guidance to update `model-pricing.json`
- `--days all` support for full-history reports
- Plugin install-date detection fixed: now uses oldest cached version's birthtime instead of latest (which got overwritten on updates)

## [1.4.0] - 2026-04-13

### /continue skill improvements

- Current session with context-loss events (`/clear`, `/compact`, auto-compact) now appears as **#0 [default]** in session list
- `/continue last` auto-restores current session when it has context-loss events (recovers lost earlier content after auto-compact)
- New `hasContextLoss` + `contextLossEvents` fields in `list-sessions.js` output
- Event badges in session list: `📍` (current), `@@` (`/clear`), `+` (manual compact), `++` (auto-compact)
- Additive input parsing: empty = #0, `1,3` = #0 + #1 + #3
- Global-index pagination: browse via "more", select any number from any page
- Large selection confirmation (>=10 sessions or >500KB)
- 150KB threshold (up from 100KB) for default/aggressive mode switching

### preprocess.js v3 format — Signal-weighted truncation

- **4-category tag system** replaces bulk content with compact tags:
  - `[C{n} | {N}L | {N}KB]` — code blocks (>5 lines or >200B)
  - `[T{n} | {R}R | "{name}"]` — markdown tables
  - `[B{n} | {N}# | "{name}"]` — numbered lists (`#`) / bullet lists (`*`)
  - `[I{n} | {format} | {W}x{H}]` — images with parsed dimensions
- **Context Window truncation** for assistant messages: preserves URLs, inline code, attention-emoji lines, and keyword lines with natural +/-60 char context windows (no `[...]` markers, blank-line separated)
- **Meta footer** with full indexes (TOC at end for LLM attention weight): Code Blocks -> Tables -> Lists -> Images -> Attention Signals -> Table of Contents
- **Name extraction heuristic** for T/B tags: header / colon label / bold prefix
- **Image dimension parsing**: PNG, GIF, WebP (with signature check), JPEG (SOF0/1/2/3 for progressive support, 8KB scan window for EXIF-heavy images)
- **Attention emoji set** (20): red-X, red-circle, warning, siren, fire, target, bug, wrench, bulb, collision, party, trophy, rocket, test-tube, robot, money-wings, money, chart-up, chart-down, pin, yellow-circle (check-mark excluded as status marker noise)
- **Keyword detection**: `root cause`, `TL;DR`, `breakthrough`, `bug found`, `wrong`, `CRITICAL`, `CONFIRMED`, `FATAL`, `fixed`, `verified`, `finding`
- **Short code block protection**: <=5 lines or <=200B blocks kept in-place but masked during table/list/TOC scanning to prevent shell-pipe/italic/comment false positives
- **Tag-aware smartTruncate**: head/tail/snippet boundaries snap to tag edges, preventing tag splitting
- **Unified user/assistant HEAD/TAIL**: default 300/200, aggressive 100/100
- **Last-10 turn boost**: 1.5x head/tail for recent context
- **CACHE_VERSION 12 -> 13** (auto-invalidates old caches)
- **COMPACT_FORMAT_VERSION 2 -> 3**

### Memory retention comparison

- Session-level comparison between auto-compact summary and `/continue` raw restoration informed the design
- Validated that auto-compact requires "All user messages: List ALL user messages" per CC source prompt (`services/compact/prompt.ts:73`)

### usage-view: Context Size Distribution chart

- New bar chart showing API call distribution across 4 context size buckets (~250K, 250~350K, 350~500K, 500K+)
- Tooltip shows count, percentage, total cost, and avg cost per call for each bucket
- AI section2 prompt includes context distribution data for efficiency analysis
- Chart renders in all modes (not gated by days >= 3)

### report-limit: Date-specific reporting

- New `--date YYYY-MM-DD` flag: report all 5h windows overlapping a specific date (not just rate-limited ones)
- Scans `dayStart - 5h` to `dayEnd` to catch windows crossing midnight boundaries
- SKILL.md updated with date argument support (e.g. `/report-limit 2026-04-01`)

### Changed

- usage-view: Replaced "Top 20 user prompts" with "Autonomous Runs" list (>=20 min runs)
- usage-view: Per-API-call cost chart now uses square aspect ratio
- usage-view: Long-runs section moved above calendar
- usage-view: AI section2 now analyzes autonomous runs + per-call scatter (expanded length)
- **Marker semantics rename (breaking)**: `+` marker now means manual `/compact` (was: `/resume`, which was dead code due to CC's `display:'skip'`). `++` marker now means auto-compact (via `compact_boundary.trigger='auto'`).
- **alertType strings renamed**: `resume` → `compact-manual`, `compact` → `compact-auto`.
- **i18n keys renamed** (23 locales): `resume`/`resumeReason`/`compact`/`compactReason` removed, `compactManual`/`compactAuto`/`compactManualReason`/`compactAutoReason` added.
- **Marker ownership separated** (compact-timeline-separation):
  - `compact.txt` (preprocess.js) now holds ONLY user-side markers: `@ @@ + ++ ~ ! ^ ^^`.
  - `timeline.csv` (analyze-usage.js) now owns assistant-side markers: `* ** # ## ?` and rate-limit `%` markers, written into new `line,markers` columns.
  - `build-report.js` joins the two streams by JSONL line number via `buildAlertsFromUserTurns` and aggregates cost per user turn.
- **CACHE_VERSION bumped**: 8 → 9. Existing caches auto-invalidate on next `analyze-usage.js` run; no migration required.
- **Statusline cost display** now shows accumulated cost per user turn instead of per-call delta. Turn boundary detected via idle timeout (`CC_TOKEN_SAVER_TURN_IDLE_SEC`, default 60s). A $1.43 spike no longer flashes away on the next cheap tool call.

### Fixed

- **ISO date parsing bug in build-report.js**: v6 compact.txt uses full `YYYY-MM-DDTHH:MM:SSZ` timestamps, but the alert parser only handled `MM-DDTHH:MM` format — parsed year as month, placing all alerts in 2194. This caused calendar dots (alert indicators) to disappear entirely. Now handles both `YYYY-MM-DD` and `MM-DD` date formats.
- **Chart.js hardcoded colors**: All 6 charts (bar, hourly, dow, efficiency, ctxCost, ctxDist) now use CSS variable-derived `GRID_COLOR`/`TICK_COLOR` constants instead of hardcoded `#21262d`/`#8b949e`. Enables future theme support.
- **$0 window filter blocking alerts**: `finalSessions.length === 0` check was placed before alertMessages construction, causing windows with cost data but no "final sessions" to skip alert building entirely. Moved filter to after alert construction.
- `/resume` detection was never working (CC uses `display:'skip'` for resume command, so no transcript entry is ever written). `?` heuristic marker continues to detect 1h-inside cache_creation as the intended resume proxy.
- `preprocess.js`: removed legacy `+ → ++` dedup replace logic (no longer needed after semantic rename).
- **`****` cost marker accumulation bug**: the retroactive regex `$1${markers}` in `preprocess.js` kept re-marking the same user line on each of N assistant turns in a tool-heavy chain, producing literal `****` / `##**##` artefacts. Cost markers are now emitted once per API call into `timeline.csv` instead.
- **Cost underreporting on multi-turn prompts**: dashboard previously showed one random assistant row per user line via nearest-timestamp 1:1 matching. Now aggregates ALL assistant rows in the user turn, so a 7-turn $3.41 prompt reports as $3.41 total with per-turn breakdown.
- **Stale `compact.txt` during mid-session runs**: `generateMissingCompacts` in `build-report.js` only checked file existence. It now compares JSONL mtime against compact.txt mtime and regenerates when the transcript is newer.

### Removed

- Dead code: `resume`, `resumeReason`, `compact`, `compactReason` i18n keys and their rendering paths.
- Dead code: `5h-warn`/`5h-danger` alertType handlers and i18n keys (no source emits them).
- `preprocess.js` cost/ctx/heuristic/rate-limit marker emission (moved to `analyze-usage.js`).
- `preprocess.js` now no longer imports `model-pricing.json` or computes `calcCost` — all pricing logic lives in `analyze-usage.js`.

## [1.4.4] - 2026-04-14

### Changed

- Translated hardcoded Korean text to English in preprocess.js, continue/SKILL.md, report-limit/SKILL.md
- LLM prompt: enforced "context size" terminology across all 3 sections
- LLM prompt: detailed resume/compact cost explanation (re-cache vs read+summarize+re-cache)
- LLM prompt: praise mode when entire period is post-plugin-install
- LLM prompt: corrected cost warning thresholds ($0.80/$2.50)
- LLM prompt: each data section annotated with corresponding chart name

## [1.4.3] - 2026-04-14

### Added

- Hourly/DOW charts: dual average toggle — Avg (active days) / Avg (all days) / Max
- Partial-hour normalization at data boundaries (≤14 days)
- DOW: first+last day same DOW merged as one in calendar count

### Changed

- Cost thresholds (TURN_COST_WARN/DANGER, DEFAULT_COST_FILTER) centralized at file top
- costThresholds injected into REPORT_DATA for template and AI prompt use
- Default cutoff: exact time (not midnight) for 1-month-ago
- Month boundary fix: 3/31 → 2/28 via setDate(0)
- Context distribution: returns "NO DATA" when empty to prevent LLM fabrication

## [1.4.2] - 2026-04-13

### Added

- Bubble chart: grid-based density clustering (50×50) replaces scatter plot
- Model-based colors: Opus (red), Sonnet (blue), Haiku (green) with z-ordering
- CW/Non-CW/User Turn 3-mode toggle with per-model datasets
- Theoretical pricing lines per model with 3 dash styles (1h/5m/CR)
- CW mode: model checkboxes to toggle price lines on/off
- User Turn: $50 cap with red star markers for exceeded turns
- Cluster tooltip: top 3 entries with token breakdown + call count
- API pricing table added to AI prompt for accurate cost references

### Changed

- ASST_COST_FLOOR=0.05 for CW, no floor for Non-CW
- USER_TURN_COST_FLOOR=0 (include all turns)
- AI prompt section1 scoped to summary numbers only
- AI prompt section2 CW/Non-CW/Distribution consolidated

## [1.4.1] - 2026-04-13

### Fixed

- report-limit: --date filter now only includes windows for specified date
- report-limit: ratelimit.csv collected account-wide from all projects
- report-limit: ratelimit.csv filtered by window time range
- report-limit: dedup '0' falsy bug fixed in ratelimit processing
- report-limit: 7d_reset first row fill logic improved
- report-limit: window CSV header corrected (13→15 columns)
- hourlyStats avg: divide by actual active days per hour (not total days)

### Added

- Cache read alert: descriptive i18n message with context size and API call count (23 locales)
- report-limit: directory name includes milliseconds to prevent collision
- Alert: peak context size and apiCallCount per user turn
- Alert text: preserve up to 300 chars (was 120)

## [1.3.0] - 2026-04-09

### Fixed

- Marker system: session markers now accumulate instead of overwriting (e.g., `/clear` + `/model` → `@@!`)
- Marker system: rate limit path now flushes pending session markers
- Marker system: prevent `+++` edge case when `+` and `++` co-occur
- analyze-usage: `/continue` detection updated for new compact file path structure
- analyze-usage: `/continue` detection string aligned with preprocess.js (`claude-code-token-saver:continue`)
- analyze-usage: context threshold events now fire on first crossing only (matches preprocess.js)
- build-report: `matchAlertWithTimeline` no longer skips usage rows with cost/ctx event annotations
- build-report: session-marker-only alerts kept in REPORT_DATA (with `isInfoOnly` flag), filtered in UI only
- build-report: alert count in UI excludes info-only alerts
- template: cost diagnostic now sorts by estimated cost instead of token count (was using token count)
- template: cache write cost split by 1h/5m tier rates for accurate ranking
- Dead code removed: unreachable `isFirstUserMessage` resets in preprocess.js

### Added

- analyze-usage: session event detection (`/clear`, `/resume`, `/reload-plugins`, `/model`) → timeline evt column
- Compact timestamp now includes seconds (`MM-DDThh:mm:ss`) for precise alert-timeline matching
- Cost diagnostic: dedicated messages for output-dominated and input-dominated alerts (23 locales)
- Cost diagnostic: cache-read-dominated alerts fall back to generic label when ctx < 35%
- i18n: `costOutputReason`, `costInputReason` added to all 23 locales
- i18n: `ctxWarn`/`ctxDanger` updated to "cache write/read cost" across all 23 locales

## [1.2.0] - 2026-04-09

### Fixed

- Subagent timeline path resolution: `agent-` prefix mismatch in `_sessionProjectMap`
- 5m cache tier showing $0: resolved by fixing subagent token aggregation
- 5h window overlap: refactored from per-session `hourFloor` to library-based window assembly

### Added

- window-utils library: `collectActiveHours`, `buildFiveHourWindows`, `buildHourToWindowMap`
- report-limit: model indexing (`models.csv`), per-window analysis metrics, unified table

## [1.1.2] - 2026-04-09

### Fixed

- Calendar window boundary bug: partial end hours (e.g., 18:30) were excluded from the grid, causing blank cells

## [1.1.1] - 2026-04-09

### Changed

- Data storage folder renamed: `~/.claude/claude-code-token-saver/` → `~/.claude/claude-code-token-saver-data/` (avoids confusion with plugin name)
- Auto-migration: existing data folder is renamed automatically on first run

## [1.0.4] - 2026-04-09

### Added

- Shared lib modules: plan-info, constants, format, locale, pricing, window-utils (DRY across scripts)
- SessionStart hook: auto-patch statusline path on plugin update (`statusline-version-check.sh`)
- report-limit: window merging (overlapping 5h windows → single continuous period)
- report-limit: per-window token breakdown table (input, output, cache write, cache read)
- report-limit: sessions.csv index (numeric IDs + parent mapping, privacy-safe)
- report-limit: zip compression + gist upload (window + ratelimit CSVs)
- report-limit: gh auth failure guidance (`gh auth login`)
- usage-view: plan badge in HTML template title
- usage-view: monthly extrapolation only when ≤15 days
- Numbered plan selection in report-limit and usage-view skills

### Changed

- RUN indicator threshold: 🟡 ≥$0.50 → ≥$0.30 (all 23 READMEs + SKILL.md)
- report-limit: Discussion title shortened (`💀 Rate Limit Report (N windows) — $X`)
- report-limit: Discussion body uses per-window table instead of flat field list
- Plan question wording: "subscription plan" → "current plan" (inclusive of non-subscribers)

### Fixed

- Statusline path not updating on plugin version upgrade (settings.json pointed to old cache)
- Gist upload failing on zip (binary not supported) — now uploads text CSVs

## [1.0.3] - 2026-04-09

### Added

- `--plan` parameter for report-limit.js and run-usage-view.js (pro/max100/max200/team/team_premium/enterprise/bedrock/foundry/vertex)
- Plan-aware AI analysis: flat-rate plans get rate limit management advice, usage-based plans get cost optimization guidance
- Plan comparison table in AI prompt for upgrade/downgrade recommendations
- Weekly rate limit display in statusline: `[W🟡] 65% ⏳1d3h30m` (shown at ≥60%, danger at ≥90%)

### Changed

- report-limit.js: standalone Node script replacing inline SKILL.md code (zero LLM involvement)
- report-limit: filter to `limit_hit_5h` + `limit_hit_unknown` only (skip weekly)
- Discussion category target: `rate-limits`
- SKILL.md for report-limit and usage-view: ask user's plan before execution

## [1.0.2] - 2026-04-09

### Fixed

- Rate limit count: count blocked windows instead of individual hours (skulls now match AI analysis count)
- Renamed `blockedHours` → `blockedWindows` for clarity

## [1.0.1] - 2026-04-09

### Added

- Rate limit markers in preprocess.js (`%%`/`%5`/`%W`/`%O`/`%S`/`%X`) with reset time parsing
- `evt` column in timeline CSV (cost/context/session events, pipe-separated)
- Win correction using ratelimit CSV boundaries in build-report.js
- Skull (💀) rendering on calendar for rate-limited hours
- Gist-based data upload in report-limit skill

### Changed

- analyze-usage.js: 1-pass refactor (removed 2-pass win assignment)
- ALERT_LINE_RE simplified to single-group capture
- report-limit: `startsWith('limit_hit')` matching for new rl format

### Fixed

- CSV comma collision in reset info: `{2am,Asia/Seoul}` → `{2am@Asia/Seoul}`

## [1.0.0] - 2026-04-08

### Added

- **/usage-view** — Interactive HTML dashboard showing token usage, costs, and 5-hour window timeline
  - AI-powered cost analysis and work pattern insights
  - Daily cost calendar with rate limit detection
  - Session detail cards with token breakdown and donut charts
  - 23-language support (auto-detected from system locale)
  - RTL support for Arabic and Hebrew
  - `current` mode for live 5-hour window analysis
- **/continue** — Zero-cost session context restoration from previous sessions
  - Preprocessed transcript caching with line-number markers
  - Default (200/100) and aggressive (50/20) truncation modes
  - Multi-session selection with size-aware variant switching
- **/setup-statusline** — Real-time token counter in Claude Code status bar
  - Input/output/cache token counts per turn
  - Cumulative session cost and 5-hour window cost
  - Context size percentage indicator
- **/report-limit** — Rate limit data collection for community research
  - Automatic 5-hour window snapshot extraction
  - Privacy-safe data sanitization
  - GitHub Discussion submission with pre-filled template
- **Token Guardian hook** — Cache expiry detection on every prompt
  - 23-language warning messages
  - Actionable options: /compact, /clear + /continue, or ignore
- **model-pricing.json** — Token cost data for all Claude models
  - Input, output, cache write (5m/1h), cache read prices
  - Auto-fallback for unknown models

[1.0.1]: https://github.com/ww-w-ai/claude-code-token-saver/releases/tag/v1.0.1
[1.0.0]: https://github.com/ww-w-ai/claude-code-token-saver/releases/tag/v1.0.0
