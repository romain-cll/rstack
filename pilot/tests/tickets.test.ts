// The pure functions of pilot/hooks/tickets.ts. The contract these tests fix:
//
//   listTickets({ worktrees, files, sessions, self? }) -> Ticket[]
//     worktrees: `git worktree list --porcelain` output
//     files:     worktree path -> { file name -> text } (the files of the
//                worktree's features folder, `.rstack/features/`)
//     sessions:  the JSON text `list_sessions` answers (an array; it leaves
//                out the calling session)
//     self:      the JSON text `get_session` answers for `self` (one session
//                object, same fields as an entry of `sessions`); missing,
//                an error text or unparseable -> the list alone
//     Ticket:    { worktree, slug?, title?, status?, branch?, red?,
//                  session?: { sessionId, isRunning, link, isPilot? } }
//                  (isPilot: true on the session taken from `self`)
//   parseReview(text | undefined) -> { rounds, verdict, fixes, cap } | undefined
//   deriveState(ticket, { review?, questions? }) -> { kind, ... }
//     questions: [{ sessionId?, question, at }] (what the sessions publish;
//       sessionId is the app session id, `local_…`, of the asking session)
//   parsePr({ exitCode, stdout }) -> { state, url, ci } | undefined
//     (the result of `gh pr view <branch> --json state,url,statusCheckRollup`)
//
// pilot-v2-ui adds:
//   ticketId(title | undefined, slug) -> { id?, name }
//   sections(rows) -> [{ id: 'toi' | 'running' | 'pr', rows, count }, ...]
//     rows: { state: { kind }, since?: number (ms) }; sections in that order
//   stepOf(status | undefined) -> 1..5
//   waitingSince({ state, session? }) -> ms | undefined
//     state.at: the pending question's `at`; session.lastActivityAt: ISO text
//   elapsed(since, now) -> { n, unit: 'min' | 'h' | 'd' }
//   reviewLine({ rounds, verdict, fixes, cap }) -> { rounds, cap, running }
//     running: 'fix' | 'round' | undefined
//   planSummary(text) -> string | undefined
//
// pilot-gitlab adds:
//   forgeOf(url | undefined) -> 'gitlab' | 'github'   (the `origin` URL)
//   parseMr({ exitCode, stdout }) -> { state, url, ci, number, kind: 'mr' } | undefined
//     (the result of `glab mr view <branch> -F json`)
//
// pilot-v3-ui adds:
//   counters(rows) -> { toi, review, dev, pr }
//     rows: { section, state: { kind } } (a PilotRow: `section` is sectionOf(kind))
//   planFacts(text) -> { criteria, files }
//   segments(step) -> { name: 'plan' | 'red' | 'green' | 'review' | 'ship',
//                       state: 'done' | 'current' | 'todo' }[]   (5, in that order)
import { expect, test } from 'claude-code/testing'

import {
  counters,
  deriveState,
  elapsed,
  forgeOf,
  listTickets,
  parseMr,
  parsePr,
  parseReview,
  planFacts,
  planSummary,
  reviewLine,
  sectionOf,
  sections,
  segments,
  stepOf,
  ticketId,
  waitingSince,
} from '../hooks/tickets'

const MAIN = '/repo'
const WT_A = '/repo/.claude/worktrees/a'
const WT_B = '/repo/.claude/worktrees/b'
const WT_C = '/repo/.claude/worktrees/c'

const porcelain = (paths: string[]) =>
  paths
    .map(
      (path, i) =>
        `worktree ${path}\nHEAD ${String(i).repeat(40)}\nbranch refs/heads/wt-${i}\n`,
    )
    .join('\n')

// A worktree whose block holds a `detached` line instead of a `branch` line.
const detachedPorcelain = (blocks: { path: string; detached?: boolean }[]) =>
  blocks
    .map(
      ({ path, detached }, i) =>
        `worktree ${path}\nHEAD ${String(i).repeat(40)}\n${
          detached ? 'detached' : `branch refs/heads/wt-${i}`
        }\n`,
    )
    .join('\n')

const spec = (o: {
  title: string
  status: string
  branch?: string
  noBranch?: boolean
  red?: string
}) =>
  [
    '---',
    `status: ${o.status}`,
    ...(o.red ? [`red: ${o.red}`] : []),
    'owner: Someone',
    ...(o.noBranch ? [] : [`branch: ${o.branch ?? 'feat/x'}`]),
    'created: 2026-11-18',
    '---',
    '',
    `# ${o.title}`,
    '',
    '## User story',
    'As a user.',
  ].join('\n')

const session = (o: {
  sessionId: string
  cwd: string
  isArchived?: boolean
  isRunning?: boolean
  lastActivityAt?: string
}) => ({
  title: 't',
  isArchived: false,
  isRunning: false,
  lastActivityAt: '2026-11-18T10:00:00.000Z',
  group: null,
  link: `claude://claude.ai/epitaxy/${o.sessionId}`,
  remoteControlActive: false,
  ...o,
})

