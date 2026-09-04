/**
 * cache-paths.js — Single source of truth for all cache path resolution.
 *
 * One base, one sub-tree per host. Claude Code stays at the root (the Bash
 * statusline hook writes there directly); Codex lives under `codex/`.
 *
 *   ~/.claude/super-token-saver-data/{projectName}/{sessionId}/timeline.csv       Claude Code
 *   ~/.claude/super-token-saver-data/{projectName}/{sessionId}/summary.json
 *   ~/.claude/super-token-saver-data/{projectName}/{sessionId}/ratelimit.csv
 *   ~/.claude/super-token-saver-data/{projectName}/{sessionId}/compact.txt
 *   ~/.claude/super-token-saver-data/{projectName}/{sessionId}/compact.aggressive.txt
 *   ~/.claude/super-token-saver-data/{projectName}/{sessionId}/subagents/{agentId}/timeline.csv
 *   ~/.claude/super-token-saver-data/{projectName}/{sessionId}/subagents/{agentId}/summary.json
 *   ~/.claude/super-token-saver-data/codex/{projectName}/{sessionId}/…               Codex (same files)
 *   ~/.claude/super-token-saver-data/codex/.normalized/{projectName}/{sessionId}.jsonl  Codex rollouts, CC-shaped
 *
 * The root getters below are the Claude Code tree. `forHost('codex')` returns
 * the same getters bound to the Codex tree. `listProjects()` never returns the
 * `codex` directory, so a tree walk on one host cannot pick up the other's
 * sessions — the two hosts share file names, and `summary.json`'s `host` field
 * used to be the only thing telling them apart.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

const CACHE_BASE = path.join(os.homedir(), '.claude', 'super-token-saver-data');
const CODEX_SUBDIR = 'codex';
const CODEX_BASE = path.join(CACHE_BASE, CODEX_SUBDIR);
const HOST_BASES = { claude: CACHE_BASE, codex: CODEX_BASE };

// Auto-migrate from previous names (rename only, no cross-device copy)
const _legacyDirs = [
  path.join(os.homedir(), '.claude', 'claude-code-token-saver-data'), // v1.6.0–v2.5.0
  path.join(os.homedir(), '.claude', 'claude-code-upgrader-data'), // v1.5.x
  path.join(os.homedir(), '.claude', 'cc-token-saver-data'), // v1.1.1–v1.4.x
  path.join(os.homedir(), '.claude', 'cc-token-saver'),      // pre-v1.1.1
];
// Merge entry by entry rather than renaming the whole directory.
//
// A whole-directory rename only works when the new base does not exist yet,
// and that is not guaranteed: `statusline-logger.sh` is a Bash hook that
// writes `ratelimit.csv` straight to the new base with `mkdir -p`, never
// going through this module. It fires on the first prompt after an upgrade,
// so by the time any script calls in here, the new base usually exists and
// holds one tiny file — and a guard of "only migrate if the new base is
// missing" then silently strands the entire real cache under the old name.
//
// Moving entries individually is still a rename (no copy, so a large cache is
// never duplicated), and it is idempotent: anything already present in the new
// base is left alone and the legacy copy is kept rather than destroyed.
function _mergeLegacyDir(oldDir) {
  let moved = 0;
  let leftBehind = 0;
  for (const entry of fs.readdirSync(oldDir)) {
    const from = path.join(oldDir, entry);
    const to = path.join(CACHE_BASE, entry);
    if (!fs.existsSync(to)) {
      try { fs.renameSync(from, to); moved++; } catch (_) { leftBehind++; }
      continue;
    }
    // Same project on both sides: descend one level so sessions merge too.
    let children = [];
    try { children = fs.statSync(from).isDirectory() ? fs.readdirSync(from) : []; } catch (_) {}
    if (!children.length) { leftBehind++; continue; }
    for (const child of children) {
      const childTo = path.join(to, child);
      if (fs.existsSync(childTo)) { leftBehind++; continue; }
      try { fs.renameSync(path.join(from, child), childTo); moved++; } catch (_) { leftBehind++; }
    }
    try { fs.rmdirSync(from); } catch (_) { leftBehind++; }
  }
  if (leftBehind === 0) { try { fs.rmdirSync(oldDir); } catch (_) {} }
  return { moved, leftBehind };
}

for (const old of _legacyDirs) {
  if (old === CACHE_BASE || !fs.existsSync(old)) continue;
  try {
    fs.mkdirSync(CACHE_BASE, { recursive: true });
    const { moved, leftBehind } = _mergeLegacyDir(old);
    if (moved) {
      process.stderr.write(
        `[cache-paths] moved ${moved} entr${moved === 1 ? 'y' : 'ies'} from ${path.basename(old)}` +
        (leftBehind ? ` (${leftBehind} left in place — already present in the new cache)` : '') + '\n',
      );
    }
  } catch (_) { /* a cache that cannot be moved must not stop the tool */ }
}

