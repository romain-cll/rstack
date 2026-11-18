// The hooks of pilot/hooks/register.tsx, through the plugin kit.
//
// Contract these tests fix beyond the spec:
// - the pane draws the unshaped array stored at `pilot.tickets` in `$.state`;
//   each element is a ticket of tickets.ts plus its derived `state`
//   ({ worktree, slug, title, status, session?, state, review?, pr? });
// - a poll reads `git worktree list --porcelain` through `$.process.run`;
// - `/pilot` is the command `pilot`.
import { expect, mock, test } from 'claude-code/testing'

const PILOT_PANE_PROPS = {
  title: 'Pilot',
  isFocused: false,
  bodyColumns: 60,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
} as const

const PROCESS_OK = {
  exitCode: 0,
  stdout: '',
  stderr: '',
  isStdoutTruncated: false,
  isStderrTruncated: false,
}

const OPEN_TOOL = 'mcp__ccd_window__open_session_in'

// What the engine and the world answer beneath the plugin.
function world(on: any, who = { id: 'A', cwd: '/work/a' }) {
  const clock = mock.clock(on)
  // The store is a Map the test can read: the kit's `$` has no store noun.
  const store = new Map<string, unknown>()
  on('store.get', (_: any, e: any) => ({ value: store.get(e.key) }))
  on('store.set', (_: any, e: any) => {
    store.set(e.key, JSON.parse(JSON.stringify(e.value)))

    return { value: undefined }
  })
  on('store.delete', (_: any, e: any) => {
    store.delete(e.key)

    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...store.keys()] }))
  const seen = {
    opened: [] as string[],
    polls: 0,
    tools: [] as any[],
    processes: [] as string[][],
  }
  on('session.id', () => ({ value: who.id }))
  on('session.cwd', () => ({ value: who.cwd }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('command.run', () => ({ text: '' }))
  on('command.register', () => ({ value: { command: 'pilot' } }))
  on('ui.open', (_: any, e: any) => {
    seen.opened.push(e.id)

    return { value: { isPlaced: true } }
  })
  on('ui.close', () => ({ value: undefined }))
  on('process.run', (_: any, e: any) => {
    seen.processes.push([...e.argv])
    if (e.argv[0] === 'git' && e.argv.includes('worktree')) seen.polls += 1

    return { value: PROCESS_OK }
  })
  // What the app answers to the Open button: a test sets `openAnswer`.
  const app = {
    openAnswer: (): any => ({ result: {}, text: 'ok' }),
    askAnswer: async (): Promise<any> => ({ result: {} }),
  }
  on('tool.call', (_: any, e: any) => {
    seen.tools.push(e)
    if (e.tool === OPEN_TOOL) return app.openAnswer()
    if (e.tool === 'AskUserQuestion') return app.askAnswer()

    return { result: {}, text: '[]' }
  })

  return { clock, seen, who, store, app }
}

const slash = ($: any, command: string) =>
  $.command.run({
    command,
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })

const start = ($: any, cwd: string) =>
  $.session.start({ cwd, surface: 'desktop', isInteractive: true })

function pendingQuestions(store: Map<string, unknown>) {
  return [...store.values()].filter(
    (value: any) => value && typeof value === 'object' && 'question' in value,
  ) as any[]
}

const ASK = {
  tool: 'AskUserQuestion',
  questions: [
    {
      question: 'Which library?',
      header: 'Library',
      options: [
        { label: 'a', description: 'A' },
        { label: 'b', description: 'B' },
      ],
      multiSelect: false,
    },
    {
      question: 'Second one?',
      header: 'Other',
      options: [
        { label: 'c', description: 'C' },
        { label: 'd', description: 'D' },
      ],
      multiSelect: false,
    },
  ],
} as const

for (const outcome of ['answered', 'refused', 'failed'] as const) {
  test(`AC5 — a pending question is published for its session, then removed once ${outcome}`, async ($, on) => {
    const { clock, store, app } = world(on)
    let release: () => void = () => {}
    const gate = new Promise<void>(resolve => (release = resolve))
    app.askAnswer = async () => {
      await gate
      if (outcome === 'refused') return { deny: 'no' }
      if (outcome === 'failed') throw new Error('boom')

      return { result: {} }
    }

    const call = $.tool.call(ASK as any).catch(() => undefined)
    await clock.settle()

    const pending = pendingQuestions(store)
    expect(pending).toHaveLength(1)
    expect(pending[0]).toMatchObject({
      cwd: '/work/a',
      question: 'Which library?',
    })
    expect(pending[0]).toHaveProperty('at')

    release()
    await call
    await clock.settle()

    expect(pendingQuestions(store)).toHaveLength(0)
  })
}

test('AC7 — /pilot opens the pane and starts polling', async ($, on) => {
  const { clock, seen } = world(on)

  await slash($, 'pilot')
  expect(seen.opened).toHaveLength(1)

  await clock.advance(10_000)
  expect(seen.polls).toBeGreaterThan(0)
})

test('AC7 — a started session opens the pane when the store marks it, another does not', async ($, on) => {
  const { seen, who } = world(on)

  await slash($, 'pilot')
  seen.opened.length = 0

  who.id = 'B'
  who.cwd = '/work/b'
  await start($, '/work/b')
  expect(seen.opened).toHaveLength(0)

  who.id = 'A'
  who.cwd = '/work/a'
  await start($, '/work/a')
  expect(seen.opened).toHaveLength(1)
})

test('AC7 — in a session no one marked, no pane opens and no polling runs', async ($, on) => {
  const { clock, seen } = world(on)

  await start($, '/work/a')
  await clock.advance(60_000)

  expect(seen.opened).toHaveLength(0)
  expect(seen.polls).toBe(0)
})

test('AC7 — a session whose mark moved to another session stops polling', async ($, on) => {
  const { clock, seen, store } = world(on)

  await slash($, 'pilot')
  await clock.advance(10_000)
  expect(seen.polls).toBeGreaterThan(0)

  // What `/pilot` in session B does through the shared store.
  store.set('pilot', 'B')
  await clock.advance(10_000)
  const before = seen.polls

  await clock.advance(60_000)

  expect(seen.polls).toBe(before)
})

const SESSION = {
  sessionId: 'local_abc',
  isRunning: true,
  link: 'claude://claude.ai/epitaxy/local_abc',
}
const ticketWith = (session?: typeof SESSION) => ({
  worktree: '/work/a',
  slug: 'alpha',
  title: 'Alpha feature',
  status: 'red',
  branch: 'feat/alpha',
  session,
  state: session ? { kind: 'in-dev', status: 'red' } : { kind: 'no-session' },
})

async function mountPane($: any, on: any, tickets: object[]) {
  const w = world(on)
  on('state.get', () => ({ value: { value: tickets, version: 1 } }))
  await slash($, 'pilot')

  const ui = await $.ui.mount({
    plugin: 'pilot',
    surface: 'desktop',
    component: 'Pane',
    requestId: w.seen.opened[0]!,
    props: PILOT_PANE_PROPS,
  })

  return { ui, ...w }
}

async function pressOpen(ui: any) {
  const button = await ui.find({ type: 'Button', text: /open/i })
  if (button) await ui.press({ key: button.key })
}

test('AC8 — Open focuses the ticket session in the app', async ($, on) => {
  const { ui, seen } = await mountPane($, on, [ticketWith(SESSION)])

  await pressOpen(ui)

  const opens = seen.tools.filter(e => e.tool === OPEN_TOOL)
  expect(opens).toHaveLength(1)
  expect(opens[0]).toMatchObject({ session_id: 'local_abc', target: 'focus' })
  expect(seen.processes.filter(argv => argv[0] === 'open')).toHaveLength(0)
  await ui.unmount()
})

for (const failure of ['refused', 'an error result'] as const) {
  test(`AC8 — Open runs \`open <link>\` when the app call is ${failure}`, async ($, on) => {
    const { ui, seen, app } = await mountPane($, on, [ticketWith(SESSION)])
    app.openAnswer = () =>
      failure === 'refused'
        ? { deny: 'not a session this one started' }
        : { result: 'error', text: 'refused', isError: true }

    await pressOpen(ui)

    expect(seen.processes.filter(argv => argv[0] === 'open')).toEqual([
      ['open', SESSION.link],
    ])
    await ui.unmount()
  })
}

test('AC8 — a ticket with no session calls nothing', async ($, on) => {
  const { ui, seen } = await mountPane($, on, [ticketWith(undefined)])

  await pressOpen(ui)

  expect(seen.tools.filter(e => e.tool === OPEN_TOOL)).toHaveLength(0)
  expect(seen.processes.filter(argv => argv[0] === 'open')).toHaveLength(0)
  await ui.unmount()
})