test('AC1 — one ticket per spec, never a review history, with its frontmatter', () => {
  const tickets = listTickets({
    worktrees: porcelain([MAIN, WT_A]),
    files: {
      [MAIN]: {},
      [WT_A]: {
        'alpha.md': spec({
          title: 'Alpha feature',
          status: 'red',
          branch: 'feat/alpha',
          red: 'a1b2c3d',
        }),
        'alpha.review.md': '## Round 1 — OK — abc1234\n',
        'beta.md': spec({ title: 'Beta feature', status: 'draft' }),
      },
    },
    sessions: '[]',
  })

  expect(tickets).toHaveLength(2)
  expect(tickets[0]).toMatchObject({
    worktree: WT_A,
    slug: 'alpha',
    title: 'Alpha feature',
    status: 'red',
    branch: 'feat/alpha',
    red: 'a1b2c3d',
  })
  expect(tickets[1]).toMatchObject({
    worktree: WT_A,
    slug: 'beta',
    title: 'Beta feature',
    status: 'draft',
  })
})

test('AC1 — a worktree with no spec yields a ticket only when it has a session', () => {
  const tickets = listTickets({
    worktrees: porcelain([MAIN, WT_A, WT_B]),
    files: { [MAIN]: {}, [WT_A]: {}, [WT_B]: {} },
    sessions: JSON.stringify([session({ sessionId: 'sA', cwd: WT_A })]),
  })

  expect(tickets).toHaveLength(1)
  expect(tickets[0]?.worktree).toBe(WT_A)
  expect(tickets[0]?.slug).toBeUndefined()
  expect(tickets[0]?.session?.sessionId).toBe('sA')
})

test('AC2 — a ticket gets the session whose cwd is its worktree', () => {
  const tickets = listTickets({
    worktrees: porcelain([WT_A, WT_B]),
    files: {
      [WT_A]: { 'a.md': spec({ title: 'A', status: 'ready' }) },
      [WT_B]: { 'b.md': spec({ title: 'B', status: 'ready' }) },
    },
    sessions: JSON.stringify([
      session({ sessionId: 'sA', cwd: WT_A, isRunning: true }),
      session({ sessionId: 'elsewhere', cwd: '/somewhere/else' }),
    ]),
  })

  const a = tickets.find(t => t.slug === 'a')
  const b = tickets.find(t => t.slug === 'b')
  expect(a?.session).toMatchObject({
    sessionId: 'sA',
    isRunning: true,
    link: 'claude://claude.ai/epitaxy/sA',
  })
  expect(b?.session).toBeUndefined()
})

test('AC2 — an archived session is ignored, the most recently active one wins', () => {
  const tickets = listTickets({
    worktrees: porcelain([WT_A, WT_B, WT_C]),
    files: {
      [WT_A]: { 'a.md': spec({ title: 'A', status: 'ready' }) },
      [WT_B]: { 'b.md': spec({ title: 'B', status: 'ready' }) },
      [WT_C]: { 'c.md': spec({ title: 'C', status: 'ready' }) },
    },
    sessions: JSON.stringify([
      session({
        sessionId: 'a-old',
        cwd: WT_A,
        isRunning: true,
        lastActivityAt: '2026-11-18T08:00:00.000Z',
      }),
      session({
        sessionId: 'a-new',
        cwd: WT_A,
        isRunning: false,
        lastActivityAt: '2026-11-18T12:00:00.000Z',
      }),
      session({
        sessionId: 'a-newest-archived',
        cwd: WT_A,
        isArchived: true,
        lastActivityAt: '2026-11-18T13:00:00.000Z',
      }),
      session({ sessionId: 'b-archived', cwd: WT_B, isArchived: true }),
    ]),
  })

  expect(tickets.find(t => t.slug === 'a')?.session?.sessionId).toBe('a-new')
  expect(tickets.find(t => t.slug === 'b')?.session).toBeUndefined()
  expect(tickets.find(t => t.slug === 'c')?.session).toBeUndefined()
})

test('AC2 — the pilot\'s own session, left out of the list, is matched to its worktree', () => {
  const input = {
    worktrees: porcelain([WT_A, WT_B]),
    files: {
      [WT_A]: { 'a.md': spec({ title: 'A', status: 'ready' }) },
      [WT_B]: { 'b.md': spec({ title: 'B', status: 'ready' }) },
    },
    sessions: JSON.stringify([session({ sessionId: 'sB', cwd: WT_B })]),
  }
  const self = JSON.stringify(
    session({ sessionId: 'pilot', cwd: WT_A, isRunning: true }),
  )

  const tickets = listTickets({ ...input, self })
  expect(tickets.find(t => t.slug === 'a')?.session).toMatchObject({
    sessionId: 'pilot',
    isRunning: true,
    link: 'claude://claude.ai/epitaxy/pilot',
  })
  expect(tickets.find(t => t.slug === 'b')?.session?.sessionId).toBe('sB')
})

