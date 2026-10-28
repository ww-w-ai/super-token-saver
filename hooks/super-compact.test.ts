import { expect, test } from 'claude-code/testing'
import type { SessionMessage } from 'claude-code'
import { alignLines, anchorFromCovered, assemble, type TranscriptPointer } from './super-compact'

const HEAD = 'This session is being continued from a previous conversation that ran out of context.'
const THRESHOLD = 520_000
const PATH = '/home/u/.claude/projects/-p/sid.jsonl'

const user = (text: string, handle: string): SessionMessage => ({ role: 'user', text, toolUses: [], handle })
const reply = (text: string, handle: string, toolId?: string, input: Record<string, unknown> = { command: 'ls' }): SessionMessage => ({
  role: 'assistant',
  text,
  toolUses: toolId ? [{ tool_use_id: toolId, tool: 'Bash', input } as SessionMessage['toolUses'][number]] : [],
  handle,
})
const result = (toolId: string, text: string, handle: string): SessionMessage => ({
  role: 'user',
  text: '',
  toolUses: [],
  toolResults: [{ tool_use_id: toolId, text, isError: false }],
  handle,
})

/** Line n for message i: every message with text gets 10 + 2i, the others none. */
const pointer = (msgs: readonly SessionMessage[]): TranscriptPointer => ({
  path: PATH,
  lines: msgs.map((m, i) => (m.text.trim() ? 10 + 2 * i : undefined)),
})

/** Every tool_result answers a tool_use in the output, and every tool_use has its result. */
function pairsWhole(out: readonly SessionMessage[]): boolean {
  const uses = new Set(out.flatMap(m => m.toolUses.map(u => u.tool_use_id)))
  const results = new Set(out.flatMap(m => (m.toolResults ?? []).map(r => r.tool_use_id)))
  return [...uses].every(id => results.has(id)) && [...results].every(id => uses.has(id))
}

function noTwoAssistantsInARow(out: readonly SessionMessage[]): boolean {
  return out.every((m, i) => i === 0 || !(m.role === 'assistant' && out[i - 1]!.role === 'assistant'))
}

/** `n` plain user/reply exchanges, oldest first: handles u0,a0,u1,a1,… */
function exchanges(n: number): SessionMessage[] {
  const msgs: SessionMessage[] = []
  for (let i = 0; i < n; i++) {
    msgs.push(user(`question ${i} ` + 'x'.repeat(600), `u${i}`))
    msgs.push(reply(`answer ${i} ` + 'y'.repeat(300), `a${i}`))
  }
  return msgs
}

/** One human turn: the question, `steps` tool calls with big results, and a final answer. */
function longTurn(steps: number, resultChars: number): SessionMessage[] {
  const msgs: SessionMessage[] = [user('run everything', 'h0')]
  for (let i = 0; i < steps; i++) {
    msgs.push(reply(`step ${i} ` + 'w'.repeat(300), `a${i}`, `t${i}`, { command: 'c'.repeat(900) }))
    msgs.push(result(`t${i}`, 'z'.repeat(resultChars), `r${i}`))
  }
  msgs.push(reply('FINAL ANSWER', 'hz'))
  return msgs
}

test('anchorFromCovered is the first message whose line is past coveredLine', async () => {
  expect(anchorFromCovered([10, 12, undefined, 16], 12)).toBe(3)
  expect(anchorFromCovered([10, 12, 14], 20)).toBe(3)
  expect(anchorFromCovered([undefined, 50], 10)).toBe(1)
  expect(anchorFromCovered([], 10)).toBe(0)
})

