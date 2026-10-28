import type {
  EngineInterface,
  Next,
  Register,
  SessionCompactInput,
  SessionCompactResult,
  SessionMessage,
} from 'claude-code'

/**
 * Super compaction in Claude Code's own message shape.
 *
 * The summary is prepared by a shell fork, not by this module. precompact-watch.js (a PostToolUse /
 * Stop hook) measures the context and, the first time it reaches 95% of the auto-compact threshold,
 * starts precompact-prepare.js, which forks the session off its transcript on disk and writes
 *   <data>/.super-compact/<session id>.prepared.json  { status:"ready", summary, lastSeen, coveredLine }
 * coveredLine is the transcript's line count when the fork began: every JSONL line after it is newer
 * than the summary. This module only READS that file at compaction; it never forks (an older design
 * forked here too, which double-forked once the shell trigger landed).
 *
 * When compaction runs, the conversation becomes, oldest first:
 *   1. one user message in the shape core's own summary takes: everything before the last
 *      compaction (section A of the prepared summary), plus what the abbreviated dialogue below
 *      loses — tool results, the middle of long messages, reasons, in-flight state, and one line
 *      per machine message (teammate report, subagent completion notice) (section B); it closes
 *      with the transcript's path and an English note on the order of what follows
 *   2. this span's dialogue as user/assistant messages, long ones cut head + tail (/s-continue's
 *      500 -> 300+200 for the user, 200 -> 100+100 for replies), each prefixed `[L{n}]`, n being
 *      its line in the transcript JSONL; the span is widened backward until it holds at least
 *      MIN_TURNS human turns; machine messages and idle notifications are left out of this layer
 *   3. the verbatim tail: from the first message newer than coveredLine (the anchor), walked back
 *      to the human turn that opened it or, with none, up to WALK_BACK_STEPS steps to an
 *      explanatory assistant message; the last two full exchanges are always inside it. A turn
 *      longer than LONG_TURN_CAP keeps its opening message, one note for the steps the summary
 *      covers, then every step from the anchor on.
 * Every cut lands on a step boundary, so tool_use/tool_result pairs stay whole. Anything unexpected
 * falls back to core compaction.
 *
 * Claude Code 2.1.287+ only: older builds and Codex never load a hooks module and keep the shell
 * after-compact restore (s-continue-after-compact.sh). When this module rebuilt the conversation it
 * writes HANDLED_DIR/<session id>.json; the shell hook reads that file, consumes it, and injects
 * only a pointer instead of a second restore. Each compaction's summary is also persisted to
 * <session cache>/super-compact/<n>.md so the next session's /s-continue can load it as a handoff.
 */

const LONG_TURN_CAP = { fraction: 0.08, tokens: 40_000 }
const USER_FOLD = { over: 500, head: 300, tail: 200 }
const REPLY_FOLD = { over: 200, head: 100, tail: 100 }
/** A message matches a transcript row when the row's head starts with this many of its chars. */
const LINE_KEY_CHARS = 60
/** The abbreviated dialogue holds at least this many human turns, widening backward to reach it. */
const MIN_TURNS = 10
/** With no human turn in the span, the tail may start up to this many steps back, at an explanation. */
const WALK_BACK_STEPS = 3
const TRANSCRIPT_LINES_TIMEOUT_MS = 60_000

/** Core's own summary message opens with this; a later compaction finds the previous one by it. */
const CONTINUATION_HEAD =
  'This session is being continued from a previous conversation that ran out of context.'
const CONTINUATION_ORDER =
  'The messages that follow are, first, the earlier turns of this span with long messages cut ' +
  '(marked where cut), then the current turn verbatim from the user message that opened it ' +
  '(tool steps the summary covers may be left out, marked where). Continue from where the ' +
  'conversation left off.'

/** The prepared summary file precompact-prepare.js writes; this module only reads it. */
type Prepared = {
  status: 'running' | 'ready' | 'failed' | 'consumed'
  summary?: string
  lastSeen?: string
  /** The transcript's line count when the fork began: the anchor is the first message past it. */
  coveredLine?: number
  reason?: string
}

