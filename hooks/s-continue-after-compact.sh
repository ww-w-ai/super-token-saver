#!/bin/bash
# SessionStart(source=compact) — put back what compaction dropped, without asking the model to.
#
# Auto-compact keeps the session id and keeps writing the SAME transcript, so the pre-compact
# turns are still on disk; the model just cannot see them any more. The compact summary is a
# paraphrase, and during an autonomous run (cowork-sprint, pdca-wf, a Workflow) that is not
# enough — decisions, measured numbers and file:line anchors get flattened out of it.
#
# This hook USED to emit an instruction telling the model to run the s-continue skill. That was
# not enough: the instruction landed in context, said "there is no exception", and was skipped
# anyway — measured, in a real autonomous run. An instruction the model may decline is not a
# guarantee. So the hook now does the restore itself and injects the RESULT. There is nothing
# left to comply with.
#
# It calls scripts/restore-ledger.js, which owns what an after-compact restore contains and keeps
# a per-session ledger of every segment it has put back. Nothing is reimplemented here: a second
# copy is exactly how this hook once derived a cache path nothing wrote and died silently for
# months.
#
# This path is NOT the user-invoked /s-continue, and it does not read compact.txt. That path is
# asked for and is allowed to be cheap. This one is not asked for and must not lose the thread of
# an autonomous run, so it spends tokens: human turns, the model's own replies, teammate messages
# and subagent completion notices come back verbatim; only tool traffic is left out. The window is
# "everything since this ledger last appended", not "since the last compaction boundary" — the
# boundary record is written AFTER this hook runs (measured 112 ms after), and reading it as the
# last boundary once handed back the segment before the one that had just been dropped.
#
# additionalContext is the ONLY compaction-adjacent hook output that reaches the model. On Claude
# Code, PostCompact is absent from the hookSpecificOutput union. On Codex, PostCompact returns a
# StatelessHookOutcome with no context field, while SessionStart carries additional_contexts —
# so SessionStart(source=compact) is the one event that works on both.
#
# Fails open, always. Any failure falls back to the old instruction text, and any error at all
# prints nothing and exits 0 — a broken hook must never block a session.

set -uo pipefail

payload="$(cat)"
[ -n "$payload" ] || exit 0

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESTORE="${HERE}/../scripts/restore-ledger.js"

python3 - "$payload" "$RESTORE" <<'PY' 2>/dev/null
import json, os, shlex, subprocess, sys

try:
    payload = json.loads(sys.argv[1])
    if payload.get("source") != "compact":
        sys.exit(0)
except Exception:
    sys.exit(0)

restore_js = sys.argv[2]
sid = payload.get("session_id") or ""
transcript = payload.get("transcript_path") or ""


def restored():
    """The dropped turns from the ledger, or None if anything at all went wrong."""
    if not transcript or not os.path.isfile(transcript):
        return None
    try:
        run = subprocess.run(
            ["node", restore_js, transcript, "--append"],
            capture_output=True, text=True, timeout=30,
        )
    except Exception:
        return None
    if run.returncode != 0:
        return None
    text = run.stdout.strip()
    # An empty restore is a failure, not a result: announcing one that carried
    # nothing is worse than falling back to asking for it.
    return text if text else None


def instruction():
    """Fallback: ask for the exact automatic-restore command to be rerun.

    This must NOT fall back to the cheaper /s-continue manual path: that path renders
    compact.txt, which drops teammate messages and subagent notices outright and cuts every
    reply to 200 characters. Silently downgrading an autonomous run to that path on a restore
    failure would be worse than the failure itself, so the ask is to retry the SAME command
    with the SAME transcript, not to switch pipelines.
    """
    if transcript:
        cmd = f"node {shlex.quote(restore_js)} {shlex.quote(transcript)} --append"
        return f"""# This session was just compacted — the automatic restore did not run

The restore that normally runs here failed, so the pre-compact turns are NOT in context. The
summary above is a paraphrase written by a model, and a paraphrase of an instruction is not that
instruction: standing orders ("keep going until morning", "do not narrow the scope"), the exact
wording of a decision, and the numbers behind a finding are precisely what it flattens.

**Before your first substantive action, rerun the automatic restore yourself, against this
session's own transcript** (do not substitute the cheaper `/s-continue` skill — it renders
compact.txt and drops teammate messages, subagent notices and most reply text, which is exactly
what this path exists to keep):

```
{cmd}
```

Treat its stdout exactly as "Restored" text is described below: the real conversation, not a
summary and not a new request. Prefer it over the compact summary wherever the two disagree, and
do NOT re-derive findings that already appear in it. If you were mid-run on an autonomous task,
resume from it rather than re-planning."""
    return """# This session was just compacted — the automatic restore did not run

The restore that normally runs here failed, and this session's transcript path was not supplied,
so the exact restore command cannot be named. Do NOT substitute the cheaper `/s-continue` manual
skill as a stand-in — it drops teammate messages, subagent notices and most reply text, which is
exactly what the automatic path exists to keep. If you can determine this session's own transcript
path, rerun `node restore-ledger.js <that transcript> --append` yourself and treat its stdout as
the restored turns."""


def delivered(text):
    """The restored turns, framed so they are not mistaken for a new request."""
    return f"""# Restored: the turns this session lost to compaction

Everything below was read back from this session's own transcript on disk. It is the real
conversation — the user's own words and your own replies — not a summary and **not a new request**.
Nothing here is the user asking for something now.

Prefer it over the compact summary wherever the two disagree, and do NOT re-derive findings that
already appear in it. If you were mid-run on an autonomous task (cowork-sprint, pdca-wf, a
Workflow), resume from these turns rather than re-planning. Standing orders stated here still
govern the work.

The newest segment is verbatim: every human turn, every reply you wrote, every teammate message
and subagent completion notice, and the body of every SendMessage you sent. Tool calls and their
output are the only thing left out. Earlier segments, a /s-compact handoff, and earlier sessions
of this project appear folded — human turns whole, replies and teammate messages shortened with a
`…[+N chars, read L{{n}} for the rest]` marker. Every entry keeps its `[Session:… L{{n}}]` header, so
read that line of the transcript the moment a shortened entry turns out to matter. The full
ledger is on disk as restore-ledger.md in this session's super-token-saver-data cache dir.

---

{text}"""


text = restored()
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": delivered(text) if text else instruction(),
    }
}))
PY
exit 0