// ---------------------------------------------------------------------------
// Project name helpers
// ---------------------------------------------------------------------------

/**
 * Derive projectName from CWD — same algorithm as Claude Code.
 * e.g. /Users/foo/myproject → -Users-foo-myproject
 */
function projectNameFromCwd(cwd) {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-');
}

/**
 * Extract projectName from a CC transcript path.
 * e.g. ~/.claude/projects/-Users-foo-myproject/abc123.jsonl → -Users-foo-myproject
 */
function extractProjectName(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/projects/');
  if (parts.length < 2) return null;
  return parts[1].split('/')[0];
}

// ---------------------------------------------------------------------------
// Path getters — one set per host tree
// ---------------------------------------------------------------------------

function _pathsFor(base) {
  const getProjectDir = (projectName) => path.join(base, projectName);
  const getSessionDir = (projectName, sessionId) => path.join(getProjectDir(projectName), sessionId);
  const getSubagentDir = (projectName, sessionId, agentId) => path.join(getSessionDir(projectName, sessionId), 'subagents', agentId);
  const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch (_) { return false; } };
  return {
    base,
    getProjectDir,
    getSessionDir,
    getTimelinePath: (projectName, sessionId) => path.join(getSessionDir(projectName, sessionId), 'timeline.csv'),
    getSummaryPath: (projectName, sessionId) => path.join(getSessionDir(projectName, sessionId), 'summary.json'),
    getRatelimitPath: (projectName, sessionId) => path.join(getSessionDir(projectName, sessionId), 'ratelimit.csv'),
    getCompactPath: (projectName, sessionId, aggressive = false) =>
      path.join(getSessionDir(projectName, sessionId), aggressive ? 'compact.aggressive.txt' : 'compact.txt'),
    getSubagentDir,
    getSubagentTimelinePath: (projectName, sessionId, agentId) => path.join(getSubagentDir(projectName, sessionId, agentId), 'timeline.csv'),
    getSubagentSummaryPath: (projectName, sessionId, agentId) => path.join(getSubagentDir(projectName, sessionId, agentId), 'summary.json'),
    /**
     * Project directories in this tree. Skips the other host's sub-tree, dot
     * dirs (normalized rollouts, markers), the old YYMM layout, and 'lib'.
     */
    listProjects: () => {
      if (!fs.existsSync(base)) return [];
      return fs.readdirSync(base).filter((d) => {
        if (/^\d{4}$/.test(d)) return false;           // old YYMM dirs
        if (d.endsWith('.migrated')) return false;       // migrated YYMM dirs
        if (d === 'lib' || d === CODEX_SUBDIR) return false;
        if (d.startsWith('.')) return false;
        return isDir(path.join(base, d));
      });
    },
    listSessions: (projectName) => {
      const dir = getProjectDir(projectName);
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir).filter((d) => isDir(path.join(dir, d)));
    },
    listSubagents: (projectName, sessionId) => {
      const dir = path.join(getSessionDir(projectName, sessionId), 'subagents');
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir).filter((d) => isDir(path.join(dir, d)));
    },
  };
}

const _claudePaths = _pathsFor(CACHE_BASE);
const _codexPaths = _pathsFor(CODEX_BASE);

/** Getters bound to a host's tree. `forHost('claude')` is the root set. */
function forHost(host) {
  if (host === 'codex') return _codexPaths;
  if (host === 'claude' || host == null) return _claudePaths;
  throw new Error(`cache-paths: unknown host "${host}"`);
}

const {
  getProjectDir, getSessionDir, getTimelinePath, getSummaryPath, getRatelimitPath, getCompactPath,
  getSubagentDir, getSubagentTimelinePath, getSubagentSummaryPath,
} = _claudePaths;

// ---------------------------------------------------------------------------
// Migration — Codex entries out of the Claude tree into codex/
// ---------------------------------------------------------------------------