type Report = Record<string, unknown>

/** One text-bearing row of the transcript JSONL, as scripts/transcript-lines.js prints it. */
export type TranscriptRow = { line: number; role: 'user' | 'assistant'; head: string }

/** The transcript's path and, per message index, the JSONL line that message starts on. */
export type TranscriptPointer = { path: string; lines: readonly (number | undefined)[] }

let thresholdCache: number | undefined

// ───────────────────────────── text measures ─────────────────────────────

/** ASCII at ~4 chars per token, everything else (CJK, accents) at ~1.5, as restore-ledger.js counts. */
function estimateTokens(text: string): number {
  let ascii = 0
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) < 128) ascii++
  return Math.ceil(ascii / 4 + (text.length - ascii) / 1.5)
}

/** A tool use's own `text` is its result, already counted on the user message that carries it. */
function messageTokens(m: SessionMessage): number {
  const uses = m.toolUses.map(u => JSON.stringify(u.input ?? {})).join('')
  const results = (m.toolResults ?? []).map(r => r.text).join('')
  return estimateTokens(m.text + uses + results) + 4
}

const sumTokens = (msgs: readonly SessionMessage[]) => msgs.reduce((s, m) => s + messageTokens(m), 0)

function fold(text: string, rule: typeof USER_FOLD, marker: (omitted: number) => string): string {
  const t = text.trim()
  if (t.length <= rule.over) return t
  return t.slice(0, rule.head) + marker(t.length - rule.head - rule.tail) + t.slice(-rule.tail)
}

const foldUser = (t: string) => fold(t, USER_FOLD, n => `..[${n} chars omitted]..`)
const foldReply = (t: string) => fold(t, REPLY_FOLD, () => '[...truncated...]')
const collapse = (t: string) => t.replace(/\s+/g, ' ').trim()

// ───────────────────────────── transcript line pointers ─────────────────────────────

/**
 * The JSONL line of each message: the next row after the previous match, of the same role, whose
 * head starts with the message's first LINE_KEY_CHARS characters (whitespace collapsed). One
 * assistant message may span several rows (one per content block); its first matching row wins.
 * Rows are indexed once per distinct key length, so the walk stays linear in rows and messages.
 */
export function alignLines(msgs: readonly SessionMessage[], rows: readonly TranscriptRow[]): (number | undefined)[] {
  const keys = msgs.map(m => collapse(m.text).slice(0, LINE_KEY_CHARS))
  const lengths = new Set(keys.filter(k => k !== '').map(k => k.length))
  const buckets = new Map<string, { rows: TranscriptRow[]; next: number }>()
  for (const r of rows) {
    for (const n of lengths) {
      if (r.head.length < n) continue
      const key = `${r.role}\u0000${r.head.slice(0, n)}`
      const bucket = buckets.get(key) ?? { rows: [], next: 0 }
      bucket.rows.push(r)
      buckets.set(key, bucket)
    }
  }
  let after = 0
  return msgs.map((m, i) => {
    const head = keys[i]!
    const bucket = head ? buckets.get(`${m.role}\u0000${head}`) : undefined
    if (!bucket) return undefined
    while (bucket.next < bucket.rows.length && bucket.rows[bucket.next]!.line <= after) bucket.next++
    const row = bucket.rows[bucket.next]
    if (!row) return undefined
    bucket.next++
    after = row.line
    return row.line
  })
}

/** The first message whose transcript line is past coveredLine; msgs.length when all are covered. */
export function anchorFromCovered(lines: readonly (number | undefined)[], coveredLine: number): number {
  for (let i = 0; i < lines.length; i++) {
    const n = lines[i]
    if (n !== undefined && n > coveredLine) return i
  }
  return lines.length
}

// ───────────────────────────── message kinds ─────────────────────────────

const TEAMMATE_RE = /<teammate-message\b/
const TASK_NOTE_RE = /<task-notification>/
const IDLE_RE = /idle_notification/