test('AC2 — among the list and the pilot\'s own session, the most recently active non-archived one wins', () => {
  const input = {
    worktrees: porcelain([WT_A, WT_B]),
    files: {
      [WT_A]: { 'a.md': spec({ title: 'A', status: 'ready' }) },
      [WT_B]: { 'b.md': spec({ title: 'B', status: 'ready' }) },
    },
    sessions: JSON.stringify([
      session({
        sessionId: 'a-listed',
        cwd: WT_A,
        lastActivityAt: '2026-11-18T09:00:00.000Z',
      }),
      session({
        sessionId: 'b-listed',
        cwd: WT_B,
        lastActivityAt: '2026-11-18T09:00:00.000Z',
      }),
    ]),
  }
  const selfIn = (cwd: string, extra: { isArchived?: boolean } = {}) =>
    JSON.stringify(
      session({
        sessionId: 'pilot',
        cwd,
        lastActivityAt: '2026-11-18T12:00:00.000Z',
        ...extra,
      }),
    )

  const newer = listTickets({ ...input, self: selfIn(WT_A) })
  expect(newer.find(t => t.slug === 'a')?.session?.sessionId).toBe('pilot')

  const archived = listTickets({
    ...input,
    self: selfIn(WT_B, { isArchived: true }),
  })
  expect(archived.find(t => t.slug === 'b')?.session?.sessionId).toBe('b-listed')
})

test('AC2 — a pilot session missing or unreadable leaves the list alone', () => {
  const input = {
    worktrees: porcelain([WT_A]),
    files: { [WT_A]: { 'a.md': spec({ title: 'A', status: 'ready' }) } },
    sessions: JSON.stringify([session({ sessionId: 'sA', cwd: WT_A })]),
  }

  for (const self of [undefined, '', 'Error: no such session', '{"oops":']) {
    const tickets = listTickets({ ...input, self })
    expect(tickets).toHaveLength(1)
    expect(tickets[0]?.session?.sessionId).toBe('sA')
  }
})

test('open-session AC1 — the session taken from self is marked as the pilot\'s own, a listed one is not', () => {
  const tickets = listTickets({
    worktrees: porcelain([WT_A, WT_B]),
    files: {
      [WT_A]: { 'a.md': spec({ title: 'A', status: 'ready' }) },
      [WT_B]: { 'b.md': spec({ title: 'B', status: 'ready' }) },
    },
    sessions: JSON.stringify([session({ sessionId: 'sB', cwd: WT_B })]),
    self: JSON.stringify(session({ sessionId: 'pilot', cwd: WT_A })),
  })

  expect(tickets.find(t => t.slug === 'a')?.session?.isPilot).toBe(true)
  expect(tickets.find(t => t.slug === 'b')?.session?.isPilot).not.toBe(true)
})

test('open-session AC1 — with self missing or unreadable, no session is marked', () => {
  const input = {
    worktrees: porcelain([WT_A]),
    files: { [WT_A]: { 'a.md': spec({ title: 'A', status: 'ready' }) } },
    sessions: JSON.stringify([session({ sessionId: 'sA', cwd: WT_A })]),
  }

  for (const self of [undefined, '', 'Error: no such session', '{"oops":']) {
    const tickets = listTickets({ ...input, self })
    expect(tickets[0]?.session?.isPilot).not.toBe(true)
  }
})

test('hide-done AC1 — a detached worktree with no session yields no ticket, except its shipped specs with a branch', () => {
  const tickets = listTickets({
    worktrees: detachedPorcelain([
      { path: WT_A, detached: true },
      { path: WT_B },
      { path: WT_C, detached: true },
    ]),
    files: {
      [WT_A]: {
        'a-draft.md': spec({ title: 'A draft', status: 'draft' }),
        'a-shipped.md': spec({
          title: 'A shipped',
          status: 'shipped',
          branch: 'feat/a',
        }),
        'a-shipped-no-branch.md': spec({
          title: 'A shipped no branch',
          status: 'shipped',
          noBranch: true,
        }),
        'a-reviewed.md': spec({ title: 'A reviewed', status: 'reviewed' }),
      },
      [WT_B]: { 'b.md': spec({ title: 'B', status: 'ready' }) },
      [WT_C]: { 'c.md': spec({ title: 'C', status: 'draft' }) },
    },
    sessions: '[]',
  })

  expect(tickets.map(t => t.slug).sort()).toEqual(['a-shipped', 'b'])
  expect(tickets.find(t => t.slug === 'a-shipped')).toMatchObject({
    worktree: WT_A,
    status: 'shipped',
    branch: 'feat/a',
  })
})

