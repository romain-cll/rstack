// The hooks of plugin/hooks/register.tsx, through the plugin kit.
//
// Contract these tests fix beyond the spec:
// - the pane draws the unshaped array stored at `rstack.tickets` in `$.state`;
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
const GET_SESSION = 'mcp__ccd_session_mgmt__get_session'
const LIST_SESSIONS = 'mcp__ccd_session_mgmt__list_sessions'

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
    // The cwd of each process, same order as `processes`.
    cwds: [] as (string | undefined)[],
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
    seen.cwds.push(e.init?.cwd)
    if (e.argv[0] === 'git' && e.argv.includes('worktree')) seen.polls += 1

    return { value: app.processAnswer(e.argv) }
  })
  // What the app answers to the Open button: a test sets `openAnswer`.
  const app = {
    // What git and gh answer to a command, by its argv.
    processAnswer: (_argv: string[]): any => PROCESS_OK,
    // The JSON text `list_sessions` answers.
    sessions: '[]',
    openAnswer: (): any => ({ result: {}, text: 'ok' }),
    askAnswer: async (): Promise<any> => ({ result: {} }),
    // pilot-next: what the app answers to any other tool; undefined falls to the default.
    otherTool: (_e: any): any => undefined,
    // What `get_session self` answers: the app's id of the calling session.
    selfAnswer: (): any => ({
      result: {},
      text: JSON.stringify({ sessionId: 'local_X' }),
    }),
  }
  on('tool.call', (_: any, e: any) => {
    seen.tools.push(e)
    if (e.tool === OPEN_TOOL) return app.openAnswer()
    if (e.tool === 'AskUserQuestion') return app.askAnswer()
    if (e.tool === GET_SESSION) return app.selfAnswer()
    const other = app.otherTool(e)
    if (other !== undefined) return other

    return { result: {}, text: e.tool === LIST_SESSIONS ? app.sessions : '[]' }
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
  test(`open-session AC4 — a pending question is published with the app session id of its session, then removed once ${outcome}`, async ($, on) => {
    const { clock, store, app, seen } = world(on)
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
      sessionId: 'local_X',
      question: 'Which library?',
    })
    expect(pending[0]).toHaveProperty('at')
    expect(
      seen.tools.filter(e => e.tool === GET_SESSION)[0],
    ).toMatchObject({ session_id: 'self' })

    release()
    await call
    await clock.settle()

    expect(pendingQuestions(store)).toHaveLength(0)
  })
}

const SELF_FAILURES: Record<string, () => any> = {
  refused: () => ({ deny: 'not allowed' }),
  'an error result': () => ({ result: 'error', text: 'no such session', isError: true }),
  'a throw': () => {
    throw new Error('boom')
  },
  'no session': () => ({ result: {}, text: '[]' }),
}

