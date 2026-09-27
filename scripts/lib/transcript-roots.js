/**
 * Every Claude Code `projects/` directory on this machine.
 *
 * Claude Code writes transcripts under `$CLAUDE_CONFIG_DIR/projects` (default
 * `~/.claude/projects`). Launchers that keep one config dir per login account
 * therefore spread one person's usage across several roots. Reading only the
 * default root undercounts exactly the usage that fills the weekly limit.
 *
 * Roots, deduplicated by real path:
 *   1. ~/.claude/projects
 *   2. $CLAUDE_CONFIG_DIR/projects
 *   3. each dir in $SUPER_TOKEN_SAVER_CONFIG_DIRS (path.delimiter-separated) + /projects
 *   4. per-account config dirs of known launchers (ACCOUNT_DIR_PARENTS)
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

// Parents whose children are per-account Claude config dirs.
const ACCOUNT_DIR_PARENTS = [
  path.join(os.homedir(), "Library", "Application Support", "ai.ww-w.vmux", "accounts"),
];

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function childDirs(parent) {
  try {
    return fs.readdirSync(parent).map((d) => path.join(parent, d)).filter(isDir);
  } catch {
    return [];
  }
}

function configDirs(env) {
  const dirs = [path.join(os.homedir(), ".claude")];
  if (env.CLAUDE_CONFIG_DIR) dirs.push(env.CLAUDE_CONFIG_DIR);
  if (env.SUPER_TOKEN_SAVER_CONFIG_DIRS) dirs.push(...env.SUPER_TOKEN_SAVER_CONFIG_DIRS.split(path.delimiter).filter(Boolean));
  for (const parent of ACCOUNT_DIR_PARENTS) dirs.push(...childDirs(parent));
  return dirs;
}

/** @returns {string[]} existing `projects/` roots, default root first, no duplicates */
function claudeProjectRoots(env = process.env) {
  const seen = new Set();
  const roots = [];
  for (const dir of configDirs(env)) {
    const root = path.join(dir, "projects");
    if (!isDir(root)) continue;
    let real;
    try { real = fs.realpathSync(root); } catch { continue; }
    if (seen.has(real)) continue;
    seen.add(real);
    roots.push(root);
  }
  return roots;
}

module.exports = { claudeProjectRoots, ACCOUNT_DIR_PARENTS };
