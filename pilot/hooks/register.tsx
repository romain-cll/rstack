import type { EngineInterface, Register } from 'claude-code'

import type { PilotRow } from '../types'
import {
  QUESTION_PREFIX,
  readFiles,
  readPr,
  readSelf,
  readQuestions,
  readSessions,
  readWorktrees,
} from './collect'
import type { Pr } from './tickets'
import {
  deriveState,
  listTickets,
  parsePr,
  parseReview,
  selfId,
  worktreePaths,
} from './tickets'

type Engine = EngineInterface

const PANE = 'pilot'
const MARK = 'pilot'
const OPEN_SESSION = 'mcp__ccd_window__open_session_in'
const POLL_MS = 10_000
const PR_MS = 60_000

const tickets = { plugin: 'pilot', key: 'tickets' } as const

// Per branch: the last `gh` answer and when it was asked.
const prs = new Map<string, { at: number; pr: Pr | undefined }>()
let timer: { cancel: () => void } | undefined

async function prOf($: Engine, worktree: string, branch: string) {
  const now = await $.clock.now()
  const known = prs.get(branch)
  if (known && now - known.at < PR_MS) return known.pr
  const pr = parsePr(await readPr($, worktree, branch))
  prs.set(branch, { at: now, pr })

  return pr
}

async function poll($: Engine) {
  const porcelain = await readWorktrees($)
  const files = await readFiles($, worktreePaths(porcelain))
  const listed = listTickets({
    worktrees: porcelain,
    files,
    sessions: await readSessions($),
    self: await readSelf($),
  })
  const questions = await readQuestions($)

  const rows: PilotRow[] = []
  for (const ticket of listed) {
    const review = parseReview(files[ticket.worktree]?.[`${ticket.slug}.review.md`])
    const state = deriveState(ticket, { review, questions })
    const pr =
      state.kind === 'shipped' && ticket.branch
        ? await prOf($, ticket.worktree, ticket.branch)
        : undefined
    if (pr?.state === 'MERGED' || pr?.state === 'CLOSED') continue
    rows.push({ ...ticket, state, review, pr })
  }
  await $.state.set(tickets, JSON.parse(JSON.stringify(rows)))
}

async function startPolling($: Engine, id: string) {
  timer?.cancel()
  const tick = async () => {
    if ((await $.store.get(MARK)) !== id) {
      timer?.cancel()
      await $.ui.close({ id: PANE })

      return
    }
    await poll($)
  }
  timer = $.clock.every(POLL_MS, () => void tick().catch(() => undefined))
  void tick().catch(() => undefined)
}

async function openPane($: Engine) {
  await $.ui.open({ id: PANE, title: 'Pilot' })
  await startPolling($, await $.session.id())
}

async function openSession($: Engine, session: { sessionId: string; link: string }) {
  const opened = await $.tool
    .call({ tool: OPEN_SESSION, session_id: session.sessionId, target: 'focus' })
    .catch(() => undefined)
  if (!opened || opened.deny !== undefined || opened.isError === true) {
    await $.process.run(['open', session.link])
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pilot',
      description: 'Show where every rstack ticket stands in a pane',
    })
    if ((await $.store.get(MARK)) === (await $.session.id())) await openPane($)

    return next(e)
  })

  on('command.run', { command: 'pilot' }, async $ => {
    await $.store.set(MARK, await $.session.id())
    await openPane($)

    return { text: 'Pilot pane opened.' }
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool !== 'AskUserQuestion') return next(e)
    const key = `${QUESTION_PREFIX}${await $.session.id()}`
    await $.store
      .set(key, {
        sessionId: selfId(await readSelf($)),
        question: e.questions[0]?.question,
        at: await $.clock.now(),
      })
      .catch(() => undefined)
    try {
      return await next(e)
    } finally {
      await $.store.delete(key).catch(() => undefined)
    }
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    if (e.origin.kind === 'person') {
      timer?.cancel()
      await $.store.delete(MARK)
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Link } = $.ui.resolve(e)
    const { value: rows = [] } = await $.state.get(tickets)
    const waiting = (row: PilotRow) => row.state.kind.startsWith('awaiting')
    const ordered = [...rows.filter(waiting), ...rows.filter(row => !waiting(row))]

    return (
      <Box flexDirection="column">
        {ordered.length === 0 && <Text dimColor>No ticket.</Text>}
        {ordered.map(row => (
          <Box key={`${row.worktree}/${row.slug}`} flexDirection="column">
            <Text bold>{row.title ?? row.worktree}</Text>
            <Text dimColor>{describe(row)}</Text>
            {row.state.question && <Text>{row.state.question}</Text>}
            {row.pr && (
              <Text>
                <Link href={row.pr.url}>{`PR ${row.pr.state}`}</Link> CI {row.pr.ci}
              </Text>
            )}
            {row.session && !row.session.isPilot && (
              <Button
                key={`open-${row.worktree}/${row.slug}`}
                onPress={() => openSession($, row.session!)}
              >
                Open session
              </Button>
            )}
          </Box>
        ))}
      </Box>
    )
  })
}

function describe(row: PilotRow): string {
  const { kind, status, rounds, verdict, fixes, cap } = row.state
  if (kind === 'review') return `review: round ${rounds} ${verdict}, fix ${fixes}/${cap}`
  if (kind === 'in-dev') return `in dev: ${status}`

  return kind.replaceAll('-', ' ')
}
