#!/usr/bin/env node
/**
 * test-transcript-lines.js — gate for scripts/transcript-lines.js, the line pointers super-compact
 * puts on abbreviated messages.
 *
 * Runs against a synthetic transcript under a throwaway HOME. Pins: the path is resolved from the
 * cwd with every non-alphanumeric char replaced by '-'; a session filed under another project dir
 * is still found; line numbers are 1-based JSONL lines; isMeta rows, text-less rows and
 * tool_result-only rows are skipped; each assistant content block row stands alone; head is the
 * first 120 chars with whitespace collapsed; a missing transcript exits 1.
 *
 * Usage: node scripts/test-transcript-lines.js
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "transcript-lines.js");

let failures = 0;
function check(name, cond, detail) {
  if (!cond) failures++;
  console.log(`${cond ? "OK  " : "FAIL"} ${name}${cond || !detail ? "" : `\n       ${detail}`}`);
}

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "sts-lines-"));
const CWD = "/Users/test/my_proj.v2";
const SID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const projDir = path.join(HOME, ".claude", "projects", "-Users-test-my-proj-v2");
fs.mkdirSync(projDir, { recursive: true });

const rows = [
  { type: "user", message: { role: "user", content: "first   question\n\nwith gaps" } },
  { type: "user", isMeta: true, message: { role: "user", content: "meta row" } },
  { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "block one" }] } },
  { type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "Bash", input: {} }] } },
  { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "out" }] } },
  { type: "system", subtype: "compact_boundary" },
  { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "x".repeat(300) }] } },
  { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t2", content: "o" }, { type: "text", text: "typed while running" }] } },
];
fs.writeFileSync(path.join(projDir, `${SID}.jsonl`), rows.map((r) => JSON.stringify(r)).join("\n") + "\nnot json\n");

function run(args) {
  const r = spawnSync("node", [SCRIPT, ...args], { env: { ...process.env, HOME }, encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const direct = run([SID, CWD]);
check("exits 0 for a resolvable transcript", direct.code === 0, direct.err);
const parsed = JSON.parse(direct.out || "{}");
check("path resolved from the cwd", parsed.path === path.join(projDir, `${SID}.jsonl`), parsed.path);
const got = (parsed.rows || []).map((r) => `${r.line}:${r.role}:${r.head}`);
const want = ["1:user:first question with gaps", "3:assistant:block one", `7:assistant:${"x".repeat(120)}`, "8:user:typed while running"];
check("rows: 1-based lines, meta/tool-only/text-less skipped, head collapsed and cut to 120", JSON.stringify(got) === JSON.stringify(want), JSON.stringify(got));

const elsewhere = run([SID, "/some/other/cwd"]);
check("session under another project dir is found by id", elsewhere.code === 0 && JSON.parse(elsewhere.out).path === parsed.path, elsewhere.err);

const missing = run(["ffffffff-0000-0000-0000-000000000000", CWD]);
check("missing transcript exits 1 with a message", missing.code === 1 && missing.err.includes("not found"), missing.err);

const usage = run([]);
check("missing arguments exit 1", usage.code === 1, usage.err);

fs.rmSync(HOME, { recursive: true, force: true });
console.log(failures ? `\n${failures} FAILED` : "\nPASS");
process.exit(failures ? 1 : 0);