const isToolResultOnly = (m: SessionMessage) => m.role === 'user' && (m.toolResults?.length ?? 0) > 0
/** A teammate report or a subagent completion notice: delegated-work results, kept in the summary layer. */
const isMachineMessage = (m: SessionMessage) =>
  m.role === 'user' && !isToolResultOnly(m) && (TEAMMATE_RE.test(m.text) || TASK_NOTE_RE.test(m.text))
/** A waiting notification: dropped from the dialogue entirely. */
const isIdleNotification = (m: SessionMessage) => m.role === 'user' && IDLE_RE.test(m.text) && !TEAMMATE_RE.test(m.text)
const isContinuationSummary = (m: SessionMessage) =>
  m.role === 'user' && m.text.trimStart().startsWith(CONTINUATION_HEAD)

/** A real human turn: a user message that is not tool traffic, a machine message, idle, or a summary. */
const isHumanTurnStart = (m: SessionMessage) =>
  m.role === 'user' &&
  !isToolResultOnly(m) &&
  m.text.trim() !== '' &&
  !isMachineMessage(m) &&
  !isIdleNotification(m) &&
  !isContinuationSummary(m)

/** Where a cut may land: a human turn, or an assistant message (its results follow it). */
const isStepBoundary = (m: SessionMessage) => isHumanTurnStart(m) || m.role === 'assistant'

/** Left out of the abbreviated dialogue: tool traffic, machine messages, idle, old summaries. */
const skipInDialogue = (m: SessionMessage) =>
  isToolResultOnly(m) || isMachineMessage(m) || isIdleNotification(m) || isContinuationSummary(m)

// ───────────────────────────── boundaries ─────────────────────────────

function lastCompactionIndex(msgs: readonly SessionMessage[]): number {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (isContinuationSummary(msgs[i]!)) return i
  }
  return -1
}

function countHumanTurns(msgs: readonly SessionMessage[], from: number, to: number): number {
  let n = 0
  for (let i = from; i < to; i++) if (isHumanTurnStart(msgs[i]!)) n++
  return n
}

/** Human-turn-start indices strictly before `to`, oldest first. */
function humanTurnStarts(msgs: readonly SessionMessage[], to: number): number[] {
  const out: number[] = []
  for (let i = 0; i < to; i++) if (isHumanTurnStart(msgs[i]!)) out.push(i)
  return out
}

/**
 * The dialogue start: the span start, moved back far enough to hold MIN_TURNS human turns. Fewer
 * than MIN_TURNS exist in the whole conversation -> the first human turn. None -> the span start.
 */
function widenSpanStart(msgs: readonly SessionMessage[], spanStart: number, dialogueEnd: number): number {
  if (countHumanTurns(msgs, spanStart, dialogueEnd) >= MIN_TURNS) return spanStart
  const starts = humanTurnStarts(msgs, dialogueEnd)
  if (starts.length === 0) return spanStart
  const target = starts.length >= MIN_TURNS ? starts[starts.length - MIN_TURNS]! : starts[0]!
  return Math.min(spanStart, target)
}

/** The start of the last two full exchanges (or the one, or `fallback` when none). */
function lastTwoExchangesStart(msgs: readonly SessionMessage[], fallback: number): number {
  const starts = humanTurnStarts(msgs, msgs.length)
  if (starts.length === 0) return fallback
  return starts.length >= 2 ? starts[starts.length - 2]! : starts[starts.length - 1]!
}

/** The start of the human turn holding the anchor, within the span; -1 when none starts there. */
function humanTurnAt(msgs: readonly SessionMessage[], spanStart: number, anchor: number): number {
  for (let i = Math.min(anchor, msgs.length - 1); i >= spanStart; i--) if (isHumanTurnStart(msgs[i]!)) return i
  return -1
}

function stepStartFrom(msgs: readonly SessionMessage[], from: number): number {
  let i = from
  while (i < msgs.length && !isStepBoundary(msgs[i]!)) i++
  return i
}