test('hide-done AC1 — a detached worktree with a matched session keeps its tickets', () => {
  const tickets = listTickets({
    worktrees: detachedPorcelain([
      { path: WT_A, detached: true },
      { path: WT_B, detached: true },
    ]),
    files: {
      [WT_A]: { 'a.md': spec({ title: 'A', status: 'red' }) },
      [WT_B]: { 'b.md': spec({ title: 'B', status: 'red' }) },
    },
    sessions: JSON.stringify([
      session({ sessionId: 'sA', cwd: WT_A, isRunning: true }),
    ]),
  })

  expect(tickets).toHaveLength(1)
  expect(tickets[0]).toMatchObject({ worktree: WT_A, slug: 'a' })
  expect(tickets[0]?.session?.sessionId).toBe('sA')
})

test('AC3 — a review history gives its rounds, last verdict, fixes and the cap', () => {
  const review = [
    '## Round 1 — KO — 2e88aea',
    '### Blocking',
    '- [code] something',
    '',
    '## Decision — 2026-11-18',
    '- a decision',
    '',
    '## Fix 1 — review round 1',
    'red: 1111111',
    '',
    '## Round 2 — KO — e6f83ac',
    '',
    '## Fix 2 — review round 2',
    '',
    '## Round 3 — OK — fa79378',
  ].join('\n')

  expect(parseReview(review)).toEqual({
    rounds: 3,
    verdict: 'OK',
    fixes: 2,
    cap: 3,
  })
  expect(
    parseReview('## Round 1 — KO — 2e88aea\n## Fix 1 — x\n'),
  ).toMatchObject({ rounds: 1, verdict: 'KO', fixes: 1, cap: 3 })
})

test('AC3 — no review file gives no review', () => {
  expect(parseReview(undefined)).toBeUndefined()
})

const ticket = (status: string | undefined, run?: boolean) => ({
  worktree: WT_A,
  slug: status ? 'a' : undefined,
  title: status ? 'A' : undefined,
  status,
  session:
    run === undefined
      ? undefined
      : { sessionId: 's1', isRunning: run, link: 'claude://x/s1' },
})
const asked = { sessionId: 's1', question: 'Which one?', at: 1 }
const review = { rounds: 2, verdict: 'KO', fixes: 1, cap: 3 }

test('AC4 — a pending question on a running session is awaiting answer, before anything else', () => {
  expect(
    deriveState(ticket('draft', true), { questions: [asked] }),
  ).toMatchObject({ kind: 'awaiting-answer', question: 'Which one?' })
  expect(
    deriveState(ticket('shipped', true), { questions: [asked] }),
  ).toMatchObject({ kind: 'awaiting-answer', question: 'Which one?' })
})

test('AC4 — a question of a stopped session is ignored', () => {
  expect(
    deriveState(ticket('draft', false), { questions: [asked] }),
  ).toMatchObject({ kind: 'awaiting-plan-validation' })
  const stopped = deriveState(ticket('red', false), { questions: [asked] })
  expect(stopped.kind).toBe('awaiting-answer')
  expect(stopped.question).toBeUndefined()
})

test('open-session AC2 — a question published by another session of the same worktree is ignored', () => {
  const other = { ...asked, sessionId: 'local_other' }

  expect(
    deriveState(ticket('ready', true), { questions: [other] }),
  ).toEqual(deriveState(ticket('ready', true), {}))
  expect(
    deriveState(ticket('draft', true), { questions: [other] }),
  ).toEqual(deriveState(ticket('draft', true), {}))
})

test('open-session AC3 — a question published by the ticket\'s own session is awaiting answer with it', () => {
  expect(
    deriveState(ticket('ready', true), { questions: [asked] }),
  ).toMatchObject({ kind: 'awaiting-answer', question: 'Which one?' })
})

test('open-session AC3 — a question with no session id is ignored', () => {
  const anonymous = { question: 'Which one?', at: 1 }

  expect(
    deriveState(ticket('ready', true), { questions: [anonymous] }),
  ).toEqual(deriveState(ticket('ready', true), {}))
})

test('AC4 — no session, whatever the status', () => {
  for (const status of ['draft', 'ready', undefined]) {
    expect(deriveState(ticket(status), {}).kind).toBe('no-session')
  }
})

test('hide-done AC2 — a shipped ticket with no session is shipped, not no session', () => {
  expect(deriveState(ticket('shipped'), {}).kind).toBe('shipped')
})

test('AC4 — shipped', () => {
  expect(deriveState(ticket('shipped', false), {}).kind).toBe('shipped')
  expect(deriveState(ticket('shipped', true), {}).kind).toBe('shipped')
})

test('AC4 — a draft waits for plan validation when stopped, is planning when running', () => {
  expect(deriveState(ticket('draft', false), {}).kind).toBe(
    'awaiting-plan-validation',
  )
  expect(deriveState(ticket('draft', true), {}).kind).toBe('planning')
})

test('AC4 — a build or ship that stopped is awaiting answer without a question', () => {
  for (const status of ['ready', 'red', 'green', 'reviewed']) {
    const state = deriveState(ticket(status, false), { review })
    expect(state.kind).toBe('awaiting-answer')
    expect(state.question).toBeUndefined()
  }
})

