import { expect, test } from 'claude-code/testing'
import { STALE_HOOKS_LABEL } from './super-compact'

const SPINNER = {
  plugin: 'super-token-saver',
  component: 'Spinner',
  requestId: 'main',
  surface: 'terminal',
} as const

const props = (message: string | null) => ({ word: 'Sauteing', message, suffix: '…', mode: 'responding' as const })

/** The engine stand-in beneath the module: it draws the `message` it is handed, or the word. */
function engineDrawsMessageOrWord(on: Parameters<Parameters<typeof test>[1]>[1]) {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    if (e.component !== 'Spinner') return <Text>other</Text>
    return <Text>{e.props.message ?? e.props.word}</Text>
  })
}

test('the stale SessionStart label is drawn as the engine’s own word', async ($, on) => {
  engineDrawsMessageOrWord(on)

  const ui = await $.ui.mount({ ...SPINNER, props: props(STALE_HOOKS_LABEL) })

  expect((await ui.find({ type: 'Text' }))?.text).toBe('Sauteing')
  await ui.unmount()
})

test('any other spinner text is left as the engine had it', async ($, on) => {
  engineDrawsMessageOrWord(on)

  for (const message of ['Running PreCompact hooks…', 'Compacting conversation…', null]) {
    const ui = await $.ui.mount({ ...SPINNER, props: props(message) })

    expect((await ui.find({ type: 'Text' }))?.text).toBe(message ?? 'Sauteing')
    await ui.unmount()
  }
})
