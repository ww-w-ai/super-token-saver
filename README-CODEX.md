# super-token-saver for Codex

[English](./README-CODEX.md) · [한국어](./README-CODEX.ko.md) · [日本語](./README-CODEX.ja.md) · [简体中文](./README-CODEX.zh-Hans.md)

> Your last session ran out of budget mid-sprint. Everything it learned is still on disk — in a file no tool will read for you.

Codex writes every session to `~/.codex/sessions/`. Claude Code writes every session to `~/.claude/projects/`. Neither tool reads the other's, and the usual way back — asking the model to summarize what happened — costs a full context window before you have typed a single instruction.

**This plugin reads the transcripts instead.** `/s-continue` restores a prior session from either tool by parsing its JSONL directly: no summarization call, no token spend, and every restored turn carries a `L{n}` marker that addresses the exact line of the original rollout, so you can pull the full text of anything that was truncated.

## What you get

| Skill | Use it when you need to… |
|---|---|
| `s-continue` | Restore a previous Claude Code **or** Codex session — pick from a list, or jump straight to the last one. |
| `s-compact` | Write a handoff before you clear, capturing what the transcript cannot hold: subagent findings, tool-output numbers, killed approaches. |

The handoff is stored per project, not per tool. End a sprint in Codex, pick it up in Claude Code, and the file is already there. Go back the other way and it still is. No other plugin restores both tools' history, so when one side runs out of budget the other picks up from the same line.

## Why it fits Codex

- **Codex compaction is understood, not ignored.** A rollout that hit auto-compact is restored from its pre-compaction content — the part that is no longer in the model's head — instead of re-reading what it already knows.
- **Subagent rollouts are filtered out.** In Codex a spawned subagent inherits its parent's `session_id`, so three files can claim one id. Sessions are keyed on `payload.id` and only the ones you actually typed in appear in the list.
- **Goal-control prompts do not masquerade as your instructions.** `<codex_internal_context source="goal">` is machine-injected; it is kept in the restored context but never counted as a turn you wrote.
- **One parser, both tools.** A Codex rollout is rewritten into the shape Claude Code writes, one output line per input line, so the same code path serves both and line numbers still point at your original file.
- **Host-specific hooks.** Codex receives Codex-native session guidance and compact restoration without running Claude Code's prompt-cache, statusline, or git-context hooks.
- **No install step.** Node only — no npm dependencies, no build.

Measured on a real rollout: a 12 MB, 1,540-line Codex session preprocesses in 0.13 s.

## Install

```
codex plugin marketplace add ww-w-ai/marketplace
codex plugin add super-token-saver@ww-w-ai
```

Verify and upgrade:

```
codex plugin list
codex plugin marketplace upgrade ww-w-ai
```

## Use

```
/s-continue           list this project's sessions from both tools, pick what to restore
/s-continue last      restore the most recent one
/s-continue codex     restrict the list to Codex sessions
/s-continue codex : rust migration      restore the turns that match a topic, in full
/s-compact            write the handoff for whoever comes next
```

## Restored after compaction, without being asked

When the host compacts on its own, the plugin's after-compact hook puts the dropped turns back
before you type anything: your turns, the model's replies, teammate messages and subagent notices,
verbatim, with only tool calls left out. It keeps a per-session ledger, so a run that spans several
compactions — or several sessions of the same project — carries its earlier turns forward, folded,
within a token budget. Every line keeps its `L{n}` marker into the original rollout.

`/s-continue` restores every turn of the sessions you select; long turns keep their first and last
24 replies as stored and shorten the rest to 50 characters, and nothing is dropped.

`CODEX_HOME` is honoured if you keep Codex state somewhere other than `~/.codex`.

The skill names are the same on both hosts, so a command you learn in one works in the other.

## What it does not do

`usage-view` reads Codex sessions. Because a Codex subscription bills in purchased credits rather than per token, it reports the credit equivalent of what a session used, not a dollar bill. `report-limit` is Claude Code only for now — Codex records its rate limit in the rollout outright, so that one is a port that has not happened yet, not a limitation. `setup-statusline` is a different case: Codex already has its own status line, configured through `status_line` in `config.toml`.

## License

Apache-2.0. See [LICENSE](./LICENSE).
