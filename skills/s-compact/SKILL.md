---
name: s-compact
description: 'Session handoff for the next session — write-side pair of /s-continue. Triggers on "s-compact", "session handoff", "handoff prompt", "hand off", "wrap up the session", "prep for next session". Distills what /s-continue cannot recover: subagent findings, tool-output numbers, and decisions that never entered the user↔assistant dialogue. Saves to a per-project file /s-continue auto-loads.'
when_to_use: Use at the END of a working session to hand off to the next one — whenever the user says to wrap up, prep a handoff, or is about to /clear, including when handing work from Claude Code to Codex or back. Pairs with /s-continue (end with s-compact → start with s-continue).
---

Generate a **session handoff**: a document that lets the NEXT session pick up with full context and zero re-derivation — in EITHER tool. The handoff is stored per project, not per tool, so a session ended in Claude Code is picked up by Codex and the reverse.

 `/s-continue` restores the transcript (user↔assistant messages); **this skill captures what the transcript does NOT hold** and saves it where `/s-continue` auto-loads it.

**ONE JOB: distill the non-dialogue knowledge. The transcript is already restorable — do not re-summarize it.**

The two tools form a ladder of recovery:
- **`/s-continue` alone** → fast, accurate context restore with no wasted `/compact` tokens (the transcript).
- **`/s-compact` + `/s-continue` as a set** → ALSO recovers the hidden results and process that never appeared in the dialogue (subagent findings, tool-output numbers, process lessons). That extra layer is THIS skill's entire reason to exist — so it must be captured in FULL, not gestured at.

**A terse handoff is a FAILED handoff.** The common failure mode is a handoff too short to carry the hidden layer — a few bullets that just restate what the transcript already has. This skill exists precisely because that is not enough. Favor completeness of the non-dialogue layer over brevity; the token cost of `/s-compact` is paid back many times over by the next session not re-running the same subagents and tool calls.

## Help

**ONLY if the user's argument literally contains "help" (e.g. `/s-compact help`).** Otherwise skip to Step 1.

```
/s-compact — Write a session handoff for the next session (pairs with /s-continue)

  /s-compact            Generate the handoff, save it, print it, copy to clipboard
  /s-compact help       This help

The handoff is saved to  ~/.claude/super-token-saver-data/<project>/handoff.md
On the next session, /s-continue restores the transcript AND auto-loads this file.
The path is shared by both tools, so the next session can be Claude Code or Codex.
Workflow:  end a session → /s-compact   ·   start the next → /s-continue
```

## Language

Write the handoff in the language the user has been working in (detect from the recent conversation). Section labels may stay English; the content matches the user's language.

## The principle — capture what `/s-continue` cannot recover

`/s-continue` reads the transcript, so anything **said between the user and the assistant** is already restorable. Test for each fact: *"Is this in the sentences the user and I exchanged, or only in a tool output / subagent reply?"* If the latter, it is invisible to `/s-continue` and MUST be lifted into the handoff.

**Truth lives in source, not the handoff.** Where a durable artifact exists (a plan doc, as-built, status file, commit), POINT to it and say "read this first, don't trust this prompt" — a copied fact goes stale. Only facts that live *nowhere but* a tool result / subagent reply get written into the body directly.

## MANDATORY extraction — cover ALL of these, do not sample

The non-dialogue layer (handoff part 4) is the point of this skill, so its coverage is not optional. Walk the ENTIRE session and extract every item in each category below — enumerate, do not summarize-away. If a category is genuinely empty this session, write "none" for it explicitly (so the next session knows it was checked, not skipped).

