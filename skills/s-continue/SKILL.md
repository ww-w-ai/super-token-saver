---
name: s-continue
description: 'Cheaper and faster than /compact. Restores previous session context from Claude Code AND Codex transcripts by reading them directly — no LLM calls, no token cost. Also auto-loads a handoff written by /s-compact, if one exists. Triggers on "s-continue", "restore context", "what was I doing", "pick up where I left off", "resume work", "previous session", "codex session".'
when_to_use: Use when starting a new session and want to pick up previous work, including work left unfinished in Codex — the read-side pair of /s-compact (end a session with /s-compact → start the next with /s-continue). Triggers on "s-continue", "restore context", "what was I doing", "pick up where I left off", "resume work", "previous session", "codex session".
---

Restore context from previous sessions so the user can pick up where they left off — without the cost of /compact.

**Two tools, one history.** Sessions come from Claude Code (`~/.claude/projects/`) and from Codex
(`~/.codex/sessions/`). A Codex rollout is rewritten into the shape Claude Code writes, one output
line per input line, so both are read by the same code and an `L{n}` marker still points at the
Codex original's line. Work stopped in one tool is therefore resumable in the other.

## Help

**ONLY show help if the user's argument literally contains the word "help" (e.g. `/s-continue help`). If no argument or any other argument is given, SKIP this section entirely and proceed to Step 1.**

If the user provides "help" as argument, show usage summary and stop:

```
/s-continue — Restore context from previous sessions (zero LLM calls)

Options:
  (nothing)     Show session list (Claude Code + Codex), pick which to restore
                  - Current session with context-loss events appears as #0 [default]
                  - Press Enter to restore just #0, or add more numbers
  last          Quick restore:
                  - Current session if it had /compact or auto-compact
                  - Otherwise, most recent other session
  claude|codex  Restrict the list to one tool
  --level N     How much to restore (1-3). Default 3.
                  1  headline  — user turns only, no assistant text
                  2  recent    — full detail, last 15 turns
                  3  full      — everything (+ topic restoration)
  help          Show this help

Examples:
  /s-continue
  /s-continue last --level 1
  /s-continue codex
  /s-continue codex : rust migration
```

Do not run any analysis or restoration. Just display the help text and stop.

## Restore Levels

Restoring costs context. How much you need depends on how much you still have.

| Level | Name | User turns | Replies at each end | Replies in the middle | Measured | Use when |
|---|---|---|---|---|---|---|
| **1** | headline | last 30, cut to 150 + 100 | first 6 + last 6, at 100 chars | 50 chars | **6.2 K tok** | **After auto-compact.** A summary is already in context; you need the thread of what was asked and roughly what you answered. |
| **2** | recent | last 30, as stored | first 12 + last 12, as stored | 50 chars | **9.3 K tok** | Resuming mid-task and the recent replies matter in more detail. |
| **3** | full | all of them | first 24 + last 24, as stored | 50 chars | **44.3 K tok** | After `/clear`, restoring a DIFFERENT session, or when early-session decisions matter. |

**No reply is ever dropped.** Every one of them appears at every level — the middle of a long turn
is shortened to 50 chars, not removed. That is enough to read the run as a history and decide
whether to go get the rest.

Measured on one 170-turn session. **Levels change how much of each turn you read and how far back
you go — they do NOT get you closer to the original text.**

## What is already gone before you pick a level

`compact.txt` is a preview, not a transcript. The preprocessor truncated it when it was built:

| | Threshold | Kept |
|---|---|---|
| User message | 500 chars | first **300** + `..[N lines omitted]..` + last **200** |
| Assistant reply | 200 chars | first **100** + `[...truncated...]` + last **100** |

So no level returns a full assistant answer. **The only path back to real original text is
`--level 3` WITH a topic** (Step 5), which re-reads the matched turns from the JSONL at up to
3,000 chars each — and only for the top 20 turns that match the topic.

## Autonomous runs invert the levels

Everything above is anchored on USER turns. During an autonomous run (cowork-sprint, pdca-wf, a
Workflow) the user says almost nothing while the assistant answers many times per turn — measured
on one session: median 1 reply per user turn, but 23 / 20 / 15 in the autonomous stretch.

This is why **every** level caps replies per turn, level 3 included. Without it one user turn is
unbounded — 60 replies under a single message measured 27 KB on its own, and level 1 could come out
larger than level 3. With the cap that same turn is 4.0 / 12.9 / 22.3 KB.