/**
 * With no human turn in the span, the tail starts here: up to WALK_BACK_STEPS step boundaries back
 * from `from`, at the nearest assistant message that carries explanatory text; `from` when none.
 */
function walkBackToExplanation(msgs: readonly SessionMessage[], from: number, floor: number): number {
  let steps = 0
  for (let i = from - 1; i >= floor && steps < WALK_BACK_STEPS; i--) {
    if (!isStepBoundary(msgs[i]!)) continue
    steps++
    if (msgs[i]!.role === 'assistant' && msgs[i]!.text.trim() !== '') return i
  }
  return from
}

// ───────────────────────────── the abbreviated dialogue ─────────────────────────────

/** Counts how many abbreviated messages got a line pointer. */
type MarkerCount = { assigned: number; total: number }

function abbreviate(m: SessionMessage, line: number | undefined, count: MarkerCount): SessionMessage | undefined {
  if (skipInDialogue(m)) return undefined
  const text = m.role === 'user' ? foldUser(m.text) : foldReply(m.text)
  if (text === '') return undefined
  count.total++
  if (line !== undefined) count.assigned++
  return { role: m.role, text: (line === undefined ? '' : `[L${line}] `) + text, toolUses: [] }
}

/** Consecutive built messages of one role joined, so the built part alternates as a transcript does. */
function mergeRuns(msgs: readonly SessionMessage[]): SessionMessage[] {
  const out: SessionMessage[] = []
  for (const m of msgs) {
    const last = out[out.length - 1]
    if (last && last.role === m.role && !last.handle && !m.handle) out[out.length - 1] = { ...last, text: `${last.text}\n\n${m.text}` }
    else out.push(m)
  }
  return out
}

function abbreviatedDialogue(msgs: readonly SessionMessage[], from: number, to: number, lines: readonly (number | undefined)[], count: MarkerCount): SessionMessage[] {
  const out: SessionMessage[] = []
  for (let i = from; i < to; i++) {
    const m = abbreviate(msgs[i]!, lines[i], count)
    if (m) out.push(m)
  }
  return mergeRuns(out)
}

// ───────────────────────────── the tail ─────────────────────────────

/** How many steps (runs of assistant messages with their results) a stretch holds. */
function countSteps(msgs: readonly SessionMessage[]): number {
  return msgs.filter((m, i) => m.role === 'assistant' && msgs[i - 1]?.role !== 'assistant').length
}

function omissionNote(msgs: readonly SessionMessage[], from: number, to: number, lines: readonly (number | undefined)[]): string {
  const known = lines.slice(from, to).filter((n): n is number => n !== undefined)
  const range = known.length ? `, read L${Math.min(...known)}–L${Math.max(...known)}` : ''
  return `…[${countSteps(msgs.slice(from, to))} tool steps omitted${range}]…`
}

/**
 * The note as a message between `prev` and `next`: an assistant message when neither neighbour is
 * one; next to an assistant, a user message right after the opening human message; else none.
 */
function placeNote(note: string, prev: SessionMessage, next: SessionMessage | undefined): SessionMessage | undefined {
  if (prev.role !== 'assistant' && next?.role !== 'assistant') return { role: 'assistant', text: note, toolUses: [] }
  if (isHumanTurnStart(prev)) return { role: 'user', text: note, toolUses: [] }
  return undefined
}

type Tail = { start: number; messages: SessionMessage[] }

/**
 * The tail's verbatim region.
 *
 * `turnAnchor` picks where it starts: the human turn that holds it, pulled back by the last-two-
 * exchanges floor. `cutAnchor` (coveredLine) is where an over-cap turn is cut: a turn longer than
 * `cap` keeps its opening message, one note for the steps the summary covers (up to cutAnchor), and
 * every step from cutAnchor on. The cap is a hard limit, so when the last two exchanges would
 * themselves exceed it the cut still applies. With no human turn in the span, the steps from the
 * anchor on, started at an explanatory message up to WALK_BACK_STEPS steps back.
 */