for (const [failure, answer] of Object.entries(SELF_FAILURES)) {
  test(`open-session AC4 — get_session ${failure}: the question is published without a session id and AskUserQuestion still runs`, async ($, on) => {
    const { clock, store, app, seen } = world(on)
    let release: () => void = () => {}
    const gate = new Promise<void>(resolve => (release = resolve))
    app.selfAnswer = answer
    app.askAnswer = async () => {
      await gate

      return { result: {} }
    }

    const call = $.tool.call(ASK as any).catch(() => undefined)
    await clock.settle()

    const pending = pendingQuestions(store)
    expect(pending).toHaveLength(1)
    expect(pending[0]?.question).toBe('Which library?')
    expect(pending[0]?.sessionId).toBeUndefined()
    expect(seen.tools.filter(e => e.tool === 'AskUserQuestion')).toHaveLength(1)

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
  id: 'SPOTIME-1',
  name: 'Alpha feature',
  section: 'running',
  step: 3,
  status: 'red',
  branch: 'feat/alpha',
  session,
  state: session ? { kind: 'in-dev', status: 'red' } : { kind: 'no-session' },
})

async function mountPane(
  $: any,
  on: any,
  tickets: object[],
  // Hooks to register beneath the plugin, before the first call of `$`.
  beneath?: (on: any) => void,
) {
  const w = world(on)
  on('state.get', () => ({ value: { value: tickets, version: 1 } }))
  beneath?.(on)
  await slash($, 'pilot')

  const ui = await $.ui.mount({
    plugin: 'rstack',
    surface: 'desktop',
    component: 'Pane',
    requestId: w.seen.opened[0]!,
    props: PILOT_PANE_PROPS,
  })

  return { ui, ...w }
}

// The row's own Button (its name is in what it draws): never the plan toggle.
async function pressRow(ui: any) {
  const buttons: any[] = await ui.findAll({ type: 'Button' })
  const button = buttons.find(
    b =>
      JSON.stringify(b).includes('Alpha feature') &&
      !JSON.stringify(b).includes('Voir le plan'),
  )
  if (button) await ui.press({ key: button.key })

  return button
}

test('AC9 — pressing the row focuses the ticket session in the app', async ($, on) => {
  const { ui, seen } = await mountPane($, on, [ticketWith(SESSION)])

  expect(await pressRow(ui)).toBeDefined()

  const opens = seen.tools.filter(e => e.tool === OPEN_TOOL)
  expect(opens).toHaveLength(1)
  expect(opens[0]).toMatchObject({ session_id: 'local_abc', target: 'focus' })
  expect(seen.processes.filter(argv => argv[0] === 'open')).toHaveLength(0)
  await ui.unmount()
})

for (const failure of ['refused', 'an error result'] as const) {
  test(`AC9 — pressing the row runs \`open <link>\` when the app call is ${failure}`, async ($, on) => {
    const { ui, seen, app } = await mountPane($, on, [ticketWith(SESSION)])
    app.openAnswer = () =>
      failure === 'refused'
        ? { deny: 'not a session this one started' }
        : { result: 'error', text: 'refused', isError: true }

    expect(await pressRow(ui)).toBeDefined()

    expect(seen.processes.filter(argv => argv[0] === 'open')).toEqual([
      ['open', SESSION.link],
    ])
    await ui.unmount()
  })
}

test('AC9 — pressing a ticket with no session calls nothing', async ($, on) => {
  const { ui, seen } = await mountPane($, on, [ticketWith(undefined)])

  await pressRow(ui)

  expect(seen.tools.filter(e => e.tool === OPEN_TOOL)).toHaveLength(0)
  expect(seen.processes.filter(argv => argv[0] === 'open')).toHaveLength(0)
  await ui.unmount()
})

// pilot-v3-ui AC4: with no ticket, the refresh Button is the only one drawn.
test('pilot-v3-ui AC4 — pressing refresh collects at once and stores the time of that collect in rstack.polledAt', async ($, on) => {
  const stored: { key: string; value: unknown }[] = []
  const { ui, seen, clock } = await mountPane($, on, [], on => {
    on('state.set', (_: any, e: any) => {
      stored.push({ key: e.key, value: e.value })

      return { value: { isSet: true, version: stored.length } }
    })
  })
  await clock.settle()

  // Well before the next 10 s tick.
  await clock.set(3_000)
  const before = seen.polls
  const buttons: any[] = await ui.findAll({ type: 'Button' })
  expect(buttons).toHaveLength(1)
  await ui.press({ key: buttons[0].key })
  await clock.settle()

  expect(seen.polls).toBe(before + 1)
  expect(stored.filter(s => s.key === 'polledAt').pop()?.value).toBe(3_000)
  await ui.unmount()
})

// pilot-v3-ui AC5
const toiRow = (state: object, session?: typeof SESSION) => ({
  ...ticketWith(session),
  section: 'toi',
  step: 1,
  status: 'draft',
  state,
})

const ACTIONS = [
  { label: 'Répondre', state: { kind: 'awaiting-answer', question: 'Which library?' } },
  { label: 'Voir le plan', state: { kind: 'awaiting-plan-validation' } },
] as const

async function actionButton(ui: any, label: string) {
  const buttons: any[] = await ui.findAll({ type: 'Button' })

  return buttons.find(b => JSON.stringify(b).includes(label))
}

for (const { label, state } of ACTIONS) {
  test(`pilot-v3-ui AC5 — pressing the toi row's ${label} Button focuses its session in the app`, async ($, on) => {
    const { ui, seen } = await mountPane($, on, [toiRow(state, SESSION)])

    const button = await actionButton(ui, label)
    expect(button).toBeDefined()
    await ui.press({ key: button.key })

    const opens = seen.tools.filter(e => e.tool === OPEN_TOOL)
    expect(opens).toHaveLength(1)
    expect(opens[0]).toMatchObject({ session_id: 'local_abc', target: 'focus' })
    expect(seen.processes.filter(argv => argv[0] === 'open')).toHaveLength(0)
    await ui.unmount()
  })
}

test('pilot-v3-ui AC5 — pressing the toi row\'s action Button runs `open <link>` when the app call is refused', async ($, on) => {
  const { ui, seen, app } = await mountPane($, on, [toiRow(ACTIONS[0].state, SESSION)])
  app.openAnswer = () => ({ deny: 'not a session this one started' })

  const button = await actionButton(ui, 'Répondre')
  expect(button).toBeDefined()
  await ui.press({ key: button.key })

  expect(seen.processes.filter(argv => argv[0] === 'open')).toEqual([
    ['open', SESSION.link],
  ])
  await ui.unmount()
})

test('pilot-v3-ui AC5 — a toi row with no session has no action Button: no Button of the pane opens anything', async ($, on) => {
  const { ui, seen } = await mountPane($, on, [toiRow({ kind: 'no-session' })])

  const buttons: any[] = await ui.findAll({ type: 'Button' })
  // The refresh Button is there; none is an action Button.
  expect(buttons.length).toBeGreaterThan(0)
  expect(buttons.some(b => /Répondre|Voir le plan/.test(JSON.stringify(b)))).toBe(false)
  for (const button of buttons) await ui.press({ key: button.key })

  expect(seen.tools.filter(e => e.tool === OPEN_TOOL)).toHaveLength(0)
  expect(seen.processes.filter(argv => argv[0] === 'open')).toHaveLength(0)
  await ui.unmount()
})

// A poll over one worktree on a branch, whose features folder holds one
// shipped spec: what `/pilot` writes to `rstack.tickets`, with `gh` answering
// `gh`. Each case has its own branch: the pilot keeps a PR a minute per branch.
async function pollShipped(
  $: any,
  on: any,
  o: {
    branch: string
    gh?: { exitCode: number; stdout: string }
    // pilot-gitlab: the `origin` URL `git remote get-url origin` answers, and
    // what `glab` answers. Without `origin`, git answers the worktree list.
    origin?: string
    glab?: { exitCode: number; stdout: string }
    withSession?: boolean
  },
) {
  const WT = '/work/a'
  const w = world(on)
  const written: any[] = []
  on('state.set', (_: any, e: any) => {
    if (e.key === 'tickets') written.push(e.value)

    return { value: { isSet: true, version: written.length } }
  })
  on('fs.exists', () => ({ value: true }))
  on('fs.list', () => ({
    value: [{ name: 'alpha.md', kind: 'file', size: 1, mtimeMs: 0, isLink: false }],
  }))
  on('fs.read', () => ({
    value: `---\nstatus: shipped\nbranch: ${o.branch}\n---\n\n# Alpha feature\n`,
  }))
  w.app.processAnswer = argv =>
    o.origin !== undefined && argv[0] === 'git' && argv.includes('remote')
      ? { ...PROCESS_OK, stdout: `${o.origin}\n` }
      : argv[0] === 'git'
      ? {
          ...PROCESS_OK,
          stdout: `worktree ${WT}\nHEAD ${'0'.repeat(40)}\nbranch refs/heads/${o.branch}\n`,
        }
      : argv[0] === 'gh'
        ? { ...PROCESS_OK, ...o.gh }
        : argv[0] === 'glab'
          ? { ...PROCESS_OK, ...o.glab }
          : PROCESS_OK
  if (o.withSession) {
    w.app.sessions = JSON.stringify([
      {
        sessionId: 'local_abc',
        cwd: WT,
        isArchived: false,
        isRunning: false,
        lastActivityAt: '2026-11-18T10:00:00.000Z',
        link: 'claude://claude.ai/epitaxy/local_abc',
      },
    ])
  }

  await slash($, 'pilot')
  await w.clock.settle()

  return {
    rows: written[written.length - 1] as any[] | undefined,
    gh: w.seen.processes.filter(argv => argv[0] === 'gh'),
    glab: w.seen.processes.filter(argv => argv[0] === 'glab'),
    clock: w.clock,
    glabCwds: () =>
      w.seen.processes.flatMap((argv, i) => (argv[0] === 'glab' ? [w.seen.cwds[i]] : [])),
    glabCalls: () =>
      w.seen.processes.filter(
        argv => argv[0] === 'glab' && argv[1] === 'mr' && argv[3] === o.branch,
      ).length,
    ghCalls: () =>
      w.seen.processes.filter(
        argv => argv[0] === 'gh' && argv[1] === 'pr' && argv[3] === o.branch,
      ).length,
  }
}

const ghPr = (state: string) => ({
  exitCode: 0,
  stdout: JSON.stringify({
    state,
    url: 'https://github.com/o/r/pull/7',
    statusCheckRollup: [],
  }),
})

const SHIPPED_CASES = [
  { name: 'MERGED, no session', pr: ghPr('MERGED'), withSession: false, kept: false },
  { name: 'CLOSED, no session', pr: ghPr('CLOSED'), withSession: false, kept: false },
  { name: 'MERGED, with a session', pr: ghPr('MERGED'), withSession: true, kept: false },
  { name: 'OPEN, no session', pr: ghPr('OPEN'), withSession: false, kept: true },
  { name: 'gh failing, no session', pr: { exitCode: 1, stdout: '' }, withSession: false, kept: true },
] as const

for (const [i, c] of SHIPPED_CASES.entries()) {
  test(`hide-done AC3 — a shipped ticket with a branch, PR ${c.name}: its PR is read, and the row is ${c.kept ? 'kept' : 'left out'}`, async ($, on) => {
    const branch = `feat/shipped-${i}`
    const { rows, gh } = await pollShipped($, on, {
      branch,
      gh: c.pr,
      withSession: c.withSession,
    })

    expect(gh.some(argv => argv.slice(0, 3).join(' ') === 'gh pr view' && argv[3] === branch)).toBe(true)
    expect(rows).toBeDefined()
    expect(rows!.filter(row => row.slug === 'alpha')).toHaveLength(c.kept ? 1 : 0)
  })
}

// pilot-v2-ui AC8: polling every 10 s, `gh` is asked again for a PR once 60 s
// have passed, except for a PR read MERGED or CLOSED, which is asked once.
const LATER_CASES = [
  { name: 'MERGED', pr: ghPr('MERGED'), asksAgain: false },
  { name: 'CLOSED', pr: ghPr('CLOSED'), asksAgain: false },
  { name: 'OPEN', pr: ghPr('OPEN'), asksAgain: true },
  { name: 'gh failing', pr: { exitCode: 1, stdout: '' }, asksAgain: true },
] as const

for (const [i, c] of LATER_CASES.entries()) {
  test(`AC8 — a shipped ticket's PR read ${c.name}: when the pilot polls again past 60 s, \`gh pr view\` is ${c.asksAgain ? 'run again' : 'not run again'}`, async ($, on) => {
    const { clock, ghCalls } = await pollShipped($, on, {
      branch: `feat/later-${i}`,
      gh: c.pr,
    })
    expect(ghCalls()).toBe(1)

    await clock.advance(130_000)
    await clock.settle()

    if (c.asksAgain) expect(ghCalls()).toBeGreaterThan(1)
    else expect(ghCalls()).toBe(1)
  })
}

// pilot-gitlab AC3: the tool is picked by the host of the worktree's `origin`.
const GITLAB = 'https://gitlab.com/o/r.git'
const glabMr = (state: string) => ({
  exitCode: 0,
  stdout: JSON.stringify({
    iid: 42,
    state,
    web_url: 'https://gitlab.com/o/r/-/merge_requests/42',
    head_pipeline: { status: 'success' },
  }),
})

const GITLAB_CASES = [
  { name: 'merged', mr: glabMr('merged'), kept: false },
  { name: 'closed', mr: glabMr('closed'), kept: false },
  { name: 'opened', mr: glabMr('opened'), kept: true },
] as const

for (const [i, c] of GITLAB_CASES.entries()) {
  test(`pilot-gitlab AC3 — a shipped ticket on gitlab.com: \`glab mr view\` is run and not \`gh\`, an MR ${c.name} ${c.kept ? 'keeps' : 'leaves out'} the row`, async ($, on) => {
    const branch = `feat/gitlab-${i}`
    const { rows, gh, glab, glabCwds } = await pollShipped($, on, {
      branch,
      origin: GITLAB,
      glab: c.mr,
    })

    expect(glab).toContainEqual(['glab', 'mr', 'view', branch, '-F', 'json'])
    expect(glabCwds()).toEqual(glab.map(() => '/work/a'))
    expect(gh).toHaveLength(0)
    expect(rows).toBeDefined()
    expect(rows!.filter(row => row.slug === 'alpha')).toHaveLength(c.kept ? 1 : 0)
  })
}

test('pilot-gitlab AC3 — a merged MR is not read again when the pilot polls past 60 s', async ($, on) => {
  const { clock, glabCalls } = await pollShipped($, on, {
    branch: 'feat/gitlab-later-merged',
    origin: GITLAB,
    glab: glabMr('merged'),
  })
  expect(glabCalls()).toBe(1)

  await clock.advance(130_000)
  await clock.settle()

  expect(glabCalls()).toBe(1)
})

test('pilot-gitlab AC3 — an opened MR keeps its row and is read again past 60 s', async ($, on) => {
  const { clock, glabCalls } = await pollShipped($, on, {
    branch: 'feat/gitlab-later-open',
    origin: GITLAB,
    glab: glabMr('opened'),
  })
  expect(glabCalls()).toBe(1)

  await clock.advance(130_000)
  await clock.settle()

  expect(glabCalls()).toBeGreaterThan(1)
})

test('pilot-gitlab AC3 — a shipped ticket on github.com still runs `gh pr view`, not `glab`', async ($, on) => {
  const branch = 'feat/github-origin'
  const { gh, glab } = await pollShipped($, on, {
    branch,
    origin: 'https://github.com/o/r.git',
    gh: ghPr('OPEN'),
  })

  expect(gh.some(argv => argv.slice(0, 3).join(' ') === 'gh pr view' && argv[3] === branch)).toBe(true)
  expect(glab).toHaveLength(0)
})

// pilot-next: the next tickets to launch, read from Plane.
//
// Contract these tests fix beyond the spec:
// - `rstack.next` is the array stored under the key `next` of `$.state`; each
//   row has { id, name, summary?, unblocks, workitemId, updatedAt };
// - the polling pane reads `<main checkout>/.rstack/pilot.json` through `$.fs`
//   (`.rs/` when `.rstack/` does not exist), the main checkout being the first
//   worktree of `git worktree list --porcelain`;
// - Plane tools take `{ tool, action: 'list', ... }`, answer a JSON text, and
//   `workitem_relation list` answers `{ dependencies: { blocking, blocked_by } }`;
// - the `Lancer` Buttons come in the order of `rstack.next`.
const PLANE_PROJECT = 'mcp__plane__project'
const PLANE_STATE = 'mcp__plane__state'
const PLANE_ITEMS = 'mcp__plane__workitem'
const PLANE_RELATIONS = 'mcp__plane__workitem_relation'
const START_SESSION = 'mcp__ccd_session__start_session'

const MAIN = '/work/main'
const PLANE_CONFIG = JSON.stringify({ plane: { project: 'SPOTIME' } })
const CONFIGURED = { files: { [`${MAIN}/.rstack/pilot.json`]: PLANE_CONFIG } }
const USAGE = {
  input_tokens: 1,
  output_tokens: 1,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
}
const SUMMARY = 'Un résumé en une ligne.'
const ANSWERED = () => ({ isAnswered: true, text: SUMMARY, usage: USAGE })

const planeItem = (seq: number, over: Record<string, unknown> = {}) => ({
  id: `w${seq}`,
  name: `Ticket ${seq}`,
  sequence_id: seq,
  priority: 'none',
  state: { group: 'unstarted' },
  is_draft: false,
  updated_at: '2026-11-20T10:00:00Z',
  description_stripped: `Description of ticket ${seq}.`,
  type_id: null,
  ...over,
})

const PLANE_STATES = [
  { id: 's-backlog', group: 'backlog' },
  { id: 's-unstarted', group: 'unstarted' },
  { id: 's-started', group: 'started' },
  { id: 's-done', group: 'completed' },
  { id: 's-cancel', group: 'cancelled' },
]

async function planeWorld(
  on: any,
  o: {
    files?: Record<string, string>
    dirs?: string[]
    items?: any[]
  } = {},
) {
  const w = world(on)
  const files = o.files ?? {}
  const dirs = o.dirs ?? [`${MAIN}/.rstack`]
  const state = new Map<string, unknown>()
  const writes: string[] = []
  let version = 0
  on('state.get', (_: any, e: any) => ({ value: { value: state.get(e.key), version } }))
  on('state.set', (_: any, e: any) => {
    state.set(e.key, JSON.parse(JSON.stringify(e.value)))
    writes.push(e.key)
    version += 1

    return { value: { isSet: true, version } }
  })
  on('fs.exists', (_: any, e: any) => ({
    value:
      dirs.includes(e.path) ||
      e.path in files ||
      Object.keys(files).some(f => f.startsWith(`${e.path}/`)),
  }))
  on('fs.list', () => ({ value: [] }))
  on('fs.read', (_: any, e: any) => {
    if (e.path in files) return { value: files[e.path] }
    throw new Error(`ENOENT ${e.path}`)
  })
  w.app.processAnswer = argv =>
    argv[0] === 'git'
      ? {
          ...PROCESS_OK,
          stdout: [MAIN, '/work/a']
            .map(
              p => `worktree ${p}\nHEAD ${'0'.repeat(40)}\nbranch refs/heads/${p.slice(1)}\n`,
            )
            .join('\n'),
        }
      : PROCESS_OK

  const plane = {
    items: o.items ?? [planeItem(1), planeItem(2)],
    relations: {} as Record<string, { blocking: any[]; blocked_by: any[] }>,
    calls: [] as any[],
    // An answer to put in place of Plane's, for the call asked.
    fail: (_e: any): any => undefined,
    start: (_e: any): any => ({ result: {}, text: '{}' }),
  }
  const ok = (body: unknown) => ({ result: {}, text: JSON.stringify(body) })
  w.app.otherTool = (e: any) => {
    if (e.tool === START_SESSION) return plane.start(e)
    if (!String(e.tool).startsWith('mcp__plane__')) return undefined
    plane.calls.push(e)
    const failed = plane.fail(e)
    if (failed !== undefined) return failed
    if (e.tool === PLANE_PROJECT)
      return ok({
        results: [{ id: 'proj-1', identifier: 'SPOTIME', name: 'Spotime' }],
        next_page_results: false,
      })
    if (e.tool === PLANE_STATE) return ok({ results: PLANE_STATES, next_page_results: false })
    if (e.tool === PLANE_ITEMS)
      return ok({ results: plane.items, next_page_results: false })
    if (e.tool === PLANE_RELATIONS)
      return ok({
        dependencies: plane.relations[e.workitem_id] ?? { blocking: [], blocked_by: [] },
      })

    return undefined
  }

  const model = { calls: [] as any[], answer: (_e: any): any => ANSWERED() }
  on('model.complete', (_: any, e: any) => {
    model.calls.push(e)

    return model.answer(e)
  })
  const submits: any[] = []
  on('prompt.submit', (_: any, e: any) => {
    submits.push(e)

    return { text: e.text }
  })

  return {
    ...w,
    plane,
    model,
    submits,
    state,
    writes,
    nextRows: () => ((state.get('next') as any[] | undefined) ?? []),
    nextIds: () => ((state.get('next') as any[] | undefined) ?? []).map(r => r.id),
    started: () => w.seen.tools.filter(e => e.tool === START_SESSION),
    listed: (tool: string) =>
      plane.calls.filter(e => e.tool === tool && e.action === 'list'),
    related: (id: string) =>
      plane.calls.filter(
        e => e.tool === PLANE_RELATIONS && e.action === 'list' && e.workitem_id === id,
      ),
  }
}

async function loadPilot($: any, w: { clock: any }) {
  await slash($, 'pilot')
  await w.clock.settle()
}

async function mountNext($: any, w: { seen: { opened: string[] } }) {
  return $.ui.mount({
    plugin: 'rstack',
    surface: 'desktop',
    component: 'Pane',
    requestId: w.seen.opened[0]!,
    props: PILOT_PANE_PROPS,
  })
}

async function pressLabelled(ui: any, label: string) {
  const buttons: any[] = await ui.findAll({ type: 'Button' })
  const button = buttons.find(b => JSON.stringify(b).includes(label))
  expect(button).toBeDefined()
  await ui.press({ key: button.key })
}

const NO_CONFIG_CASES = [
  { name: 'no pilot.json', files: {}, dirs: [`${MAIN}/.rstack`] },
  { name: 'neither .rstack/ nor .rs/', files: {}, dirs: [] },
  {
    name: 'a pilot.json with no plane.project',
    files: { [`${MAIN}/.rstack/pilot.json`]: '{}' },
    dirs: [`${MAIN}/.rstack`],
  },
  {
    name: 'only a .rs/pilot.json while .rstack/ exists',
    files: { [`${MAIN}/.rs/pilot.json`]: PLANE_CONFIG },
    dirs: [`${MAIN}/.rstack`],
  },
  {
    name: 'a pilot.json in another worktree than the main checkout',
    files: { '/work/a/.rstack/pilot.json': PLANE_CONFIG },
    dirs: [`${MAIN}/.rstack`, '/work/a/.rstack'],
  },
] as const

for (const c of NO_CONFIG_CASES) {
  test(`pilot-next AC1 — ${c.name}: no Plane tool is called and rstack.next is empty`, async ($, on) => {
    const w = await planeWorld(on, { files: { ...c.files }, dirs: [...c.dirs] })

    await loadPilot($, w)
    await w.clock.advance(120_000)

    expect(w.seen.polls).toBeGreaterThan(0)
    expect(w.writes).toContain('tickets')
    expect(w.plane.calls).toHaveLength(0)
    expect(w.nextRows()).toEqual([])
  })
}

test('pilot-next AC1 — with .rs/pilot.json and no .rstack/, the config is read and Plane is asked', async ($, on) => {
  const w = await planeWorld(on, {
    files: { [`${MAIN}/.rs/pilot.json`]: PLANE_CONFIG },
    dirs: [],
  })

  await loadPilot($, w)

  expect(w.listed(PLANE_ITEMS).length).toBeGreaterThan(0)
  expect(w.nextIds()).toEqual(['SPOTIME-1', 'SPOTIME-2'])
})

test('pilot-next AC2 — the work items read leaves epics out: its PQL filter holds NOT isEpic()', async ($, on) => {
  const w = await planeWorld(on, CONFIGURED)

  await loadPilot($, w)

  const reads = w.listed(PLANE_ITEMS)
  expect(reads.length).toBeGreaterThan(0)
  for (const read of reads) expect(read.pql).toContain('NOT isEpic()')
})

test('pilot-next AC5 — a summary is asked from haiku once per (id, updated_at): not again for the same one, again for a changed one', async ($, on) => {
  const w = await planeWorld(on, { ...CONFIGURED, items: [planeItem(1)] })

  await loadPilot($, w)

  expect(w.model.calls).toHaveLength(1)
  expect(w.model.calls[0]).toMatchObject({ model: 'haiku' })
  expect(w.model.calls[0].prompt).toContain('Ticket 1')
  expect(w.model.calls[0].prompt).toContain('Description of ticket 1.')
  expect(w.nextRows()[0]?.summary).toBe(SUMMARY)

  await w.clock.advance(50_000)
  expect(w.model.calls).toHaveLength(1)

  w.plane.items = [planeItem(1, { updated_at: '2026-11-21T10:00:00Z' })]
  await w.clock.advance(30_000)
  expect(w.model.calls).toHaveLength(2)

  await w.clock.advance(30_000)
  expect(w.model.calls).toHaveLength(2)
  expect(w.nextRows()[0]?.summary).toBe(SUMMARY)
})

test('pilot-next AC5 — a call that is not answered leaves the row without a summary and is made again at the next poll', async ($, on) => {
  const w = await planeWorld(on, { ...CONFIGURED, items: [planeItem(1)] })
  w.model.answer = () => ({
    isAnswered: false,
    reason: 'api-error',
    status: 529,
    error: 'overloaded',
    usage: USAGE,
  })

  await loadPilot($, w)
  expect(w.model.calls).toHaveLength(1)
  expect(w.nextRows()).toHaveLength(1)
  expect(w.nextRows()[0]?.summary).toBeUndefined()

  await w.clock.advance(10_000)
  expect(w.model.calls).toHaveLength(2)
  expect(w.nextRows()[0]?.summary).toBeUndefined()

  w.model.answer = ANSWERED
  await w.clock.advance(10_000)
  expect(w.model.calls).toHaveLength(3)
  expect(w.nextRows()[0]?.summary).toBe(SUMMARY)

  await w.clock.advance(10_000)
  expect(w.model.calls).toHaveLength(3)
})

const SIX = [1, 2, 3, 4, 5, 6].map(n => planeItem(n))

test('pilot-next AC6 — pressing Lancer starts the session once with the ticket, and the row leaves for the next candidate', async ($, on) => {
  const w = await planeWorld(on, { ...CONFIGURED, items: SIX })
  await loadPilot($, w)
  expect(w.nextIds()).toEqual(['SPOTIME-1', 'SPOTIME-2', 'SPOTIME-3', 'SPOTIME-4', 'SPOTIME-5'])
  const ui = await mountNext($, w)

  await pressLabelled(ui, 'Lancer')
  await w.clock.settle()

  const started = w.started()
  expect(started).toHaveLength(1)
  expect(started[0]).toMatchObject({
    initiation: 'user_asked',
    context: 'fresh',
    use_worktree: true,
    branch_name: 'spotime-1',
    title: 'SPOTIME-1 — Ticket 1',
  })
  expect(started[0].prompt.startsWith('/rs-plan SPOTIME-1 — Ticket 1')).toBe(true)
  expect(started[0].prompt).toContain('Description of ticket 1.')
  expect(started[0].background.length).toBeGreaterThanOrEqual(80)
  expect(w.submits).toHaveLength(0)
  expect(w.nextIds()).toEqual(['SPOTIME-2', 'SPOTIME-3', 'SPOTIME-4', 'SPOTIME-5', 'SPOTIME-6'])

  // Plane still lists it unstarted: the pane remembers it was launched.
  await w.clock.advance(120_000)
  expect(w.nextIds()).not.toContain('SPOTIME-1')
  expect(w.started()).toHaveLength(1)
  await ui.unmount()
})

const REFUSALS = [
  { name: 'denied', answer: { deny: 'Not allowed from a pane' }, reason: 'Not allowed from a pane' },
  {
    name: 'answering an error',
    answer: { result: 'error', text: 'start_session blew up', isError: true },
    reason: 'start_session blew up',
  },
] as const

for (const refusal of REFUSALS) {
  test(`pilot-next AC7 — start_session ${refusal.name}: the pilot session is asked to start it with the same prompt and told the refusal, and the row leaves`, async ($, on) => {
    const w = await planeWorld(on, { ...CONFIGURED, items: SIX })
    w.plane.start = () => refusal.answer
    await loadPilot($, w)
    const ui = await mountNext($, w)

    await pressLabelled(ui, 'Lancer')
    await w.clock.settle()

    expect(w.started()).toHaveLength(1)
    expect(w.submits).toHaveLength(1)
    const text: string = w.submits[0].text
    expect(text).toContain('/rs-plan SPOTIME-1 — Ticket 1')
    expect(text).toContain('Description of ticket 1.')
    expect(text).toContain(refusal.reason)
    expect(w.nextIds()).toEqual(['SPOTIME-2', 'SPOTIME-3', 'SPOTIME-4', 'SPOTIME-5', 'SPOTIME-6'])
    await ui.unmount()
  })
}

const PLANE_FAILURES = [
  { name: 'denied', answer: { deny: 'no' } },
  { name: 'an error', answer: { result: 'error', text: 'boom', isError: true } },
  { name: 'an unparsable answer', answer: { result: {}, text: '<html>not json</html>' } },
] as const

for (const failure of PLANE_FAILURES) {
  test(`pilot-next AC8 — the work items read ${failure.name}: the last list stays in rstack.next and the poll goes on`, async ($, on) => {
    const w = await planeWorld(on, { ...CONFIGURED, items: SIX })
    await loadPilot($, w)
    const before = w.nextRows()
    expect(before).toHaveLength(5)
    const polled = w.writes.filter(k => k === 'polledAt').length

    w.plane.fail = e =>
      e.tool === PLANE_ITEMS && e.action === 'list' ? failure.answer : undefined
    await w.clock.advance(70_000)

    expect(w.listed(PLANE_ITEMS).length).toBeGreaterThan(1)
    expect(w.nextRows()).toEqual(before)
    expect(w.writes.filter(k => k === 'polledAt').length).toBeGreaterThan(polled)
  })
}

test('pilot-next AC9 — work items are read at most every 60 s, the states once, the relations of an item at most every 5 minutes', async ($, on) => {
  const w = await planeWorld(on, CONFIGURED)
  const reads = () => ({
    items: w.listed(PLANE_ITEMS).length,
    states: w.listed(PLANE_STATE).length,
    first: w.related('w1').length,
    second: w.related('w2').length,
  })

  await loadPilot($, w)
  expect(reads()).toEqual({ items: 1, states: 1, first: 1, second: 1 })

  await w.clock.advance(50_000)
  expect(reads()).toEqual({ items: 1, states: 1, first: 1, second: 1 })

  await w.clock.advance(20_000)
  expect(reads()).toEqual({ items: 2, states: 1, first: 1, second: 1 })

  await w.clock.advance(220_000)
  expect(reads().states).toBe(1)
  expect(reads().first).toBe(1)
  expect(reads().second).toBe(1)

  await w.clock.advance(30_000)
  expect(reads().states).toBe(1)
  expect(reads().first).toBe(2)
  expect(reads().second).toBe(2)
})

test('pilot-next AC9 — Actualiser reads the work items, the states and every relation again at once', async ($, on) => {
  const w = await planeWorld(on, CONFIGURED)
  await loadPilot($, w)
  const ui = await mountNext($, w)
  await w.clock.set(3_000)

  await pressLabelled(ui, 'Actualiser')
  await w.clock.settle()

  expect(w.listed(PLANE_ITEMS)).toHaveLength(2)
  expect(w.listed(PLANE_STATE)).toHaveLength(2)
  expect(w.related('w1')).toHaveLength(2)
  expect(w.related('w2')).toHaveLength(2)
  await ui.unmount()
})
