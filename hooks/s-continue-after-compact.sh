#!/bin/bash
# SessionStart(source=compact) — put back what compaction dropped, without asking the model to.
#
# super-compact paths: ① (CC, mod on) the mod rebuilt the conversation and left a handled marker —
# this hook consumes it and injects only a pointer to restore.md. ② (CC, mod off) the 95% fork left
# a ready prepared.json but nothing rebuilt the conversation — this hook passes --prepared-json so
# restore-ledger.js leads the restore with that summary. ③ (Codex / prepare failed) no marker, no
# prepared summary — restore-ledger.js reads the dropped turns from the transcript as-is.
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
# The restore itself does not fit in a hook's output: Claude Code caps additionalContext at 10,000
# characters and shows the model a 2 KB preview past that. restore-ledger.js --hook therefore
# writes the full restore to restore.md beside the ledger and prints under 9,000 characters: an
# instruction to Read that file first, its section index, and the newest turns that fit. Codex
# gets the same output (whether it has the same cap is unverified).
#
# When the super-compact hooks module (Claude Code 2.1.287+) rebuilt the conversation itself, it
# leaves a marker named after the session id; this hook consumes it and injects only the pointer.
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
import json, os, shlex, subprocess, sys, time

try:
    payload = json.loads(sys.argv[1])
    if payload.get("source") != "compact":
        sys.exit(0)
except Exception:
    sys.exit(0)

restore_js = sys.argv[2]
sid = payload.get("session_id") or ""
transcript = payload.get("transcript_path") or ""


# The super-compact hooks module (Claude Code 2.1.287+) writes this marker when it rebuilt the
# conversation itself. Then the dialogue is already back in context, and a second restore would
# put it there twice: the marker is consumed and only a pointer to restore.md is injected. A marker
# older than HANDLED_MAX_AGE belongs to a compaction whose SessionStart never reached this hook.
HANDLED_MAX_AGE = 300
_super_dir = os.path.join(os.path.expanduser("~"), ".claude", "super-token-saver-data", ".super-compact")
handled_marker = os.path.join(_super_dir, f"{sid}.json") if sid else ""
# Path 2 (CC, super-compact mod off): the 95% fork left a ready summary but no mod rebuilt the
# conversation. This file has it; restore-ledger prepends it. In path 1 the mod overwrote it with
# status "consumed" and wrote the handled marker, so this is only reached when no mod ran.
prepared_marker = os.path.join(_super_dir, f"{sid}.prepared.json") if sid else ""


def consume_handled():
    """True when super-compact handled this compaction; the marker is removed either way."""
    if not handled_marker or not os.path.isfile(handled_marker):
        return False
    try:
        fresh = time.time() - os.path.getmtime(handled_marker) <= HANDLED_MAX_AGE
        os.remove(handled_marker)
        return fresh
    except Exception:
        return False


def restored(handled):
    """The hook context from the ledger (under 9,000 chars), or None if anything went wrong."""
    if not transcript or not os.path.isfile(transcript):
        return None
    cmd = ["node", restore_js, transcript, "--append", "--hook"]
    if handled:
        cmd.append("--handled")
    elif prepared_marker and os.path.isfile(prepared_marker):
        cmd += ["--prepared-json", prepared_marker]
    try:
        run = subprocess.run(
            cmd,
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
        cmd = f"node {shlex.quote(restore_js)} {shlex.quote(transcript)} --append --hook"
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

Follow its stdout: it names the restore file to Read. That file is the real conversation, not a
summary and not a new request. Prefer it over the compact summary wherever the two disagree, and
do NOT re-derive findings that already appear in it. If you were mid-run on an autonomous task,
resume from it rather than re-planning."""
    return """# This session was just compacted — the automatic restore did not run

The restore that normally runs here failed, and this session's transcript path was not supplied,
so the exact restore command cannot be named. Do NOT substitute the cheaper `/s-continue` manual
skill as a stand-in — it drops teammate messages, subagent notices and most reply text, which is
exactly what the automatic path exists to keep. If you can determine this session's own transcript
path, rerun `node restore-ledger.js <that transcript> --append --hook` yourself and follow its
stdout."""


handled = consume_handled()
text = restored(handled)
if handled and not text:
    sys.exit(0)  # the dialogue is already back; a failed pointer is not worth an instruction
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": text if text else instruction(),
    }
}))
PY
exit 0
