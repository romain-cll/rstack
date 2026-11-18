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

// A poll over one worktree on a branch, whose features folder holds one
// shipped spec: what `/pilot` writes to `pilot.tickets`, with `gh` answering
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