test('the anchor keeps the turns after it verbatim and folds the ones before', async () => {
  const msgs = [
    user('u1 ' + 'x'.repeat(800), 'h0'),
    reply('a1 ' + 'y'.repeat(400), 'h1', 't1'),
    result('t1', 'RESULT_T1', 'h2'),
    reply('done', 'h3'),
    user('u2 middle', 'h4'),
    reply('a2 middle', 'h5'),
    user('u3 recent', 'h6'),
    reply('a3 recent', 'h7', 't2'),
    result('t2', 'out2', 'h8'),
  ]
  const report: Record<string, unknown> = {}
  const out = assemble(msgs, { text: 'SUMMARY', source: 'prepared', anchor: 6 }, THRESHOLD, report)

  expect(out[0]!.text.startsWith(HEAD)).toBe(true)
  expect(out[0]!.text.includes('SUMMARY')).toBe(true)
  // coveredLine anchor is message 6, but the last two exchanges start at 4, so the tail starts there.
  expect(report.tailStart).toBe(4)
  expect(report.tailStartsAtHumanTurn).toBe(true)
  expect(report.longTurnCompressed).toBe(false)
  expect(out.slice(-5).map(m => m.handle)).toEqual(['h4', 'h5', 'h6', 'h7', 'h8'])
  expect(out.find(m => !m.handle && m.text.includes('u1'))!.text.includes('..[303 chars omitted]..')).toBe(true)
  expect(out.find(m => !m.handle && m.text.includes('a1'))!.text.includes('[...truncated...]')).toBe(true)
  expect(out.some(m => m.text.includes('RESULT_T1') && !m.handle)).toBe(false)
  expect(pairsWhole(out)).toBe(true)
})

test('abbreviated messages carry [L{n}] and the summary names the transcript', async () => {
  const msgs = [
    user('first question', 'h0'),
    reply('first answer', 'h1'),
    user('second question', 'h2'),
    reply('second answer', 'h3'),
    user('third question', 'h4'),
    reply('third answer', 'h5'),
  ]
  const report: Record<string, unknown> = {}
  const out = assemble(msgs, { text: 'S', source: 'prepared', anchor: 4 }, THRESHOLD, report, pointer(msgs))

  expect(report.tailStart).toBe(2)
  expect(out[1]!.text).toBe('[L10] first question')
  expect(out[2]!.text).toBe('[L12] first answer')
  expect(out[0]!.text.includes(`the transcript at ${PATH}`)).toBe(true)
  expect(out[0]!.text.includes('even when this summary is later restored into another session')).toBe(true)
  expect(out.filter(m => m.handle).every(m => !m.text.startsWith('[L'))).toBe(true)
  expect(report.lineMarkersAssigned).toBe(2)
  expect(report.lineMarkersTotal).toBe(2)
})

test('without line pointers no marker appears and the summary says so', async () => {
  const msgs = [
    user('first question', 'h0'),
    reply('first answer', 'h1'),
    user('second question', 'h2'),
    reply('second answer', 'h3'),
    user('third question', 'h4'),
    reply('third answer', 'h5'),
  ]
  const out = assemble(msgs, { text: 'S', source: 'prepared', anchor: 4 }, THRESHOLD, {})

  expect(out.some(m => m.text.startsWith('[L'))).toBe(false)
  expect(out[0]!.text.includes('Line pointers into the transcript are unavailable')).toBe(true)
})

test('alignLines takes the next unused row of the same role whose head starts with the text', async () => {
  const msgs = [
    user('again', 'h0'),
    reply('the reply  spans\nseveral blocks', 'h1'),
    user('again', 'h2'),
    user('never written', 'h3'),
    result('t1', 'r', 'h4'),
  ]
  const rows = [
    { line: 3, role: 'user' as const, head: 'again' },
    { line: 4, role: 'assistant' as const, head: 'the reply spans' },
    { line: 5, role: 'assistant' as const, head: 'several blocks' },
    { line: 6, role: 'assistant' as const, head: 'again' },
    { line: 9, role: 'user' as const, head: 'again' },
  ]
  expect(alignLines(msgs, rows)).toEqual([3, undefined, 9, undefined, undefined])
  const joined = [reply('the reply spans several blocks', 'h1')]
  expect(alignLines(joined, [{ line: 4, role: 'assistant', head: 'the reply spans several blocks and more' }])).toEqual([4])
})