test('AC4 — green with a review is in review, with its rounds, verdict, fixes and cap', () => {
  expect(deriveState(ticket('green', true), { review })).toMatchObject({
    kind: 'review',
    rounds: 2,
    verdict: 'KO',
    fixes: 1,
    cap: 3,
  })
})

test('AC4 — ready, red, or green without a review is in dev, with its status', () => {
  for (const status of ['ready', 'red', 'green']) {
    expect(deriveState(ticket(status, true), {})).toMatchObject({
      kind: 'in-dev',
      status,
    })
  }
})

test('AC4 — reviewed and running is shipping', () => {
  expect(deriveState(ticket('reviewed', true), { review }).kind).toBe(
    'shipping',
  )
})

test('AC4 — a ticket with a session and no spec is no spec', () => {
  expect(deriveState(ticket(undefined, true), {}).kind).toBe('no-spec')
})

const rollup = (checks: object[], extra: object = {}) => ({
  exitCode: 0,
  stdout: JSON.stringify({
    state: 'OPEN',
    url: 'https://github.com/o/r/pull/7',
    statusCheckRollup: checks,
    ...extra,
  }),
})
const run = (conclusion: string) => ({
  __typename: 'CheckRun',
  status: 'COMPLETED',
  conclusion,
})
const running = { __typename: 'CheckRun', status: 'IN_PROGRESS', conclusion: '' }

test('AC6 — the PR state and url', () => {
  for (const state of ['OPEN', 'MERGED', 'CLOSED']) {
    expect(parsePr(rollup([], { state }))).toMatchObject({
      state,
      url: 'https://github.com/o/r/pull/7',
    })
  }
})

test('AC6 — the CI summary: failing, then pending, then passing, none without a check', () => {
  const ci = (checks: object[]) => parsePr(rollup(checks))?.ci

  expect(ci([run('SUCCESS'), run('FAILURE')])).toBe('failing')
  expect(ci([run('CANCELLED')])).toBe('failing')
  expect(ci([run('TIMED_OUT')])).toBe('failing')
  expect(ci([run('FAILURE'), running])).toBe('failing')
  expect(ci([run('SUCCESS'), running])).toBe('pending')
  expect(ci([run('SUCCESS'), run('SKIPPED')])).toBe('passing')
  expect(ci([])).toBe('none')
})

test('AC6 — gh failing leaves the PR unknown', () => {
  expect(
    parsePr({ exitCode: 1, stdout: '' }),
  ).toBeUndefined()
})

// ---- pilot-v2-ui ----

test('pilot-v2-ui AC1 — the ticket id is taken out of the title, whatever its shape', () => {
  const cases: [string, string][] = [
    ['Dashboard (SPOTIME-192)', 'Dashboard'],
    ['Export CSV — SPOTIME-279', 'Export CSV'],
    ['Export CSV - SPOTIME-279', 'Export CSV'],
    ['Export CSV · SPOTIME-279', 'Export CSV'],
    ['SPOTIME-301: Export CSV', 'Export CSV'],
    ['SPOTIME-301 - Export CSV', 'Export CSV'],
    ['[SPOTIME-188] Login magic link', 'Login magic link'],
  ]
  const ids = ['SPOTIME-192', 'SPOTIME-279', 'SPOTIME-279', 'SPOTIME-279', 'SPOTIME-301', 'SPOTIME-301', 'SPOTIME-188']

  for (const [i, [title, name]] of cases.entries()) {
    const found = ticketId(title, 'slug')
    expect(found.id).toBe(ids[i])
    expect(found.name).toBe(name)
  }
})

test('pilot-v2-ui AC1 — a title with no id keeps its name, no title falls back to the slug', () => {
  const plain = ticketId('Alpha feature', 'alpha')
  expect(plain.id).toBeUndefined()
  expect(plain.name).toBe('Alpha feature')

  const none = ticketId(undefined, 'alpha')
  expect(none.id).toBeUndefined()
  expect(none.name).toBe('alpha')
})

const rowOf = (slug: string, kind: string, since?: number) => ({
  slug,
  state: { kind },
  since,
})

test('pilot-v2-ui AC2 — states are grouped in toi, running and pr, in that order, with their counts', () => {
  const rows = [
    rowOf('pr1', 'shipped'),
    rowOf('run1', 'planning'),
    rowOf('toi1', 'awaiting-answer', 100),
    rowOf('run2', 'in-dev'),
    rowOf('toi2', 'awaiting-plan-validation', 200),
    rowOf('run3', 'review'),
    rowOf('toi3', 'no-session'),
    rowOf('run4', 'shipping'),
    rowOf('run5', 'no-spec'),
  ]

  const grouped = sections(rows)

  expect(grouped.map(s => s.id)).toEqual(['toi', 'running', 'pr'])
  expect(grouped.map(s => s.count)).toEqual([3, 5, 1])
  expect(grouped[0]!.rows.map(r => r.slug).sort()).toEqual(['toi1', 'toi2', 'toi3'])
  expect(grouped[1]!.rows.map(r => r.slug).sort()).toEqual(['run1', 'run2', 'run3', 'run4', 'run5'])
  expect(grouped[2]!.rows.map(r => r.slug)).toEqual(['pr1'])
})

