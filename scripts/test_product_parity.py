#!/usr/bin/env python3
"""Parity gate for the dual-host product surface.

Adapted from ai-native-cowork's scripts/test_product_parity.py — the house
pattern for a plugin that ships to both Claude Code and Codex. The failure it
exists to prevent: one manifest is bumped and the other is not, so a host
installs a version that does not exist, or a skill is added on one side only.
"""
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_SKILLS = {"s-continue", "s-compact", "usage-view", "report-limit", "setup-statusline", "setup-git-lite"}
# Skills that run on BOTH hosts and must resolve the plugin root either way. The rest are
# checked elsewhere or stay single-host (statusline).
DUAL_HOST_SKILLS = {"s-continue", "s-compact", "report-limit"}

skills = {path.parent.name for path in (ROOT / "skills").glob("*/SKILL.md")}
assert skills == EXPECTED_SKILLS, f"skill parity drift: {skills ^ EXPECTED_SKILLS}"

claude = json.loads((ROOT / ".claude-plugin" / "plugin.json").read_text())
codex = json.loads((ROOT / ".codex-plugin" / "plugin.json").read_text())
legacy = json.loads((ROOT / "manifest.json").read_text())

assert len({claude["name"], codex["name"], legacy["name"]}) == 1, "plugin name differs between manifests"
assert len({claude["version"], codex["version"], legacy["version"]}) == 1, (
    f"version drift: claude={claude['version']} codex={codex['version']} manifest={legacy['version']}"
)
assert codex["skills"] == "./skills/"

for name in sorted(EXPECTED_SKILLS):
    text = (ROOT / "skills" / name / "SKILL.md").read_text()
    assert text.startswith("---\n"), f"missing frontmatter: {name}"

# A dual-host skill must not hardcode one host's plugin-root variable: Codex
# does not always export CODEX_PLUGIN_ROOT and Claude Code never exports it, so
# a bare ${CLAUDE_PLUGIN_ROOT} in a command silently resolves to nothing.
for name in sorted(DUAL_HOST_SKILLS):
    text = (ROOT / "skills" / name / "SKILL.md").read_text()
    for line in text.splitlines():
        if line.lstrip().startswith("node ") and "PLUGIN_ROOT" in line:
            assert "${PLUGIN_ROOT}" in line, f"{name}: command hardcodes a host plugin root: {line.strip()}"
    assert "codex" in text.lower(), f"{name}: dual-host skill never mentions Codex"

codex_readmes = [ROOT / "README-CODEX.md", ROOT / "README-CODEX.ko.md", ROOT / "README-CODEX.ja.md", ROOT / "README-CODEX.zh-Hans.md"]
required_commands = {
    "codex plugin marketplace add ww-w-ai/marketplace",
    f"codex plugin add {codex['name']}@ww-w-ai",
    "codex plugin marketplace upgrade ww-w-ai",
    "codex plugin list",
}
for readme in codex_readmes:
    assert readme.exists(), f"missing Codex README: {readme.name}"
    missing = required_commands - set(readme.read_text().splitlines())
    assert not missing, f"Codex README command drift in {readme.name}: {sorted(missing)}"

# The Codex manifest points at hooks/hooks-codex.json + the architecture
# prompt it sed-substitutes; both must actually exist, not just be referenced.
hooks_codex_path = ROOT / "hooks" / "hooks-codex.json"
assert codex["hooks"] == "./hooks/hooks-codex.json", "codex manifest hooks pointer drift"
assert hooks_codex_path.exists(), "codex manifest points at hooks/hooks-codex.json but it is missing"
assert (ROOT / "hooks" / "session-architecture-codex.md").exists(), (
    "hooks-codex.json references a missing session-architecture-codex.md"
)

hooks_codex = json.loads(hooks_codex_path.read_text())
codex_commands = [
    h["command"]
    for entry in hooks_codex.get("hooks", {}).get("SessionStart", [])
    for h in entry.get("hooks", [])
    if h.get("type") == "command"
]
assert codex_commands, "hooks-codex.json has no SessionStart commands"

# Every SessionStart command must carry the same registry-boundary fail-open
# guard as hooks/hooks.json: 2>/dev/null || true. Without it, a missing
# CLAUDE_PLUGIN_ROOT or missing referenced file surfaces as a hook warning at
# every session start.
for cmd in codex_commands:
    assert cmd.rstrip().endswith("2>/dev/null || true"), f"codex SessionStart command missing fail-open guard: {cmd}"


def _run_codex_hook(cmd, env_overrides):
    env = dict(os.environ)
    env.update(env_overrides)
    return subprocess.run(
        ["/bin/sh", "-c", cmd],
        env=env,
        input='{"source":"compact","session_id":"test"}',
        capture_output=True,
        text=True,
        timeout=30,
    )


_empty_root = tempfile.mkdtemp(prefix="hooks-codex-empty-root-")
try:
    hostile_scenarios = {
        "CLAUDE_PLUGIN_ROOT unset": {"CLAUDE_PLUGIN_ROOT": ""},
        "CLAUDE_PLUGIN_ROOT points at a directory missing the referenced file": {
            "CLAUDE_PLUGIN_ROOT": _empty_root
        },
    }
    for cmd in codex_commands:
        for scenario_name, env_overrides in hostile_scenarios.items():
            result = _run_codex_hook(cmd, env_overrides)
            assert result.returncode == 0, (
                f"codex SessionStart command exited {result.returncode} under {scenario_name}: {cmd}"
            )
            assert result.stderr == "", (
                f"codex SessionStart command leaked stderr under {scenario_name}: {result.stderr!r}"
            )

    # Happy path: real plugin root must still exit 0, and the sed command must
    # still print the architecture doc (fail-open must not swallow stdout on
    # success).
    for cmd in codex_commands:
        result = _run_codex_hook(cmd, {"CLAUDE_PLUGIN_ROOT": str(ROOT)})
        assert result.returncode == 0, f"codex SessionStart command failed on happy path: {cmd} ({result.returncode})"
        if "session-architecture-codex.md" in cmd:
            assert result.stdout.strip(), "happy-path sed command produced no stdout"
            assert "__PLUGIN_ROOT__" not in result.stdout, "sed placeholder not substituted"
finally:
    shutil.rmtree(_empty_root, ignore_errors=True)

print(f"parity passed: {len(EXPECTED_SKILLS)} skills, 3 manifests at {claude['version']}, {len(codex_readmes)} Codex READMEs")