function buildTail(msgs: readonly SessionMessage[], spanStart: number, turnAnchor: number, cutAnchor: number, cap: number, lines: readonly (number | undefined)[], report: Report): Tail {
  Object.assign(report, { longTurnCompressed: false, omittedSteps: 0, omittedNoteRole: null, omittedNoteDropped: false, tailWalkedBack: 0 })
  const human = humanTurnAt(msgs, spanStart, turnAnchor)
  if (human < 0) {
    const natural = stepStartFrom(msgs, Math.max(turnAnchor, spanStart))
    const start = walkBackToExplanation(msgs, natural, spanStart)
    report.tailWalkedBack = natural - start
    return { start, messages: msgs.slice(start) }
  }
  const whole = msgs.slice(human)
  const from = stepStartFrom(msgs, Math.max(cutAnchor, human + 1))
  if (sumTokens(whole) <= cap || from === human + 1) return { start: human, messages: whole }
  const opening = msgs[human]!
  const note = placeNote(omissionNote(msgs, human + 1, from, lines), opening, msgs[from])
  Object.assign(report, {
    longTurnCompressed: true,
    omittedSteps: countSteps(msgs.slice(human + 1, from)),
    omittedNoteRole: note?.role ?? null,
    omittedNoteDropped: !note,
  })
  return { start: human, messages: [opening, ...(note ? [note] : []), ...msgs.slice(from)] }
}

/**
 * The dialogue may end in a reply where the tail starts with one (no human turn in the span):
 * that last reply goes back as a user message, so no two assistant messages meet.
 */
function seamDialogue(dialogue: SessionMessage[], tail: readonly SessionMessage[], report: Report): SessionMessage[] {
  const last = dialogue[dialogue.length - 1]
  if (!last || last.role !== 'assistant' || tail[0]?.role !== 'assistant') return dialogue
  report.dialogueLastReplyAsUser = true
  return [...dialogue.slice(0, -1), { role: 'user', text: `(your replies before the steps below, abbreviated)\n${last.text}`, toolUses: [] }]
}

// ───────────────────────────── compacting ─────────────────────────────

type Summary = { text: string; source: 'prepared' | 'core'; anchor: number; lastSeen?: string }

function continuationFoot(transcript: TranscriptPointer | undefined): string {
  const where = transcript
    ? `A message that begins [L{n}] is abbreviated: read line n of the transcript at ${transcript.path} for its full text (these line numbers are this transcript's, even when this summary is later restored into another session).`
    : 'Line pointers into the transcript are unavailable for this compaction, so abbreviated messages carry no [L{n}] marker.'
  return `${CONTINUATION_ORDER}\n\n${where}`
}

function summaryMessage(text: string, transcript: TranscriptPointer | undefined): SessionMessage {
  const body = text.startsWith(CONTINUATION_HEAD) ? text : `${CONTINUATION_HEAD} The summary below covers the earlier portion of the conversation.\n\n${text}`
  return { role: 'user', text: `${body}\n\n${continuationFoot(transcript)}`, toolUses: [] }
}