test('pilot-v2-ui AC2 — in toi the row waiting longest comes first, a row with no wait time last', () => {
  const grouped = sections([
    rowOf('none', 'no-session'),
    rowOf('recent', 'awaiting-answer', 3000),
    rowOf('oldest', 'awaiting-plan-validation', 1000),
    rowOf('middle', 'awaiting-answer', 2000),
  ])

  expect(grouped[0]!.id).toBe('toi')
  expect(grouped[0]!.rows.map(r => r.slug)).toEqual(['oldest', 'middle', 'recent', 'none'])
})

test('pilot-v2-ui AC3 — the step of a status out of 5', () => {
  expect(stepOf('draft')).toBe(1)
  expect(stepOf(undefined)).toBe(1)
  expect(stepOf('ready')).toBe(2)
  expect(stepOf('red')).toBe(3)
  expect(stepOf('green')).toBe(4)
  expect(stepOf('reviewed')).toBe(5)
  expect(stepOf('shipped')).toBe(5)
})

const STOPPED_AT = '2026-11-18T10:00:00.000Z'
const stoppedSession = {
  sessionId: 's1',
  isRunning: false,
  link: 'claude://x/s1',
  lastActivityAt: STOPPED_AT,
}

test('pilot-v2-ui AC4 — the wait of a pending question starts at its `at`', () => {
  expect(
    waitingSince({
      state: { kind: 'awaiting-answer', question: 'Which one?', at: 5000 },
      session: { ...stoppedSession, isRunning: true },
    }),
  ).toBe(5000)

  // deriveState carries the question's `at` on the state it builds.
  const state = deriveState(ticket('red', true), {
    questions: [{ ...asked, at: 7000 }],
  })
  expect(waitingSince({ state, session: { ...stoppedSession, isRunning: true } })).toBe(7000)
})

test('pilot-v2-ui AC4 — without a question the wait starts at the stopped session last activity', () => {
  const since = Date.parse(STOPPED_AT)

  expect(
    waitingSince({ state: { kind: 'awaiting-plan-validation' }, session: stoppedSession }),
  ).toBe(since)
  expect(
    waitingSince({ state: { kind: 'awaiting-answer' }, session: stoppedSession }),
  ).toBe(since)
})

test('pilot-v2-ui AC4 — a row with no session, or outside toi, has no wait start', () => {
  expect(waitingSince({ state: { kind: 'no-session' } })).toBeUndefined()
  for (const kind of ['planning', 'in-dev', 'review', 'shipping', 'no-spec', 'shipped']) {
    expect(waitingSince({ state: { kind }, session: stoppedSession })).toBeUndefined()
  }
})

test('pilot-v2-ui AC4 — the elapsed time is floored to minutes, hours, then days', () => {
  const MIN = 60_000
  const H = 60 * MIN
  const D = 24 * H
  const at = (ms: number) => elapsed(1_000_000, 1_000_000 + ms)

  expect(at(0)).toEqual({ n: 0, unit: 'min' })
  expect(at(59_999)).toEqual({ n: 0, unit: 'min' })
  expect(at(MIN)).toEqual({ n: 1, unit: 'min' })
  expect(at(12 * MIN + 30_000)).toEqual({ n: 12, unit: 'min' })
  expect(at(H - 1)).toEqual({ n: 59, unit: 'min' })
  expect(at(H)).toEqual({ n: 1, unit: 'h' })
  expect(at(5 * H + 59 * MIN)).toEqual({ n: 5, unit: 'h' })
  expect(at(D - 1)).toEqual({ n: 23, unit: 'h' })
  expect(at(D)).toEqual({ n: 1, unit: 'd' })
  expect(at(3 * D + 20 * H)).toEqual({ n: 3, unit: 'd' })
})

test('pilot-v2-ui AC5 — the review line gives rounds, cap and what runs now', () => {
  // KO with fewer fixes than KO rounds: the fix runs.
  expect(reviewLine({ rounds: 1, verdict: 'KO', fixes: 0, cap: 3 })).toEqual({
    rounds: 1,
    cap: 3,
    running: 'fix',
  })
  expect(reviewLine({ rounds: 2, verdict: 'KO', fixes: 1, cap: 3 })).toEqual({
    rounds: 2,
    cap: 3,
    running: 'fix',
  })
  // KO with as many fixes as KO rounds: the next round runs.
  expect(reviewLine({ rounds: 2, verdict: 'KO', fixes: 2, cap: 3 })).toEqual({
    rounds: 2,
    cap: 3,
    running: 'round',
  })
  // OK: nothing runs.
  const ok = reviewLine({ rounds: 3, verdict: 'OK', fixes: 2, cap: 3 })
  expect(ok).toMatchObject({ rounds: 3, cap: 3 })
  expect(ok.running).toBeUndefined()
})

