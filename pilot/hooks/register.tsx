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
  elapsed,
  listTickets,
  parseReview,
  planSummary,
  reviewLine,
  sectionOf,
  sections,
  selfId,
  stepOf,
  ticketId,
  waitingSince,
  worktreePaths,
} from './tickets'

type Engine = EngineInterface

const PANE = 'pilot'
const MARK = 'pilot'
const OPEN_SESSION = 'mcp__ccd_window__open_session_in'
const POLL_MS = 10_000
const PR_MS = 60_000

const tickets = { plugin: 'pilot', key: 'tickets' } as const
const shown = { plugin: 'pilot', key: 'shown' } as const
const main = { plugin: 'pilot', key: 'main' } as const

// Per branch: the last `gh` or `glab` answer and when it was asked. A PR read MERGED or
// CLOSED is final: it is not asked again.
const prs = new Map<string, { at: number; pr: Pr | undefined }>()
let timer: { cancel: () => void } | undefined

async function prOf($: Engine, worktree: string, branch: string) {
  const now = await $.clock.now()
  const known = prs.get(branch)
  const finished = known?.pr?.state === 'MERGED' || known?.pr?.state === 'CLOSED'
  if (known && (finished || now - known.at < PR_MS)) return known.pr
  const { result, parse } = await readPr($, worktree, branch)
  const pr = parse(result)
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
    const { id, name } = ticketId(
      ticket.title,
      ticket.slug ?? ticket.worktree.split('/').pop() ?? ticket.worktree,
    )
    const spec = files[ticket.worktree]?.[`${ticket.slug}.md`]
    rows.push({
      ...ticket,
      id,
      name,
      section: sectionOf(state.kind),
      step: stepOf(ticket.status),
      since: waitingSince({ state, session: ticket.session }),
      plan: spec === undefined ? undefined : planSummary(spec),
      state,
      review,
      pr,
    })
  }
  await $.state.set(main, worktreePaths(porcelain)[0]?.split('/').pop() ?? '')
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
    const { Box, Text, Button, Link, Markdown } = $.ui.resolve(e)
    const { value: rows = [] } = await $.state.get(tickets)
    const open = (await $.state.get(shown)).value
    const folder = (await $.state.get(main)).value
    const now = await $.clock.now()
    const grouped = sections(rows)
    const count = (id: string) => grouped.find(g => g.id === id)?.count ?? 0

    const togglePlan = async (key: string) => {
      const current = (await $.state.get(shown)).value
      await $.state.set(shown, current === key ? '' : key)
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Box justifyContent="space-between">
          <Text bold>
            {typeof folder === 'string' ? folder.toUpperCase() : 'PILOT'} ·{' '}
            {rows.length} {rows.length === 1 ? 'ticket' : 'tickets'}
          </Text>
          <Text dimColor>
            À toi {count('toi')} · En cours {count('running')} · PR {count('pr')}
          </Text>
        </Box>
        {rows.length === 0 && <Text dimColor>Aucun ticket.</Text>}
        {grouped
          .filter(section => section.count > 0)
          .map(section => (
            <Box key={section.id} flexDirection="column" gap={1}>
              <Text bold color={section.id === 'toi' ? 'claude' : 'subtle'}>
                {SECTION_TITLES[section.id]} ({section.count})
              </Text>
              {section.rows.map(row => {
                const key = `${row.worktree}/${row.slug}`
                const session = row.session
                const press =
                  session && !session.isPilot
                    ? () => void openSession($, session)
                    : undefined
                const mark = (
                  <Text color="claude">{section.id === 'toi' ? '┃' : ' '}</Text>
                )

                return (
                  <Box key={key} flexDirection="column">
                    {/* Only the name is a Button: the desktop draws a Button's
                        label as plain text and drops the style of every Text in it. */}
                    <Box gap={1}>
                      {mark}
                      {row.id && (
                        <Text mono color="inverseText" backgroundColor="text">
                          {` ${row.id} `}
                        </Text>
                      )}
                      {press ? (
                        <Button key={`${key}:name`} plain onPress={press}>
                          {row.name}
                        </Button>
                      ) : (
                        <Text bold>{row.name}</Text>
                      )}
                    </Box>
                    <Box justifyContent="space-between">
                      <Box gap={1}>
                        {mark}
                        <Text dimColor>{describe(row, now)}</Text>
                        <Text>
                          <Text color="suggestion">{'●'.repeat(row.step)}</Text>
                          <Text color="inactive">{'○'.repeat(5 - row.step)}</Text>
                        </Text>
                      </Box>
                      <Box gap={1}>
                        {row.pr && (
                          <Link href={row.pr.url}>{row.pr.kind === 'mr' ? 'MR' : 'PR'}</Link>
                        )}
                        {row.plan && (
                          <Button
                            key={`plan:${key}`}
                            onPress={() => void togglePlan(key)}
                          >
                            {open === key ? 'Masquer le plan' : 'Voir le plan'}
                          </Button>
                        )}
                      </Box>
                    </Box>
                    {row.state.question && (
                      <Text color="warning">{`  ${row.state.question}`}</Text>
                    )}
                    {open === key && row.plan && (
                      <Markdown key={`md:${key}`} text={row.plan} />
                    )}
                  </Box>
                )
              })}
            </Box>
          ))}
      </Box>
    )
  })
}

const SECTION_TITLES = { toi: 'À TOI', running: 'EN COURS', pr: 'PR' } as const

const LABELS: Record<string, string> = {
  'awaiting-answer': 'Réponse attendue',
  'awaiting-plan-validation': 'Plan à valider',
  'no-session': 'Pas de session',
  planning: 'Plan en cours',
  'in-dev': 'En dev',
  shipping: 'Ship en cours',
  'no-spec': 'Pas de spec',
}

const CI = { passing: 'CI ✓', failing: 'CI ✗', pending: 'CI …' } as const

// The dim line under a row's title, without the progress dots.
function describe(row: PilotRow, now: number): string {
  const { kind } = row.state
  const parts: string[] = []
  if (kind === 'shipped') {
    const pr = row.pr
    if (pr?.number !== undefined) {
      parts.push(`${pr.kind === 'mr' ? '!' : '#'}${pr.number}`)
    }
    const ci = CI[pr?.ci as keyof typeof CI]
    if (ci) parts.push(ci)
    if (pr?.state === 'OPEN' && pr.ci === 'passing') parts.push('prête à merger')
    if (parts.length === 0) parts.push('PR')
  } else if (kind === 'review' && row.review) {
    const { rounds, cap, running } = reviewLine(row.review)
    parts.push(`Review ${rounds}/${cap}`)
    if (running) parts.push(`${running} en cours`)
  } else {
    parts.push(LABELS[kind] ?? kind)
  }
  if (row.since !== undefined) {
    const { n, unit } = elapsed(row.since, now)
    parts.push(`depuis ${n} ${unit === 'd' ? 'j' : unit}`)
  }

  return parts.join(' · ')
}