export function assemble(
  msgs: readonly SessionMessage[],
  summary: Summary,
  threshold: number,
  report: Report,
  transcript?: TranscriptPointer,
): SessionMessage[] {
  const lines = transcript?.lines ?? []
  const count: MarkerCount = { assigned: 0, total: 0 }
  const spanStart = lastCompactionIndex(msgs) + 1
  const anchor = Math.max(summary.anchor, spanStart)
  const cap = threshold > 0 ? Math.min(Math.floor(LONG_TURN_CAP.fraction * threshold), LONG_TURN_CAP.tokens) : LONG_TURN_CAP.tokens
  // The last two full exchanges are always verbatim, even when coveredLine lands after them; the
  // LONG_TURN_CAP cut still uses coveredLine so a giant turn is never kept whole.
  const anchorForTail = Math.max(spanStart, Math.min(anchor, lastTwoExchangesStart(msgs, anchor)))
  const tail = buildTail(msgs, spanStart, anchorForTail, anchor, cap, lines, report)
  const dialogueStart = widenSpanStart(msgs, spanStart, tail.start)
  const dialogue = seamDialogue(abbreviatedDialogue(msgs, dialogueStart, tail.start, lines, count), tail.messages, report)
  const head = summaryMessage(summary.text, transcript)
  Object.assign(report, {
    messagesBefore: msgs.length, spanStart, dialogueStart, anchor, anchorForTail, tailStart: tail.start,
    anchorFromLastSeen: summary.lastSeen ?? null,
    summaryTokens: messageTokens(head),
    dialogueMessages: dialogue.length, dialogueTokens: sumTokens(dialogue),
    dialogueHumanTurns: countHumanTurns(msgs, dialogueStart, tail.start),
    tailMessages: tail.messages.length, tailTokens: sumTokens(tail.messages), longTurnCap: cap,
    tailStartsAtHumanTurn: tail.start < msgs.length ? isHumanTurnStart(msgs[tail.start]!) : null,
    lineMarkersAssigned: count.assigned, lineMarkersTotal: count.total,
    transcriptPath: transcript?.path ?? null,
  })
  return [head, ...dialogue, ...tail.messages]
}

async function readThreshold($: EngineInterface): Promise<number | undefined> {
  if (thresholdCache !== undefined) return thresholdCache
  const usage = await $.session.usage({ breakdown: 'summary' })
  thresholdCache = usage.context.breakdown?.autoCompactThreshold
  return thresholdCache
}

/** Runs scripts/transcript-lines.js and aligns its rows; a reason string when it cannot. */
async function readTranscript($: EngineInterface, msgs: readonly SessionMessage[]): Promise<TranscriptPointer | string> {
  try {
    const script = `${$.plugin.root}/scripts/transcript-lines.js`
    const run = await $.process.run(['node', script, await $.session.id(), await $.session.cwd()], { timeoutMs: TRANSCRIPT_LINES_TIMEOUT_MS })
    if (run.exitCode !== 0) return `transcript-lines exited ${run.exitCode}: ${run.stderr.trim().slice(0, 200)}`
    if (run.isStdoutTruncated) return 'transcript-lines output over 4 MiB'
    const out = JSON.parse(run.stdout) as { path: string; rows: TranscriptRow[] }
    return { path: out.path, lines: alignLines(msgs, out.rows) }
  } catch (err) {
    return `transcript-lines failed: ${err}`
  }
}

/**
 * The marker directories under the plugin's data root (cache-paths.listProjects() skips dot dirs).
 * The plugin root is not used: an installed plugin's folder is overwritten on every update.
 */
const DATA_DIR = '.claude/super-token-saver-data'
const PREPARED_DIR = `${DATA_DIR}/.super-compact`
const HANDLED_DIR = `${DATA_DIR}/.super-compact`

const dirname = (p: string) => p.slice(0, Math.max(0, p.lastIndexOf('/')))
const basename = (p: string) => p.slice(p.lastIndexOf('/') + 1)

async function preparedPath($: EngineInterface): Promise<string | undefined> {
  const home = await $.env.get('HOME')
  if (!home) return undefined
  return `${home}/${PREPARED_DIR}/${await $.session.id()}.prepared.json`
}

/** The shell-prepared summary for this session, when one is on disk; undefined otherwise. */
async function readPrepared($: EngineInterface): Promise<Prepared | undefined> {
  const path = await preparedPath($)
  if (!path) return undefined
  try {
    if (!(await $.fs.exists(path))) return undefined
    return JSON.parse(await $.fs.read(path)) as Prepared
  } catch {
    return undefined
  }
}

/** Marks the prepared file consumed so a second compaction cannot reuse the same summary. */
async function clearPrepared($: EngineInterface): Promise<void> {
  const path = await preparedPath($)
  if (!path) return
  try {
    await $.fs.write(path, JSON.stringify({ status: 'consumed', consumedAt: Date.now() }, null, 2))
  } catch {
    /* the watcher re-arms by removing it once the context falls below half the threshold */
  }
}