test('pilot-v2-ui AC6 — the main checkout with a session and no spec yields no row, another worktree still does', () => {
  const tickets = listTickets({
    worktrees: porcelain([MAIN, WT_A]),
    files: { [MAIN]: {}, [WT_A]: {} },
    sessions: JSON.stringify([
      session({ sessionId: 'sMain', cwd: MAIN }),
      session({ sessionId: 'sA', cwd: WT_A }),
    ]),
  })

  expect(tickets).toHaveLength(1)
  expect(tickets[0]?.worktree).toBe(WT_A)
  expect(tickets[0]?.slug).toBeUndefined()
  expect(tickets[0]?.session?.sessionId).toBe('sA')
})

test('pilot-v2-ui AC4 — a ticket\'s session keeps its last activity', () => {
  const tickets = listTickets({
    worktrees: porcelain([MAIN, WT_A]),
    files: { [MAIN]: {}, [WT_A]: { 'a.md': spec({ title: 'A', status: 'draft' }) } },
    sessions: JSON.stringify([
      session({ sessionId: 'sA', cwd: WT_A, lastActivityAt: STOPPED_AT }),
    ]),
  })

  expect(tickets[0]?.session?.lastActivityAt).toBe(STOPPED_AT)
})

const SPEC_TEXT = [
  '---',
  'status: draft',
  '---',
  '',
  '# Title of the feature',
  '',
  '## User story',
  'As a user, I want STORY-BODY.',
  '',
  '## Acceptance criteria',
  '- [ ] AC1 — CRITERIA-BODY',
  '',
  '### A sub heading',
  'SUB-BODY',
  '',
  '## Out of scope',
  '- OUT-BODY',
  '',
  '## Technical plan',
  'PLAN-BODY',
].join('\n')

test('pilot-v2-ui AC7 — the plan summary is the user story then the acceptance criteria, headings included, nothing else', () => {
  const summary = planSummary(SPEC_TEXT)!

  expect(summary.startsWith('## User story')).toBe(true)
  expect(summary).toContain('STORY-BODY')
  expect(summary).toContain('## Acceptance criteria')
  expect(summary).toContain('CRITERIA-BODY')
  expect(summary).toContain('SUB-BODY')
  expect(summary.indexOf('## Acceptance criteria')).toBeGreaterThan(
    summary.indexOf('STORY-BODY'),
  )
  for (const other of ['status: draft', 'Title of the feature', '## Out of scope', 'OUT-BODY', 'PLAN-BODY']) {
    expect(summary).not.toContain(other)
  }
})

test('pilot-v2-ui AC7 — the two sections come in that order whatever their order in the spec', () => {
  const reversed = [
    '# T',
    '## Acceptance criteria',
    '- CRITERIA-BODY',
    '## User story',
    'STORY-BODY',
    '## Technical plan',
    'PLAN-BODY',
  ].join('\n')
  const summary = planSummary(reversed)!

  expect(summary.indexOf('## User story')).toBeLessThan(
    summary.indexOf('## Acceptance criteria'),
  )
  expect(summary).toContain('STORY-BODY')
  expect(summary).toContain('CRITERIA-BODY')
  expect(summary).not.toContain('PLAN-BODY')
})

test('pilot-v2-ui AC7 — a spec missing one section gives the other, missing both gives none', () => {
  const onlyStory = planSummary('# T\n\n## User story\nSTORY-BODY\n\n## Technical plan\nPLAN-BODY\n')!
  expect(onlyStory).toContain('## User story')
  expect(onlyStory).toContain('STORY-BODY')
  expect(onlyStory).not.toContain('PLAN-BODY')

  const onlyCriteria = planSummary('# T\n\n## Acceptance criteria\n- CRITERIA-BODY\n\n## Technical plan\nPLAN-BODY\n')!
  expect(onlyCriteria).toContain('## Acceptance criteria')
  expect(onlyCriteria).toContain('CRITERIA-BODY')
  expect(onlyCriteria).not.toContain('PLAN-BODY')

  expect(planSummary('# T\n\n## Technical plan\nPLAN-BODY\n')).toBeUndefined()
})

// ---- pilot-gitlab ----

test('pilot-gitlab AC1 — the https, scp-like and ssh origins of gitlab.com give gitlab', () => {
  expect(forgeOf('https://gitlab.com/o/r.git')).toBe('gitlab')
  expect(forgeOf('git@gitlab.com:o/r.git')).toBe('gitlab')
  expect(forgeOf('ssh://git@gitlab.com/o/r.git')).toBe('gitlab')
})

