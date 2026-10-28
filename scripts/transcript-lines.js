#!/usr/bin/env node
/**
 * transcript-lines.js — the line number of every text-bearing user/assistant row in one Claude Code
 * session transcript, so the super-compact module can point each abbreviated message at its
 * original (`[L{n}]`, the same pointer /s-continue uses).
 *
 * Usage: node transcript-lines.js <sessionId> <cwd>
 *
 * Resolves ~/.claude/projects/<cwd with every non-alphanumeric char replaced by '-'>/<sessionId>.jsonl.
 * When that file is missing (a long cwd Claude Code shortened, or a session started elsewhere), the
 * first ~/.claude/projects/<any>/<sessionId>.jsonl is used instead.
 *
 * Prints one JSON object: { path, rows: [{ line, role, head }] }
 *   line  1-based line of the row in the JSONL
 *   role  "user" | "assistant"
 *   head  first 120 characters of the row's text blocks, whitespace collapsed
 * Skipped: isMeta rows, rows without text, and user rows whose content is only tool_result.
 * Claude Code writes one assistant row per content block, so one message may own several rows.
 *
 * Exit 1 with a message on stderr when the transcript cannot be found or read.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");

const HEAD_CHARS = 120;

const collapse = (text) => text.replace(/\s+/g, " ").trim();

function textBlocks(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b && b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n");
}

const onlyToolResults = (content) =>
  Array.isArray(content) && content.length > 0 && content.every((b) => b && b.type === "tool_result");

/** The row this JSONL record contributes, or null when it carries no dialogue text. */
function rowOf(obj, line) {
  if (!obj || (obj.type !== "user" && obj.type !== "assistant") || obj.isMeta) return null;
  const content = obj.message ? obj.message.content : undefined;
  if (obj.type === "user" && onlyToolResults(content)) return null;
  const head = collapse(textBlocks(content)).slice(0, HEAD_CHARS);
  return head ? { line, role: obj.type, head } : null;
}

function transcriptPath(sessionId, cwd) {
  const projects = path.join(os.homedir(), ".claude", "projects");
  const direct = path.join(projects, cwd.replace(/[^A-Za-z0-9]/g, "-"), `${sessionId}.jsonl`);
  if (fs.existsSync(direct)) return direct;
  let dirs = [];
  try {
    dirs = fs.readdirSync(projects);
  } catch {
    return null;
  }
  for (const d of dirs) {
    const candidate = path.join(projects, d, `${sessionId}.jsonl`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

async function readRows(file) {
  const rows = [];
  const lines = readline.createInterface({ input: fs.createReadStream(file, "utf8"), crlfDelay: Infinity });
  let n = 0;
  for await (const text of lines) {
    n++;
    if (!text) continue;
    let obj;
    try {
      obj = JSON.parse(text);
    } catch {
      continue;
    }
    const row = rowOf(obj, n);
    if (row) rows.push(row);
  }
  return rows;
}

async function main() {
  const [sessionId, cwd] = process.argv.slice(2);
  if (!sessionId || !cwd) {
    process.stderr.write("usage: transcript-lines.js <sessionId> <cwd>\n");
    process.exit(1);
  }
  const file = transcriptPath(sessionId, cwd);
  if (!file) {
    process.stderr.write(`transcript not found for session ${sessionId}\n`);
    process.exit(1);
  }
  const rows = await readRows(file);
  process.stdout.write(JSON.stringify({ path: file, rows }));
}

main().catch((err) => {
  process.stderr.write(`transcript-lines: ${err && err.message ? err.message : err}\n`);
  process.exit(1);
});