/** Persists this compaction's summary to <session cache>/super-compact/<n>.md for next session's /s-continue. */
async function persistSummary($: EngineInterface, msgs: readonly SessionMessage[], summaryText: string, transcript: TranscriptPointer | undefined, report: Report): Promise<void> {
  const home = await $.env.get('HOME')
  if (!home || !transcript) {
    report.summaryPersisted = false
    return
  }
  const projectHash = basename(dirname(transcript.path))
  const sid = basename(transcript.path).replace(/\.jsonl$/, '')
  const n = msgs.filter(isContinuationSummary).length + 1
  const path = `${home}/${DATA_DIR}/${projectHash}/${sid}/super-compact/${n}.md`
  try {
    await $.fs.write(path, `${summaryText}\n`)
    report.summaryFile = path
  } catch (err) {
    report.summaryPersisted = `failed: ${err}`
  }
}

/** Writes the report as the handled marker; returns its path, or undefined when HOME is unknown. */
async function writeReport($: EngineInterface, report: Report): Promise<string | undefined> {
  const home = await $.env.get('HOME')
  if (!home) {
    $.ui.log('super-compact: HOME unset, no handled marker written; the shell restore will also run')
    return undefined
  }
  const path = `${home}/${HANDLED_DIR}/${await $.session.id()}.json`
  await $.fs.write(path, JSON.stringify({ ...report, writtenAt: Date.now() }, null, 2))
  $.ui.log(`super-compact: ${report.source} summary, dialogue ${report.dialogueTokens ?? '?'} tok, tail ${report.tailTokens ?? '?'} tok (${path})`)
  return path
}

async function compact($: EngineInterface, e: SessionCompactInput, next: Next<'session.compact'>): Promise<SessionCompactResult> {
  const threshold = (await readThreshold($)) ?? 0
  const prep = await readPrepared($)
  const transcript = await readTranscript($, e.messages)
  const pointer = typeof transcript === 'string' ? undefined : transcript
  const report: Report = { trigger: e.trigger, threshold }
  const ready = prep?.status === 'ready' && !!prep.summary && typeof prep.coveredLine === 'number'

  let summary: Summary
  if (ready && pointer) {
    const anchor = anchorFromCovered(pointer.lines, prep!.coveredLine!)
    summary = { text: prep!.summary!, source: 'prepared', anchor, lastSeen: prep!.lastSeen }
    report.coveredLine = prep!.coveredLine
  } else {
    const core = await next(e)
    if (core.skip !== undefined) return core
    const text = core.messages.filter(m => !m.handle).map(m => m.text).join('\n\n').trim()
    summary = { text, source: 'core', anchor: e.messages.length }
    report.preparedStatus = prep?.status ?? 'absent'
    if (prep?.reason) report.preparedReason = prep.reason
    if (ready && !pointer) report.preparedFallback = 'transcript-unavailable'
  }

  report.source = summary.source
  if (typeof transcript === 'string') report.linePointersUnavailable = transcript
  const messages = assemble(e.messages, summary, threshold, report, pointer)
  await persistSummary($, e.messages, summary.text, pointer, report)
  await clearPrepared($)
  await writeReport($, report)
  return { messages, tokensBefore: sumTokens(e.messages) }
}

// ───────────────────────────── wiring ─────────────────────────────

export const register: Register = on => {
  on('session.compact', async ($, e, next) => {
    if (e.agentId !== undefined || e.trigger === 'precompute') return next(e)
    let coreRan = false
    const core: Next<'session.compact'> = Object.assign((x: SessionCompactInput) => {
      coreRan = true
      return next(x)
    }, next)
    try {
      return await compact($, e, core)
    } catch (err) {
      $.ui.log(`super-compact: fell back to core compaction: ${err}`)
      return coreRan ? { skip: `super-compact failed after core ran: ${err}` } : next(e)
    }
  }).catch(($, e, next) => (next.called ? { skip: 'super-compact: its hook failed after core ran' } : next(e)))
}