test('pilot-gitlab AC1 — github.com, any other host, an unreadable URL or no origin give github', () => {
  expect(forgeOf('https://github.com/o/r.git')).toBe('github')
  expect(forgeOf('git@github.com:o/r.git')).toBe('github')
  expect(forgeOf('https://gitlab.example.com/o/r.git')).toBe('github')
  expect(forgeOf('not a url')).toBe('github')
  expect(forgeOf('')).toBe('github')
  expect(forgeOf(undefined)).toBe('github')
})

const mr = (extra: object = {}, pipeline?: string | null) => ({
  exitCode: 0,
  stdout: JSON.stringify({
    iid: 42,
    state: 'opened',
    web_url: 'https://gitlab.com/o/r/-/merge_requests/42',
    ...(pipeline === null ? {} : { head_pipeline: { status: pipeline ?? 'success' } }),
    ...extra,
  }),
})

test('pilot-gitlab AC2 — the MR state, number and url, marked as a merge request', () => {
  const cases: [string, string][] = [
    ['opened', 'OPEN'],
    ['locked', 'OPEN'],
    ['merged', 'MERGED'],
    ['closed', 'CLOSED'],
  ]
  for (const [state, expected] of cases) {
    expect(parseMr(mr({ state }))).toMatchObject({
      state: expected,
      number: 42,
      url: 'https://gitlab.com/o/r/-/merge_requests/42',
      kind: 'mr',
    })
  }
})

test('pilot-gitlab AC2 — the pipeline status gives the CI summary', () => {
  const ci = (status: string | null) => parseMr(mr({}, status))?.ci

  expect(ci('success')).toBe('passing')
  for (const status of ['failed', 'canceled']) expect(ci(status)).toBe('failing')
  for (const status of [
    'running',
    'pending',
    'created',
    'preparing',
    'waiting_for_resource',
    'scheduled',
  ]) {
    expect(ci(status)).toBe('pending')
  }
  expect(ci('skipped')).toBe('none')
  expect(ci('manual')).toBe('none')
  expect(ci(null)).toBe('none')
})

test('pilot-gitlab AC2 — a non-zero exit, unparsable output or an unknown state gives no MR', () => {
  expect(parseMr({ exitCode: 1, stdout: '' })).toBeUndefined()
  expect(parseMr({ exitCode: 1, stdout: mr().stdout })).toBeUndefined()
  expect(parseMr({ exitCode: 0, stdout: 'not json' })).toBeUndefined()
  expect(parseMr(mr({ state: 'draft' }))).toBeUndefined()
})

// pilot-v3-ui AC1
const counted = (kind: string) => ({ section: sectionOf(kind), state: { kind } })

test('pilot-v3-ui AC1 — counters: toi, review, dev (the other running rows) and pr', () => {
  const rows = [
    'awaiting-answer',
    'awaiting-answer',
    'awaiting-plan-validation',
    'no-session',
    'planning',
    'in-dev',
    'in-dev',
    'shipping',
    'no-spec',
    'review',
    'review',
    'shipped',
  ].map(rowOf)

  expect(counters(rows)).toEqual({ toi: 4, review: 2, dev: 5, pr: 1 })
  expect(counters([])).toEqual({ toi: 0, review: 0, dev: 0, pr: 0 })
})

// pilot-v3-ui AC2
test('pilot-v3-ui AC2 — planFacts counts the AC lines, ticked or not, and the files under ### Files only', () => {
  const spec = [
    '---',
    'status: ready',
    '---',
    '',
    '# Feature',
    '',
    '## Out of scope',
    '- not a file',
    '',
    '## Acceptance criteria',
    '- [ ] AC1 — one',
    '- [x] AC2 — two',
    '  - [ ] AC9 — indented, not a criterion line',
    '- [ ] a checkbox that is no criterion',
    '- AC3 — no checkbox',
    '- [ ] AC3 — three',
    '',
    '## Technical plan',
    '',
    '### Files',
    '- modified: `a.ts` — one',
    '- new: `b.ts` — two',
    '- modified: `c.ts` — three',
    '  continued on an indented line',
    '',
    '### Tasks (ordered)',
    '- not a file either',
  ].join('\n')

  expect(planFacts(spec)).toEqual({ criteria: 3, files: 3 })
})

test('pilot-v3-ui AC2 — planFacts gives 0 for a spec with neither', () => {
  expect(planFacts('# Feature\n\nJust a title.\n')).toEqual({ criteria: 0, files: 0 })
})

// pilot-v3-ui AC3
const NAMES = ['plan', 'red', 'green', 'review', 'ship']

for (const [step, states] of [
  [1, ['current', 'todo', 'todo', 'todo', 'todo']],
  [3, ['done', 'done', 'current', 'todo', 'todo']],
  [5, ['done', 'done', 'done', 'done', 'current']],
] as const) {
  test(`pilot-v3-ui AC3 — segments at step ${step}: before done, its own current, after todo`, () => {
    expect(segments(step)).toEqual(
      NAMES.map((name, i) => ({ name, state: states[i] })),
    )
  })
}