The `# compact-format:` preamble and the trailing `# Session references:` footer survive every
level. On a Codex session that footer names the original rollout — it is the only line saying which
file an `L{n}` marker addresses, so dropping it breaks recovery. Measured end to end on a real
Codex session: 4.3 / 7.5 / 7.5 K tokens, footer intact at all three.

The middle is shortened, never discarded, so nothing goes silently missing. To pull a shortened
reply back in full: the `-> N AI responses at lines X-Y` line directly above the turn gives the
JSONL range, and the reply's own number is its position within it — read that range from the
original transcript and count to it.

- **Level 1 holds up.** Bounded on both axes — 30 turns, and a per-turn cap regardless of reply count.
  Sparse user turns are an advantage: 30 of them can span the whole run.
- **Level 2 partly collapses into level 3.** If the session has fewer than 30 user turns its slice
  starts at block 0, so it reads every turn — only the reply-width caps still separate them.

**After an autonomous run, level 1 is the level that actually saves anything.**

**Default is 3** when no `--level` is given — the caller asked to restore, so restore everything.

**Every bound on level 1 is load-bearing.** Turn count, user head/tail, and the assistant cap. Drop
any one and a session with long pasted turns makes level 1 bigger than level 2 — measured, 31 KB vs
14 KB before the caps went in.

**Level 1 is not a lossy restore.** Every line keeps its `L{n}` marker, so a truncated turn is read
back in full from the original transcript on demand. Nothing is discarded — it is left on disk with
a pointer to it. Start low and go deeper only if something is actually missing.

Levels never change which SESSIONS are selected — only how deeply each one is read.

## Language

Detect the user's language from their message accompanying the /s-continue invocation. If no message was provided (bare `/s-continue`), detect the dominant language from the session list's firstMsg/lastMsg content after Step 1 runs. All UI messages (session list header, selection prompt, progress updates, final reference note) MUST be in the detected language. The examples below are in English — translate naturally, don't transliterate.

## Quick Restore: `/s-continue last`

If the user invoked `/s-continue last`, skip the session list entirely. A `--level N` given
alongside `last` still applies — it is read in Step 2 and used in Step 4. Run list-sessions with `--limit 3` (same flags as Step 1). Then pick automatically based on the `isCurrent` and `hasContextLoss` fields:

- **If the current session has context-loss** (`isCurrent: true` AND `hasContextLoss: true`) → auto-pick the CURRENT session. Its pre-context-loss content is what needs restoration.
- **Otherwise** → auto-pick the most recent session where `isCurrent: false` (the previous session).
- **If no valid target** (current session has no context-loss AND no previous sessions exist) → print "No previous sessions found in this project." and stop.

Jump directly to Step 3 with the selected session. No user prompt needed.

## Step 1: List & Select

If `/s-continue last` was used, skip this step (see above).

Run the list-sessions script to get main sessions only (subtask/system-only sessions are filtered out). Requires Node.js.

```bash
PROJECT_HASH=$(echo "${PWD}" | sed 's/[^a-zA-Z0-9]/-/g')
TRANSCRIPTS_DIR="${HOME}/.claude/projects/${PROJECT_HASH}"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-${CODEX_PLUGIN_ROOT}}"
node "${PLUGIN_ROOT}/scripts/list-sessions.js" "${TRANSCRIPTS_DIR}" \
  --source all --cwd "${PWD}" --current-source claude --limit 11 --offset 0
```

**Resolving `PLUGIN_ROOT`.** Claude Code exports `CLAUDE_PLUGIN_ROOT`; Codex does not always export
`CODEX_PLUGIN_ROOT`. If both are empty, use the directory that contains THIS `SKILL.md`, two levels
up — the host tells you that path when it loads the skill. Do not guess an install location.

When this skill runs under Codex, pass `--current-source codex` instead of `claude` in every command
below.

`--current-source` names the tool this skill is running in, so `isCurrent` marks the session being
written right now instead of whichever transcript happens to be newest. `--source` takes `all`
(default for this skill), `claude`, or `codex`. Pass `codex` or `claude` when
the user named one tool. Codex keeps every session in one global tree, so `--cwd` is what scopes them
to this project; Codex subagent rollouts are excluded, the same way Claude subtask transcripts are.

Each result carries `source` (`claude` | `codex`) and, for Codex, `originalPath` (the rollout the
line numbers belong to) alongside `path` (the normalized copy the other scripts read).