test('the tail starts at the human turn that contains the anchor', async () => {
  const msgs = [
    user('older question', 'h0'),
    reply('older answer', 'h1'),
    user('old question', 'h2'),
    reply('working', 'h3', 't1'),
    result('t1', 'ok', 'h4'),
    reply('still working', 'h5', 't2'),
    result('t2', 'ok', 'h6'),
    user('current question', 'h7'),
    reply('done', 'h8', 't3'),
    result('t3', 'ok', 'h9'),
  ]
  const report: Record<string, unknown> = {}
  const out = assemble(msgs, { text: 'S', source: 'prepared', anchor: 3 }, THRESHOLD, report)

  // last-two-exchanges start = message 2 (old question); coveredLine anchor 3 is inside it.
  expect(report.tailStart).toBe(2)
  expect(report.tailStartsAtHumanTurn).toBe(true)
  expect(out.slice(-8).map(m => m.handle)).toEqual(['h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'h9'])
  expect(pairsWhole(out)).toBe(true)
  expect(noTwoAssistantsInARow(out)).toBe(true)
})

test('without a human turn in the span the tail walks back to an explanatory step', async () => {
  const msgs = [
    user(`${HEAD} old summary`, 'h0'),
    reply('continuing', 'h1', 't1'),
    result('t1', 'ok', 'h2'),
    reply('next step', 'h3', 't2'),
    result('t2', 'ok', 'h4'),
    reply('done', 'h5'),
  ]
  const report: Record<string, unknown> = {}
  const out = assemble(msgs, { text: 'S', source: 'prepared', anchor: 3 }, THRESHOLD, report)

  expect(report.spanStart).toBe(1)
  expect(report.tailStartsAtHumanTurn).toBe(false)
  // anchor 3 lands on the 'next step' reply; the tail walks back to the 'continuing' explanation.
  expect(report.tailStart).toBe(1)
  expect(report.tailWalkedBack).toBe(2)
  expect(out.some(m => m.text.includes('old summary') && !m.handle)).toBe(false)
  expect(pairsWhole(out)).toBe(true)
  expect(noTwoAssistantsInARow(out)).toBe(true)
})

test('never two assistant messages in a row', async () => {
  const msgs: SessionMessage[] = [user('q0', 'u0')]
  for (let i = 0; i < 5; i++) {
    msgs.push(reply(`call ${i}`, `a${i}`, `t${i}`))
    msgs.push(result(`t${i}`, 'ok', `r${i}`))
  }
  msgs.push(reply('answer 0', 'z0'), user('q1', 'u1'), reply('answer 1', 'z1'), user('q2', 'u2'), reply('answer 2', 'z2'))
  const out = assemble(msgs, { text: 'S', source: 'prepared', anchor: msgs.length - 2 }, THRESHOLD, {}, pointer(msgs))

  expect(noTwoAssistantsInARow(out)).toBe(true)
  expect(out.slice(-2).map(m => m.handle)).toEqual(['u2', 'z2'])
  expect(pairsWhole(out)).toBe(true)
})

test('the dialogue has no cap: every turn of the span comes back', async () => {
  const msgs = exchanges(400)
  const report: Record<string, unknown> = {}
  const out = assemble(msgs, { text: 'S', source: 'prepared', anchor: msgs.length }, THRESHOLD, report)

  // the last two exchanges are the verbatim tail (4 messages); the other 398 are abbreviated.
  expect(report.dialogueMessages).toBe(796)
  expect(report.dialogueHumanTurns).toBe(398)
  expect(out.some(m => !m.handle && m.text.startsWith('question 0 '))).toBe(true)
  expect(out.slice(-4).map(m => m.handle)).toEqual(['u398', 'a398', 'u399', 'a399'])
})

test('the abbreviated dialogue widens back to at least MIN_TURNS human turns', async () => {
  // Two compaction spans: 3 old exchanges, a boundary summary, then 2 new exchanges.
  const old = exchanges(3) // u0..a2
  const span = [
    user(`${HEAD} prior summary`, 'hs'),
    user('new one', 'n0'),
    reply('reply one', 'r0'),
    user('new two', 'n1'),
    reply('reply two', 'r1'),
  ]
  const msgs = [...old, ...span]
  const report: Record<string, unknown> = {}
  const out = assemble(msgs, { text: 'S', source: 'prepared', anchor: msgs.length }, THRESHOLD, report)

  // span alone has 2 human turns (< MIN_TURNS 10), so the dialogue widens back across the boundary.
  expect(report.spanStart).toBe(old.length + 1)
  expect(report.dialogueStart).toBe(0)
  // the old boundary summary message is never folded into the dialogue.
  expect(out.some(m => !m.handle && m.text.includes('prior summary'))).toBe(false)
  expect(out.some(m => !m.handle && m.text.startsWith('question 0 '))).toBe(true)
  // 3 old exchanges are abbreviated; the last two ('new one' + 'new two') are the verbatim tail.
  expect(report.dialogueHumanTurns).toBe(3)
})

test('machine messages and idle notifications stay out of the abbreviated dialogue', async () => {
  const msgs = [
    user('plan the work', 'h0'),
    reply('dispatching', 'h1'),
    user('<teammate-message from="variant-a">finished the audit, 3 findings</teammate-message>', 'h2'),
    user('<task-notification>subagent done: see report.md</task-notification>', 'h3'),
    user('{"idle_notification":{"reason":"waiting"}}', 'h4'),
    user('what did they find?', 'h5'),
    reply('here is the summary', 'h6'),
    user('thanks, proceed', 'h7'),
    reply('proceeding', 'h8'),
  ]
  const report: Record<string, unknown> = {}
  const out = assemble(msgs, { text: 'S', source: 'prepared', anchor: 5 }, THRESHOLD, report)

  const dialogue = out.filter(m => !m.handle).map(m => m.text).join('\n')
  expect(dialogue.includes('teammate-message')).toBe(false)
  expect(dialogue.includes('task-notification')).toBe(false)
  expect(dialogue.includes('idle_notification')).toBe(false)
  expect(dialogue.includes('plan the work')).toBe(true)
  // only 'plan the work', 'what did they find?' and 'thanks, proceed' count as human turns.
  expect(report.dialogueHumanTurns).toBe(1) // plan the work; the last two exchanges are the tail
  expect(report.tailStart).toBe(5) // 'what did they find?' opens the last two exchanges
})

test('a long turn keeps its question, a note for the covered steps, and every step after verbatim', async () => {
  const msgs = longTurn(120, 2_000)
  const report: Record<string, unknown> = {}
  const out = assemble(msgs, { text: 'S', source: 'prepared', anchor: 201 }, THRESHOLD, report, pointer(msgs))

  expect(report.longTurnCompressed).toBe(true)
  expect(report.omittedSteps).toBe(100)
  expect(report.omittedNoteDropped).toBe(false)
  expect(out[1]!.handle).toBe('h0')
  expect(out[2]!.handle).toBe(undefined)
  expect(out[2]!.text).toBe('…[100 tool steps omitted, read L12–L408]…')
  expect(out.slice(3).map(m => m.handle)).toEqual(msgs.slice(201).map(m => m.handle))
  expect(out[out.length - 1]!.handle).toBe('hz')
  expect(pairsWhole(out)).toBe(true)
  expect(noTwoAssistantsInARow(out)).toBe(true)
})

test('an anchor on a tool result moves to the next step, its call omitted with it', async () => {
  const msgs = longTurn(120, 2_000)
  const out = assemble(msgs, { text: 'S', source: 'prepared', anchor: 202 }, THRESHOLD, {}, pointer(msgs))

  expect(out[3]!.handle).toBe('a101')
  expect(out.some(m => m.handle === 'r100' || m.handle === 'a100')).toBe(false)
  expect(pairsWhole(out)).toBe(true)
  expect(noTwoAssistantsInARow(out)).toBe(true)
})

test('a long turn under a core summary keeps the question and notes every step', async () => {
  const msgs = longTurn(120, 2_000)
  const report: Record<string, unknown> = {}
  const out = assemble(msgs, { text: 'S', source: 'core', anchor: msgs.length }, THRESHOLD, report)

  expect(out.map(m => m.handle)).toEqual([undefined, 'h0', undefined])
  expect(out[2]!.role).toBe('assistant')
  expect(out[2]!.text).toBe('…[121 tool steps omitted]…')
  expect(report.omittedNoteRole).toBe('assistant')
})

test('only the span after the last compaction is re-attached as the tail; the summary covers the rest', async () => {
  const msgs = [
    user('ancient', 'h0'),
    reply('ancient reply', 'h1'),
    user(`${HEAD} old summary`, 'h2'),
    user('new question', 'h3'),
    reply('new answer', 'h4'),
  ]
  const report: Record<string, unknown> = {}
  const out = assemble(msgs, { text: 'S', source: 'prepared', anchor: 3 }, THRESHOLD, report)

  expect(report.spanStart).toBe(3)
  // the boundary summary itself is never re-attached (section A already carries it).
  expect(out.some(m => m.text.includes('old summary') && !m.handle)).toBe(false)
  // the tail is the post-boundary span, verbatim.
  expect(out.slice(-2).map(m => m.handle)).toEqual(['h3', 'h4'])
})