1. **Every delegated-work report this session — one entry each.** This covers both Task/Agent subagent runs and SendMessage teammate reports (`<teammate-message>`), plus subagent completion notices (`<task-notification>`). For each: what it was asked, its concrete findings (facts, numbers, `file:line` anchors), its verdict, and **what it could NOT do / flagged as a gap**. These live in separate subagent transcripts or in messages that `/s-continue` deliberately drops from `compact.txt` (teammate reports, subagent notices and idle notifications are excluded from the dialogue layer) — if you don't extract them here, they are gone. Missing one is the #1 way this handoff fails.
2. **Every decisive number or fact from tool output.** Test counts, benchmarks, measurements, grep results, build outcomes, version/config facts (e.g. "279→529 tests", "45ms→301ms", "style X has no fill field"). If it decided something and only appeared in a tool result, it goes here.
3. **Every process-learned lesson.** Meta-facts that only surfaced by running tools: "couldn't reproduce headless → cause was the build, not the code"; "this check passes but can't see X"; "the probe measures only top-level, not cell content". These stop the next session repeating a dead end.
4. **Every abandoned/reverted approach**, with the one-line evidence that killed it (so it isn't re-tried).
5. **Every artifact this session produced that isn't a committed source file** — scratch scripts, temp measurements, research docs, generated data — with its path and one-line purpose.
6. **Every deferred decision / known issue / open gap** raised in tool work or subagent replies that the dialogue didn't resolve.

Before saving, self-check against this list. If part 4 of the handoff is only a few lines while the session ran multiple subagents or many tool calls, **you have under-extracted — go back and enumerate.**

## Red flags — STOP and expand if you catch yourself thinking

| Thought | Reality |
|---|---|
| "This is basically what the transcript says" | Then it's redundant — cut it and extract the NON-dialogue facts instead. |
| "A few bullets is enough" | Not if subagents ran. Each subagent needs its own entry. Under-extraction is the default failure. |
| "The subagent's report is in the conversation somewhere" | Its INTERNAL work isn't. Only what you quoted into the dialogue survives — extract the rest now. |
| "I'll just point to the files" | Point for durable source. But facts that live only in a tool result have no file to point to — write them out. |
| "This number isn't important" | If it decided a direction or proves a state, it is. Include it with its context. |

## Step 1: Account for spawned processes

Before writing, check what THIS session started, and decide keep-vs-kill by one question — **"does the next session continue with this process?"**:

- **Yes → do NOT kill; hand it off.** A long-lived dev server, a `--remote-debugging-port` browser, a watch/runner the next session reuses — record it (PID · LISTEN port · cwd · purpose · restart command) so the next session doesn't re-pay startup/login or collide on the port.
- **No → reclaim the one-off.** A process spawned only for finished work, that the next session won't use, gets cleaned up to avoid orphans.
- Never touch processes the USER started (their editor, their servers). Report what was kept vs reclaimed.

Identify with `pgrep -fl` / `lsof -ti :PORT`.

## Step 2: Write the handoff (this fixed structure)

Compose the handoff with these six parts, in order:

1. **Read-first sources (pointers, no duplication).** Durable state (as-built, plan docs, status, commit hashes) is owned by the repo — point to it and say "re-verify against `git log` / these docs; don't trust this prompt." Copying facts here makes them go stale.
2. **Entry state + verify.** Tool this session ran in (Claude Code or Codex) · branch · HEAD hash · working-tree status · green baseline (test/build numbers) · deploy state — each with "don't trust, re-run to confirm." Name the tool because the next session may be the other one, and anything tool-specific (a skill name, a plugin path, a goal id) has to be translated rather than pasted.
3. **This session, done (conclusion + de-noised build-up).** Strip the back-and-forth. Keep the final conclusion and only the build-up that led to it. Name reverted detours as "noise, final = X."
4. **★ Non-dialogue distillation (the heart).** Fill this from the MANDATORY extraction checklist above — every subagent, every decisive number, every process lesson, every killed approach, every non-committed artifact, every open gap. This is what `/s-continue` cannot recover; if it is thin, the handoff has failed. Enumerate, don't sample.
5. **Next-session work (detailed, paste-ready).** Separate from "done." Per item: *why* · *already-decided values (so they aren't re-litigated)* · *exact anchors (file:line)* · *paste-ready code/spec already produced* · *definition-of-done + verify command* · *size (do-inline / one-feature / multi-sprint)*.
6. **First move.** One concrete starting point, so the next session spends zero tokens searching.

Plus, up front: **process status** from Step 1 (kept-and-reusable: port/PID/restart · reclaimed/none) so the next session avoids port collisions and needless restarts.

Keep it tight: pointers over copies, conclusions over transcripts, distilled non-dialogue facts in full.

## Step 3: Save, print, copy

Save to the per-project path `/s-continue` auto-loads, and also surface it for the human:

```bash
PROJECT_HASH=$(echo "${PWD}" | sed 's/[^a-zA-Z0-9]/-/g')
DATA_DIR="${HOME}/.claude/super-token-saver-data/${PROJECT_HASH}"
mkdir -p "${DATA_DIR}"
# Write the composed handoff to handoff.md (author it to a temp file first, then move):
#   cat > /tmp/cc-handoff.md <<'HANDOFF' ... HANDOFF
cp /tmp/cc-handoff.md "${DATA_DIR}/handoff.md"
cat "${DATA_DIR}/handoff.md" | pbcopy 2>/dev/null || true    # macOS clipboard; ignore if absent
echo "Saved handoff → ${DATA_DIR}/handoff.md"
```

- Write the handoff to a temp file, then `cp` it to `${DATA_DIR}/handoff.md` (the exact path `/s-continue` looks for).
- Copy to the clipboard when `pbcopy` exists (macOS), so the user can paste it anywhere. Never fail the skill if `pbcopy` is missing.
- **Do NOT commit the handoff to the repo.** It is ephemeral and per-project; committing it leaves stale noise. It lives only in the data dir (and the clipboard).

## Step 4: Confirm

Print the saved path and a one-line note: the next session should run `/s-continue`, which restores the transcript AND auto-loads this handoff. Show the handoff body in the conversation too (the user often reads it before clearing).

## Output Rules

- The handoff's six-part structure is the ONLY permitted shape — fill it, don't invent sections.
- No cost estimates, token counts, or savings figures.
- Pointers for anything durable; full text only for non-dialogue facts that live nowhere else.
- Never commit the handoff file.