The script outputs JSON. If the script returns an empty array, display "No previous sessions found in this project." and stop.

**Current session identification**: The script sets `isCurrent: true` on the session whose JSONL is most recently modified (the one being actively written). This is reliable even after auto-compact (unlike firstMsg comparison, which fails because the LLM's first visible message becomes the summary).

**Case A/B/C/D list display**:
- Look at the session with `isCurrent: true`:
  - If `hasContextLoss: true` → **display it as #0 [default]** (with `📍` marker plus any `@@`/`+`/`++` event badges). #1..N are other sessions.
  - If `hasContextLoss: false` → **exclude it entirely from the list** (its full content is in live memory, nothing to restore). #1..N are other sessions.
- If no other sessions exist and current has context-loss → **auto-restore current session, skip list display** (Case C).
- If no other sessions exist and current has no context-loss → print "No previous sessions found in this project." and stop (Case D).

Format each session for display (preserve existing Case A/B/C/D logic — current session #0 with context-loss marker, etc.):

```
📂 Found {N} previous sessions in this project (Claude Code + Codex).

Pick the ones you want to restore — Claude will read them and bring the
context into this session so you can continue where you left off.

💡 Tip: Selecting 1-2 sessions is fast (almost always faster than /compact).
   Selecting many sessions takes longer, but still no LLM summarization needed.

| # | Tool | Started | Last active | First message | Last message | Size |
|---|------|---------|-------------|---------------|--------------|------|
| 1 | CC | Mar 31 09:00 | today 14:05 | "improve the skill..." | "ok go ahead..." | 122KB · 3 msgs |
| 2 | Codex | Mar 31 08:30 | today 13:59 | "local agent actually..." | "let me test the skill..." | 2.1MB · 82 msgs |
| ... | | | | | | |

Enter:
  - numbers only (e.g., "1,3" or "1-4") — fast restore
  - numbers + ":" + topic (e.g., "1,3 : PDCA implementation") — topic-based restore (slower, more accurate)
  - "more" for pagination
  - (empty) for default

💡 Topic search adds an LLM step so it takes longer, but restores specific memories more accurately.
```

Use `--limit N` and `--offset N` for pagination. When the user types "more", re-run list-sessions with `--offset` increased by 10 (the limit). Numbers continue sequentially across pages.

Wait for user selection before proceeding. This avoids preprocessing sessions the user doesn't need.

## Step 2: Parse Input

First, strip any `--level N` (or `-lN`) token from anywhere in the argument and record it. If none
is present, level = 3. It is orthogonal to everything else below.

Next, if the remaining ARGUMENT is `claude` or `codex` (alone or before a `:` topic), that
is a source filter, not a selection — re-run Step 1 with `--source claude` or `--source codex` and
show the narrowed list.

Then split the rest on the first `:`:

- Left side → numbers part. Parse using existing Case A/B/C/D logic (additive with #0, ranges, comma lists).
- Right side (optional) → topic string (trim whitespace). May be absent.

Examples:
- `1,3` → sessions [1, 3], no topic
- `1-4 : PDCA implementation` → sessions [1, 2, 3, 4], topic = "PDCA implementation"
- `: error handling` → only #0 (default), topic = "error handling"
- `` (empty) → default selection, no topic
- `last --level 1` → quick restore, headline only
- `1,3 --level 2 : auth bug` → sessions [1, 3], level 2, topic = "auth bug"

## Step 3: Ensure Cache & Preprocess

preprocess.js is self-managing: it derives the cache path from the JSONL path, checks format version + mtime, and skips if fresh. Just call it for each selected session.

```bash
# For each selected session: ensure compact.txt cache is fresh.
# TRANSCRIPT_PATH is the `path` field from list-sessions.
node "${PLUGIN_ROOT}/scripts/preprocess.js" "${TRANSCRIPT_PATH}"

# Codex sessions only — name the rollout the L{n} markers belong to, so the
# footer points a reader at the real file instead of the normalized copy:
node "${PLUGIN_ROOT}/scripts/preprocess.js" "${TRANSCRIPT_PATH}" --original "${ORIGINAL_PATH}"
```

The cache file is at (Claude Code sessions; a Codex session's cache is the same path with
`codex/` inserted after `super-token-saver-data/` — `restore.js` resolves both, so only build
this by hand to inspect the cache):
```bash
PROJECT_HASH=$(echo "${PWD}" | sed 's/[^a-zA-Z0-9]/-/g')
CACHE_FILE="${HOME}/.claude/super-token-saver-data/${PROJECT_HASH}/${SESSION_ID}/compact.txt"
```

**Current session with context-loss**: The compact.txt contains the FULL session. When reading it, use `lastContextLossLine` from list-sessions.js to filter: only read entries where `L{n} < lastContextLossLine`. Content after the last context-loss event is already in live LLM memory.

`restore.js --before-boundary` (Step 4) already does this cut, and finds the boundary from the
compact file's own `System: "[auto-compact boundary]"` block rather than from a line number — so
Step 4 alone is enough and this step is only worth running on its own to inspect the cache.

**Current session WITHOUT context-loss**: Skip — entire session is in live memory.

**Past sessions**: Read the full compact.txt (none of their content is in live memory).

The preprocessor (v6) outputs a compact text transcript with `[Session:{sid} {ISO} L{n}]` headers. The `L{n}` is the JSONL line number of the user message — this enables direct seek into the original transcript for topic-based restoration.

Preprocessing is instant (< 1 second even for 60MB+ transcripts).

## Step 4: Load Compact

What you read depends on the level from Step 2 (default 3). Slice mechanically first — no LLM cost —
then read only the slice.

Compact text is a sequence of blocks, each starting with a `[Session:...]` header line. Cut on that
boundary, never on raw line counts, or a turn gets split in half.

```bash
# TRANSCRIPT = the `path` field from list-sessions (for Codex, that is the rollout —
#              restore.js normalizes it and keeps the original's line numbers).
# --before-boundary cuts everything from the LAST compaction onward, which is what a
#   compacted current session needs; leave it off to render a whole past session.
node "${PLUGIN_ROOT}/scripts/restore.js" "${TRANSCRIPT}" \
  --level "${LEVEL}" [--before-boundary] --out "${OUT}"
```

`restore.js` owns the slicing, refreshes the compact cache first (so Step 3 is folded in), and is
the same code the after-compact hook runs unattended. Do not reimplement the slicing here — one
rule with two copies is how this skill and that hook drifted apart once already.

Then:

- **Level 1 or 2** → Read the sliced file with the Read tool (chunk with offset/limit if needed).
  Read it in full — the slice already did the trimming. Skip Step 5 entirely: topic restoration
  reopens original JSONL turns, which contradicts a deliberately shallow restore. If the user passed
  BOTH a topic and level 1 or 2, honour the topic and treat the level as 3 — an explicit topic means
  they want depth on that subject.
- **Level 3, no topic** → Read the whole file. For files over ~10K tokens read in chunks using
  offset/limit. Always read the ENTIRE file — never skip sections. Proceed to Step 6.
- **Level 3, topic provided** → Do NOT Read compact.txt yet. Proceed to Step 5.

## Step 5: Topic-Based Original Restoration

**Goal**: Load compact.txt with the top 20 most topic-relevant truncated turns replaced by their full JSONL originals. The original compact.txt files are never modified — the assembled result is written to a temp file.

### Step 5a: Extract user turn list

Extract all user message headers from compact.txt files programmatically (no LLM Read needed):

```bash
python3 << 'PYEOF'
import json, os, re

sessions = [
    # (session_id, compact_path) — dynamically populated
]

results = []
for sid, path in sessions:
    with open(os.path.expanduser(path)) as f:
        content = f.read()
    for m in re.finditer(
        r'\[Session:([a-f0-9]+) (\S+) L(\d+)\].*?User: "(.*?)"',
        content
    ):
        results.append({
            "sid": m.group(1),
            "ts": m.group(2),
            "line": int(m.group(3)),
            "msg": m.group(4)[:300]
        })

print(json.dumps(results, ensure_ascii=False))
PYEOF
```

### Step 5b: LLM selects top 20

Read the JSON output from Step 5a. For each user turn, judge topic relevance. Select the **top 20 most relevant** turns (by topic match strength). Output a list of `(sid, line)` pairs.

If fewer than 20 turns match, include only those that match. If zero match, skip to Step 4 no-topic path (load compact as-is).

### Step 5c: Batch extract originals

Extract all 20 matched turns' originals from JSONL files in **a single python script** (one pass per JSONL file):

**`jsonl_path` is the `path` field from list-sessions, never `originalPath`.** For a Codex session
those differ: the extractor below parses the shape Claude Code writes, so handing it the raw Codex
rollout produces empty user text instead of an error — a silent, plausible-looking failure. The
normalized copy carries the same line numbers, so `L{n}` still lands on the right turn.

```bash
python3 << 'PYEOF'
import json, sys

# Dynamically populated: { "sid": { "jsonl_path": "...", "lines": [40, 83, ...] } }
# jsonl_path = list-sessions `path` (the normalized copy for Codex), NOT `originalPath`.
extractions = {}

results = {}
for sid, info in extractions.items():
    target_lines = set(info["lines"])
    all_lines = {}
    with open(info["jsonl_path"]) as f:
        for i, raw in enumerate(f, 1):
            if i in target_lines or any(i > t for t in target_lines):
                all_lines[i] = raw

    for target_line in info["lines"]:
        d = json.loads(all_lines.get(target_line, '{}'))
        # Extract user content
        content = d.get("message", {}).get("content", "")
        if isinstance(content, list):
            user_text = " ".join(
                b["text"] for b in content
                if isinstance(b, dict) and b.get("type") == "text"
            )[:3000]
        else:
            user_text = str(content)[:3000]

        # Find assistant responses until next user turn
        assistants = []
        for j in range(target_line + 1, target_line + 100):
            if j not in all_lines:
                continue
            row = json.loads(all_lines[j])
            if row.get("type") == "user":
                break
            msg = row.get("message", {})
            if msg.get("role") == "assistant":
                texts = []
                for b in (msg.get("content", []) if isinstance(msg.get("content"), list) else []):
                    if isinstance(b, dict) and b.get("type") == "text" and b.get("text", "").strip():
                        texts.append(b["text"][:3000])
                if texts:
                    assistants.append("\n".join(texts))

        key = f"{sid}_L{target_line}"
        results[key] = {"user": user_text, "assistants": assistants}

# Write to temp file
output_path = "/tmp/continue-originals.json"
with open(output_path, "w") as f:
    json.dump(results, f, ensure_ascii=False)
print(f"Extracted {len(results)} turns to {output_path}")
PYEOF
```

### Step 5d: Assemble temp file

Build the restored document by iterating compact.txt in order, replacing matched turns inline:

```bash
python3 << 'PYEOF'
import json, re, os

# Inputs (dynamically populated)
compact_paths = []  # ordered list of compact.txt paths
originals_path = "/tmp/continue-originals.json"
output_path = "/tmp/continue-restored.txt"

with open(originals_path) as f:
    originals = json.load(f)

matched_keys = set(originals.keys())

with open(output_path, "w") as out:
    for cpath in compact_paths:
        with open(os.path.expanduser(cpath)) as f:
            lines = f.readlines()

        i = 0
        while i < len(lines):
            line = lines[i]
            # Check if this is a user turn header
            m = re.match(
                r'\[Session:([a-f0-9]+) \S+ L(\d+)\]',
                line
            )
            if m:
                key = f"{m.group(1)}_L{m.group(2)}"
                if key in matched_keys:
                    orig = originals[key]
                    # Write header line as-is
                    out.write(line)
                    i += 1
                    # Write "-> N AI responses" line as-is
                    if i < len(lines) and lines[i].startswith("->"):
                        out.write(lines[i])
                        i += 1
                    # Replace numbered AI response lines with originals
                    ai_idx = 0
                    while i < len(lines) and re.match(r'\d+\.', lines[i]):
                        if ai_idx < len(orig["assistants"]):
                            out.write(f'{ai_idx + 1}. "{orig["assistants"][ai_idx]}"\n')
                        else:
                            out.write(lines[i])
                        ai_idx += 1
                        i += 1
                    continue
            out.write(line)
            i += 1

print(f"Assembled to {output_path} ({os.path.getsize(output_path)} bytes)")
PYEOF
```

### Step 5e: Read restored file

Read the temp file (`/tmp/continue-restored.txt`) into conversation context using the Read tool. Use offset/limit chunks for large files. Then proceed to Step 6.

**Important**: The temp file is ephemeral — it may differ each time `/s-continue` is invoked with a different topic. The original compact.txt files remain unchanged.

## Step 6: Final Completion Message

After restoration (whether 5A or 5B), produce the completion message.

### Git history (optional)

If git is available, append commit history for the time range. Use the earliest `firstActive` among selected sessions as FROM, and the latest `lastActive` as TO:

```bash
git log --since="${FROM}" --until="${TO}" --format="%h %aI %s" --stat --no-merges 2>/dev/null
```

### Last active context

You MUST review the last 5 messages from the restored context and provide a "Last 5 messages" section. Without it, the user has to ask "what was I doing?" separately, which defeats the purpose of /s-continue.

1. **Last 5 messages (where you left off):** When sessions from both tools were restored, label each line with its tool. Show the last 5 **USER messages ONLY** (lines starting with `[Session:`) with `[Session:{sid} L{n}]` markers, sorted **chronologically (oldest first → newest last)**. Do NOT include assistant messages. Copy the VERBATIM text from the preprocessed transcript — do NOT paraphrase or rewrite. If a message exceeds ~100 chars, hard-cut at 100 chars and append `...`.

2. **Session summary (2-4 bullets):** What was accomplished, any pending decisions, background agents/tasks in progress.

### Completion message format

```
---
[Context restored by /s-continue]
- {N} session(s) loaded ({date range}) — {n} Claude Code, {m} Codex
- Level {1|2|3} ({headline|recent|full}) — {what that meant here, e.g. "user turns only, 38 of them"}. Say this even at level 3, so the reader knows depth was a choice.
- [Session:{sid} {ISO} L{n}] headers link to the original transcript — Claude Code at ~/.claude/projects/{PROJECT_HASH}/{SESSION_ID}.jsonl, Codex at the `originalPath` from list-sessions. Use L{n} to read the exact line; the numbering is the original's in both cases.
- Preprocessed caches: ~/.claude/super-token-saver-data/{PROJECT_HASH}/{SESSION_ID}/compact.txt (Codex: …-data/codex/{PROJECT_HASH}/{SESSION_ID}/compact.txt)
- 💡 Next session: run `/clear` first, then `/s-continue` to restore context cheaply

**Last 5 messages:**
- [Session:{sid} L{n}] "{user message, truncated to ~100 chars}..."
- [Session:{sid} L{n}] "{user message}..."
- [Session:{sid} L{n}] "{user message}..."
- [Session:{sid} L{n}] "{user message}..."
- [Session:{sid} L{n}] "{user message}..."

**Session summary:**
{2-4 bullet points — what was accomplished, open items, pending decisions or in-progress tasks.}

---
💡 **Memory search prompt**: If your memory of a specific topic is vague, try this:
> There should be a previous conversation about ___. Find related messages in the text, and if any parts are truncated, use the session ID and line number to retrieve the full text from the original transcript.
```

The Memory search prompt block goes at the VERY END (after Last messages and Session summary), so it's the last thing the LLM/user sees.

## Step 7: Auto-load a `/s-compact` handoff (if present)

`/s-compact` (the write-side pair of this skill) may have saved a handoff for this project — the
distilled non-dialogue layer (subagent findings, tool-output numbers, process lessons) that the
transcript restore above cannot recover. Load it automatically so the user never has to paste it.

```bash
PROJECT_HASH=$(echo "${PWD}" | sed 's/[^a-zA-Z0-9]/-/g')
HANDOFF="${HOME}/.claude/super-token-saver-data/${PROJECT_HASH}/handoff.md"
[ -f "${HANDOFF}" ] && echo "FOUND ${HANDOFF}" || echo "none"
```

- **If it exists**: Read it fully into context (it complements the restored transcript — it holds what
  the transcript does not). Then mark it consumed so a stale handoff is never silently re-applied on a
  later `/s-continue`:
  ```bash
  mv "${HANDOFF}" "${HANDOFF%.md}.applied.md"
  ```
  Add one line to the completion message: `- Handoff loaded from /s-compact (non-dialogue context: subagents, measurements, lessons).`
- **If it does not exist**: do nothing extra — the transcript restore stands on its own. (This is the
  `/s-continue`-alone path: fast context restore with no wasted `/compact` tokens.)

Run this step AFTER the transcript restore (Steps 1–6) so the handoff layers on top of it.

## Output Rules

- Do NOT add any summary beyond the format specified in Step 6 above.
- Do NOT output emoji status lines, cost calculations, token counts, or savings estimates.
- Do NOT improvise additional statistics like "Restored context: X tokens" or "Estimated /compact cost".
- The Step 6 format is the ONLY permitted final output. Follow it exactly.
- The Memory search prompt block must appear exactly as specified above.
