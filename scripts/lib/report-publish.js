/**
 * report-publish.js — the part of /report-limit both hosts share: a report directory,
 * a zip of its CSVs, a public gist, a pre-filled GitHub Discussion, and the JSON summary.
 *
 * The caller writes its CSVs into the directory and supplies the Discussion text.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = 'ww-w-ai/super-token-saver';

function log(msg) {
  process.stderr.write(msg + '\n');
}

/** A fresh, timestamped directory under the OS temp dir. */
function makeReportDir() {
  const reportDir = path.join(os.tmpdir(), 'report-limit-' + new Date().toISOString().replace(/[:.]/g, '').slice(0, 19));
  fs.mkdirSync(reportDir, { recursive: true });
  log('Report directory: ' + reportDir);
  return reportDir;
}

/** Heading of one account's section. Accounts are numbered, never named: the report is public. */
const accountHeading = (label) => 'Account ' + label + (label === 1 ? ' (current login)' : '');

/** Replace $HOME with ~ and redact anything shaped like a key. */
function sanitize(text) {
  const homeRegex = new RegExp(os.homedir().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  return text
    .replace(homeRegex, '~')
    .replace(/sk-ant-[a-zA-Z0-9_-]{20,}/g, '[REDACTED]')
    .replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED]')
    .replace(/(API_KEY|SECRET|TOKEN|PASSWORD)\s*=\s*\S+/gi, '$1=[REDACTED]');
}

/** `<cmd> --version`, or 'unknown'. */
function toolVersion(cmd) {
  try {
    return execFileSync(cmd, ['--version'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return 'unknown';
  }
}

/** This plugin's version, from its manifest, or 'unknown'. */
function pluginVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '.claude-plugin', 'plugin.json'), 'utf8')).version || 'unknown';
  } catch {
    return 'unknown';
  }
}

function zipReport(reportDir) {
  const zipFile = reportDir + '.zip';
  try {
    const allFiles = fs.readdirSync(reportDir).filter(f => f.endsWith('.csv')).map(f => path.join(reportDir, f));
    if (allFiles.length === 0) return null;
    execFileSync('zip', ['-j', zipFile].concat(allFiles), { stdio: 'pipe', timeout: 30000 });
    log('Zip created: ' + zipFile);
    return zipFile;
  } catch (e) {
    log('Warning: zip compression failed — ' + e.message);
    return null;
  }
}

function isGhAuthenticated() {
  try {
    execFileSync('gh', ['auth', 'status'], { stdio: 'pipe' });
    return true;
  } catch {
    log('GitHub CLI not authenticated. Run "gh auth login" to authenticate.');
    return false;
  }
}

/** Gist only takes text files: upload the CSVs `isGistFile` accepts. */
function uploadGist(reportDir, isGistFile) {
  try {
    const gistFiles = fs.readdirSync(reportDir).filter(isGistFile).map(f => path.join(reportDir, f));
    if (gistFiles.length === 0) return null;
    const result = execFileSync('gh', ['gist', 'create', '--public'].concat(gistFiles), {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    }).trim();
    if (!result.startsWith('http')) return null;
    log('Gist created: ' + result);
    return result;
  } catch (e) {
    log('Gist upload failed: ' + (e.stderr ? e.stderr.toString().trim() : e.message));
    return null;
  }
}

function openInBrowser(url) {
  try {
    execFileSync('open', [url], { stdio: 'pipe' });
    log('Discussion opened in browser.');
    return true;
  } catch {
    log('Could not open browser. Discussion URL:\n' + url);
    return false;
  }
}

function openFolder(target) {
  try {
    execFileSync('open', [target], { stdio: 'pipe' });
    log('Opened directory in Finder: ' + target);
  } catch {
    log('Could not open Finder. Files at: ' + target);
  }
}

/**
 * Zip, upload, open the Discussion, and print the JSON summary to stdout.
 * @param {object} p
 * @param {string} p.reportDir directory holding the report's CSVs
 * @param {(name: string) => boolean} p.isGistFile which CSVs go into the public gist
 * @param {string} p.title Discussion title
 * @param {(rawDataLine: string) => string} p.buildBody Discussion body around the raw-data line
 * @param {object} p.summary host-specific fields of the JSON summary
 * @param {boolean} p.dryRun build and print only: no gist, no browser
 */
function publishReport({ reportDir, isGistFile, title, buildBody, summary, dryRun }) {
  const zipFile = zipReport(reportDir);
  const ghAuthenticated = isGhAuthenticated();
  const gistUrl = ghAuthenticated && !dryRun ? uploadGist(reportDir, isGistFile) : null;

  const rawDataLine = gistUrl
    ? '\u{1F4CE} ' + gistUrl
    : (zipFile
      ? '\u{1F4CE} Please attach: `' + zipFile + '`'
      : '\u{1F4CE} Please attach CSV files from: `' + reportDir + '/`');
  const body = sanitize(buildBody(rawDataLine));
  const discussionUrl = 'https://github.com/' + REPO + '/discussions/new'
    + '?category=rate-limits'
    + '&title=' + encodeURIComponent(title)
    + '&body=' + encodeURIComponent(body);

  let discussionOpened = false;
  if (dryRun) {
    log('--dry-run: nothing uploaded or opened.\n\n# ' + title + '\n\n' + body + '\n\nDiscussion URL length: ' + discussionUrl.length);
  } else {
    discussionOpened = openInBrowser(discussionUrl);
    if (!gistUrl) openFolder(zipFile ? path.dirname(zipFile) : reportDir);
  }

  console.log(JSON.stringify({
    ...summary,
    ghAuthenticated,
    gistUrl,
    zipFile,
    reportDir,
    discussionOpened,
    dryRun,
    discussionUrlLength: discussionUrl.length,
  }, null, 2));
}

module.exports = { log, makeReportDir, accountHeading, toolVersion, pluginVersion, publishReport };
