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
import { expect, test } from 'claude-code/testing'

import {
  deriveState,
  listTickets,
  parsePr,
  parseReview,
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

const spec = (o: {
  title: string
  status: string
  branch?: string
  red?: string
}) =>
  [
    '---',
    `status: ${o.status}`,
    ...(o.red ? [`red: ${o.red}`] : []),
    'owner: Someone',
    `branch: ${o.branch ?? 'feat/x'}`,
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
  for (const status of ['draft', 'ready', 'shipped', undefined]) {
    expect(deriveState(ticket(status), {}).kind).toBe('no-session')
  }
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