/**
 * Codex sessions used to be cached in the same {project}/{session} tree as
 * Claude Code, tagged only by summary.json's `host`. Move every such entry
 * (and the normalized rollouts) under codex/. Rename only, idempotent.
 *
 * Pre-split Codex data always came with a `.codex-normalized` dir (analysis
 * normalizes first), so that dir is the trigger: the summary.json scan runs
 * only while it exists, and moving it is what stops the scan on later loads.
 * No marker file — the cache tree must contain nothing but cache.
 */
function migrateCodexSubdir() {
  const oldNormalized = path.join(CACHE_BASE, '.codex-normalized');
  if (!fs.existsSync(oldNormalized)) return { moved: 0 };
  let moved = 0;
  for (const proj of _claudePaths.listProjects()) {
    for (const sess of _claudePaths.listSessions(proj)) {
      let host = null;
      try {
        const raw = fs.readFileSync(_claudePaths.getSummaryPath(proj, sess), 'utf8');
        const m = raw.match(/"host"\s*:\s*"(\w+)"/);
        host = m ? m[1] : null;
      } catch (_) { continue; }
      if (host !== 'codex') continue;
      const to = _codexPaths.getSessionDir(proj, sess);
      if (fs.existsSync(to)) continue;
      try {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.renameSync(_claudePaths.getSessionDir(proj, sess), to);
        moved++;
      } catch (_) { /* a cache that cannot be moved must not stop the tool */ }
    }
    try { fs.rmdirSync(_claudePaths.getProjectDir(proj)); } catch (_) { /* not empty */ }
  }
  // Last, so a crash mid-scan leaves the trigger in place and the next load resumes.
  const newNormalized = path.join(CODEX_BASE, '.normalized');
  try {
    fs.mkdirSync(CODEX_BASE, { recursive: true });
    if (!fs.existsSync(newNormalized)) fs.renameSync(oldNormalized, newNormalized);
    else fs.rmSync(oldNormalized, { recursive: true, force: true }); // stale copies; the normalizer re-creates on demand
    moved++;
  } catch (_) { /* leave it; the scan simply runs again next time */ }
  if (moved) process.stderr.write(`[cache-paths] moved ${moved} Codex cache entr${moved === 1 ? 'y' : 'ies'} under codex/\n`);
  return { moved };
}

try { migrateCodexSubdir(); } catch (_) {}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

/**
 * SHA-256 hash, first 8 hex chars. Used for privacy in report-limit.
 */
function hashId(id) {
  return crypto.createHash('sha256').update(id).digest('hex').slice(0, 8);
}

// ---------------------------------------------------------------------------
// Listing helpers
// ---------------------------------------------------------------------------

// Claude Code tree listings. The Codex tree's are on forHost('codex').
const { listProjects, listSessions, listSubagents } = _claudePaths;

// ---------------------------------------------------------------------------
// Migration — YYMM flat structure → project/session hierarchy
// ---------------------------------------------------------------------------

/**
 * Migrate old YYMM cache directories to new project/session structure.
 *
 * 1. Scan YYMM dirs (match /^\d{4}$/)
 * 2. For each summary-{sessionId}.json, read filePath to get projectName
 * 3. For timeline-{sessionId}.csv without summary, scan ~/.claude/projects/
 * 4. For agent files, find parent session via CC's subagents/ folder
 * 5. Copy files to new structure (mkdir -p, then copy)
 * 6. After all files in YYMM dir are migrated, rename to {YYMM}.migrated
 * 7. Unresolvable projectName → _unknown
 *
 * Logs actions to stderr.
 */
function migrateFromYYMM() {
  if (!fs.existsSync(CACHE_BASE)) return;

  const ccProjectsDir = path.join(os.homedir(), '.claude', 'projects');
  const yymmDirs = fs.readdirSync(CACHE_BASE).filter(d => {
    return /^\d{4}$/.test(d) && fs.statSync(path.join(CACHE_BASE, d)).isDirectory();
  });

  if (yymmDirs.length === 0) return;

  process.stderr.write(`[cache-paths] migrating ${yymmDirs.length} YYMM dir(s)\n`);

  // Build lookup: sessionId → projectName from summary files
  const sessionProjectMap = {};       // sessionId → projectName
  // Build lookup: agentId → { projectName, sessionId }
  const agentParentMap = {};

  // --- Pass 1: Collect projectNames from summary files ---
  for (const ym of yymmDirs) {
    const dir = path.join(CACHE_BASE, ym);
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const sumMatch = f.match(/^summary-([^.]+)\.json$/);
      if (!sumMatch) continue;
      if (f.startsWith('summary-agent-')) continue; // skip agent summaries
      const sid = sumMatch[1];
      try {
        const raw = fs.readFileSync(path.join(dir, f), 'utf8');
        const data = JSON.parse(raw);
        if (data.filePath) {
          const proj = extractProjectName(data.filePath);
          if (proj) {
            sessionProjectMap[sid] = proj;
          }
        }
      } catch (_) { /* ignore parse errors */ }
    }
  }

  // --- Pass 2: For sessions without summary, scan CC projects dirs ---
  for (const ym of yymmDirs) {
    const dir = path.join(CACHE_BASE, ym);
    const files = fs.readdirSync(dir);
    for (const f of files) {
      // Match timeline-{sid}.csv, ratelimit-{sid}.csv, compact-{sid}.*
      const tlMatch = f.match(/^timeline-([^.]+)\.csv$/);
      const rlMatch = f.match(/^ratelimit-([^.]+)\.csv$/);
      const cpMatch = f.match(/^compact-([^.]+?)(?:\.aggressive)?\.txt$/);

      // Skip agent files in this pass
      if (f.startsWith('timeline-agent-') || f.startsWith('summary-agent-')) continue;

      let sid = null;
      if (tlMatch) sid = tlMatch[1];
      else if (rlMatch) sid = rlMatch[1];
      else if (cpMatch) sid = cpMatch[1];

      if (!sid || sessionProjectMap[sid]) continue;

      // Try to find in CC projects
      const proj = _findProjectForSession(ccProjectsDir, sid);
      if (proj) {
        sessionProjectMap[sid] = proj;
      }
    }
  }

  // --- Pass 3: Resolve agent → parent session mapping ---
  for (const ym of yymmDirs) {
    const dir = path.join(CACHE_BASE, ym);
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const agentTlMatch = f.match(/^timeline-agent-([^.]+)\.csv$/);
      const agentSumMatch = f.match(/^summary-agent-([^.]+)\.json$/);
      const aid = agentTlMatch ? agentTlMatch[1] : (agentSumMatch ? agentSumMatch[1] : null);
      if (!aid || agentParentMap[aid]) continue;

      const parent = _findParentSession(ccProjectsDir, aid, sessionProjectMap);
      if (parent) {
        agentParentMap[aid] = parent;
      }
    }
  }

  // --- Pass 4: Copy files to new structure ---
  for (const ym of yymmDirs) {
    const dir = path.join(CACHE_BASE, ym);
    const files = fs.readdirSync(dir);

    for (const f of files) {
      const srcPath = path.join(dir, f);

      // Skip directories
      if (fs.statSync(srcPath).isDirectory()) continue;

      let destPath = null;

      // Session-level files
      const sumMatch = f.match(/^summary-([^.]+)\.json$/);
      const tlMatch = f.match(/^timeline-([^.]+)\.csv$/);
      const rlMatch = f.match(/^ratelimit-([^.]+)\.csv$/);
      const cpMatch = f.match(/^compact-([^.]+)\.txt$/);
      const cpAggMatch = f.match(/^compact-([^.]+)\.aggressive\.txt$/);
      const agentTlMatch = f.match(/^timeline-agent-([^.]+)\.csv$/);
      const agentSumMatch = f.match(/^summary-agent-([^.]+)\.json$/);

      if (agentSumMatch) {
        const aid = agentSumMatch[1];
        const parent = agentParentMap[aid];
        const proj = parent ? parent.projectName : '_unknown';
        const parentSid = parent ? parent.sessionId : '_unknown';
        destPath = getSubagentSummaryPath(proj, parentSid, aid);
      } else if (agentTlMatch) {
        const aid = agentTlMatch[1];
        const parent = agentParentMap[aid];
        const proj = parent ? parent.projectName : '_unknown';
        const parentSid = parent ? parent.sessionId : '_unknown';
        destPath = getSubagentTimelinePath(proj, parentSid, aid);
      } else if (sumMatch && !f.startsWith('summary-agent-')) {
        const sid = sumMatch[1];
        const proj = sessionProjectMap[sid] || '_unknown';
        destPath = getSummaryPath(proj, sid);
      } else if (cpAggMatch) {
        const sid = cpAggMatch[1];
        const proj = sessionProjectMap[sid] || '_unknown';
        destPath = getCompactPath(proj, sid, true);
      } else if (cpMatch && !cpAggMatch) {
        // Non-aggressive compact — but skip if already handled by cpAggMatch
        const sid = cpMatch[1];
        const proj = sessionProjectMap[sid] || '_unknown';
        destPath = getCompactPath(proj, sid, false);
      } else if (tlMatch && !f.startsWith('timeline-agent-')) {
        const sid = tlMatch[1];
        const proj = sessionProjectMap[sid] || '_unknown';
        destPath = getTimelinePath(proj, sid);
      } else if (rlMatch) {
        const sid = rlMatch[1];
        const proj = sessionProjectMap[sid] || '_unknown';
        destPath = getRatelimitPath(proj, sid);
      }

      if (!destPath) {
        process.stderr.write(`[cache-paths] skip unknown file: ${f}\n`);
        continue;
      }

      // Copy
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      process.stderr.write(`[cache-paths] copied ${ym}/${f} → ${path.relative(CACHE_BASE, destPath)}\n`);
    }

    // Rename YYMM dir to YYMM.migrated (may fail if new files appeared during migration)
    const migratedPath = path.join(CACHE_BASE, `${ym}.migrated`);
    try {
      fs.renameSync(dir, migratedPath);
      process.stderr.write(`[cache-paths] renamed ${ym} → ${ym}.migrated\n`);
    } catch {
      process.stderr.write(`[cache-paths] warning: ${ym} not empty after migration, will retry next run\n`);
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers for migration
// ---------------------------------------------------------------------------

/**
 * Scan ~/.claude/projects/ for a transcript matching sessionId.
 * Returns projectName or null.
 */
function _findProjectForSession(ccProjectsDir, sessionId) {
  if (!fs.existsSync(ccProjectsDir)) return null;

  const projects = fs.readdirSync(ccProjectsDir);
  for (const proj of projects) {
    const projDir = path.join(ccProjectsDir, proj);
    if (!fs.statSync(projDir).isDirectory()) continue;

    // Check for {sessionId}.jsonl directly in project dir
    if (fs.existsSync(path.join(projDir, `${sessionId}.jsonl`))) {
      return proj;
    }

    // Check for session subdirectory (newer CC structure)
    if (fs.existsSync(path.join(projDir, sessionId))) {
      return proj;
    }
  }
  return null;
}

/**
 * Find parent session for a given agentId.
 * Checks CC's subagents/ folder structure under each known project/session.
 * Returns { projectName, sessionId } or null.
 */
function _findParentSession(ccProjectsDir, agentId, sessionProjectMap) {
  if (!fs.existsSync(ccProjectsDir)) return null;

  const projects = fs.readdirSync(ccProjectsDir);
  for (const proj of projects) {
    const projDir = path.join(ccProjectsDir, proj);
    if (!fs.statSync(projDir).isDirectory()) continue;

    const entries = fs.readdirSync(projDir);
    for (const entry of entries) {
      const entryPath = path.join(projDir, entry);
      if (!fs.statSync(entryPath).isDirectory()) continue;

      // entry could be a sessionId directory
      const subagentsDir = path.join(entryPath, 'subagents');
      if (!fs.existsSync(subagentsDir)) continue;

      // Check for agent-{agentId}.jsonl or agent-{agentId}.meta.json
      if (
        fs.existsSync(path.join(subagentsDir, `agent-${agentId}.jsonl`)) ||
        fs.existsSync(path.join(subagentsDir, `agent-${agentId}.meta.json`))
      ) {
        return { projectName: proj, sessionId: entry };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  CACHE_BASE,
  CODEX_BASE,
  CODEX_SUBDIR,
  HOST_BASES,
  forHost,
  migrateCodexSubdir,
  projectNameFromCwd,
  extractProjectName,
  getProjectDir,
  getSessionDir,
  getTimelinePath,
  getSummaryPath,
  getRatelimitPath,
  getCompactPath,
  getSubagentDir,
  getSubagentTimelinePath,
  getSubagentSummaryPath,
  hashId,
  listProjects,
  listSessions,
  listSubagents,
  migrateFromYYMM,
};
