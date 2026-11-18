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
  counters,
  deriveState,
  elapsed,
  listTickets,
  parseReview,
  planFacts,
  reviewLine,
  sectionOf,
  sections,
  segments,
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
const polledAt = { plugin: 'pilot', key: 'polledAt' } as const
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
  const collectedAt = await $.clock.now()
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
      facts: spec === undefined ? undefined : planFacts(spec),
      state,
      review,
      pr,
    })
  }
  await $.state.set(main, worktreePaths(porcelain)[0]?.split('/').pop() ?? '')
  await $.state.set(tickets, JSON.parse(JSON.stringify(rows)))
  await $.state.set(polledAt, collectedAt)
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
    const folder = (await $.state.get(main)).value
    const collected = (await $.state.get(polledAt)).value
    const now = await $.clock.now()
    const grouped = sections(rows)
    const count = counters(rows)

    if (e.props.placement === 'widget') {
      // The first of À toi is the row that has waited longest.
      const first = grouped.find(g => g.id === 'toi')?.rows[0]

      return (
        <Box flexDirection="column" gap={1}>
          <Box justifyContent="space-between">
            <Text weight="semibold">Pilot</Text>
            <Text color="inverseText" backgroundColor="warning">
              {` ${count.toi} à toi `}
            </Text>
          </Box>
          <Box gap={1}>
            {rows.map(row => (
              <Text key={`${row.worktree}/${row.slug}`} color={edgeOf(row)}>
                ■
              </Text>
            ))}
          </Box>
          <Text size="caption" dimColor>
            {first
              ? `${first.id ?? first.name} ${WAITS[first.state.kind] ?? ''}`.trim()
              : "Rien ne t'attend."}
          </Text>
        </Box>
      )
    }

    const openable = (row: PilotRow) =>
      row.session && !row.session.isPilot ? row.session : undefined
    const nameOf = (row: PilotRow, key: string) => {
      const session = openable(row)

      return session ? (
        <Button key={`${key}:name`} plain onPress={() => void openSession($, session)}>
          {row.name}
        </Button>
      ) : (
        <Text weight="medium">{row.name}</Text>
      )
    }
    const idOf = (row: PilotRow) =>
      row.id && (
        <Text mono dimColor>
          {row.id}
        </Text>
      )
    // A card: a 1-cell edge colored by the row, then its lines.
    const card = (key: string, edge: string, lines: unknown) => (
      <Box key={key} borderStyle="single" borderColor="inactive">
        <Box width={1} backgroundColor={edge} />
        <Box flexDirection="column" flexGrow={1} paddingX={1}>
          {lines as never}
        </Box>
      </Box>
    )
    const tile = (n: number, label: string, color?: string) => (
      <Box
        key={label}
        flexDirection="column"
        flexGrow={1}
        paddingX={1}
        borderStyle="single"
        borderColor={color ?? 'inactive'}
      >
        <Text size="heading" weight="semibold" color={color}>
          {String(n)}
        </Text>
        <Text size="caption" color={color} dimColor={color === undefined}>
          {label}
        </Text>
      </Box>
    )
    let hotkey = 0

    return (
      <Box flexDirection="column" gap={1}>
        <Box justifyContent="space-between">
          <Box gap={1}>
            <Text weight="semibold">Pilot</Text>
            {typeof folder === 'string' && <Text dimColor>{folder}</Text>}
          </Box>
          <Box gap={1}>
            {typeof collected === 'number' && (
              <Text size="caption" dimColor>
                {`collecte à ${clock(collected)}`}
              </Text>
            )}
            <Button key="refresh" onPress={() => void poll($).catch(() => undefined)}>
              Actualiser
            </Button>
          </Box>
        </Box>
        <Box gap={1}>
          {tile(count.toi, "t'attendent", 'warning')}
          {tile(count.dev, 'en dev')}
          {tile(count.review, 'en review')}
          {tile(count.pr, 'PR ouvertes')}
        </Box>
        {rows.length === 0 && <Text dimColor>Aucun ticket.</Text>}
        {grouped
          .filter(section => section.count > 0)
          .map(section => (
            <Box key={section.id} flexDirection="column" gap={1}>
              <Text size="caption" dimColor>
                {SECTION_TITLES[section.id]}
              </Text>
              {section.id === 'pr' ? (
                <Box
                  flexDirection="column"
                  borderStyle="single"
                  borderColor="inactive"
                  paddingX={1}
                >
                  {section.rows.map((row, i) => {
                    const key = `${row.worktree}/${row.slug}`
                    const pr = row.pr
                    const ci = pr && CI[pr.ci as keyof typeof CI]

                    return (
                      <Box key={key} flexDirection="column">
                        {i > 0 && (
                          <Text dimColor wrap="clip">
                            {'─'.repeat(Math.max(0, e.props.bodyColumns - 4))}
                          </Text>
                        )}
                        <Box justifyContent="space-between">
                          <Box gap={1}>
                            {pr?.number !== undefined && (
                              <Text mono dimColor>
                                {`${pr.kind === 'mr' ? '!' : '#'}${pr.number}`}
                              </Text>
                            )}
                            {nameOf(row, key)}
                          </Box>
                          <Box gap={1}>
                            {ci && (
                              <Text color={ci.color}>{`${ci.icon} CI`}</Text>
                            )}
                            {pr && (
                              <Link href={pr.url}>{pr.kind === 'mr' ? 'MR' : 'PR'}</Link>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              ) : (
                section.rows.map(row => {
                  const key = `${row.worktree}/${row.slug}`
                  const since =
                    row.since !== undefined ? elapsed(row.since, now) : undefined

                  if (section.id === 'toi') {
                    const session = openable(row)
                    const plan = row.state.kind === 'awaiting-plan-validation'
                    const press = session && hotkey < 9 ? (hotkey += 1) : undefined

                    return card(
                      key,
                      'warning',
                      <>
                        <Box gap={1}>
                          <Text color="warning">{plan ? '☑' : '?'}</Text>
                          {idOf(row)}
                          {nameOf(row, key)}
                        </Box>
                        <Text dimColor>{toiLine(row)}</Text>
                        <Box justifyContent="space-between">
                          <Text size="caption" dimColor>
                            {since
                              ? `depuis ${since.n} ${since.unit === 'd' ? 'j' : since.unit}`
                              : ''}
                          </Text>
                          {session && (
                            <Button
                              key={`${key}:action`}
                              variant="secondary"
                              hotkey={press === undefined ? undefined : String(press)}
                              onPress={() => void openSession($, session)}
                            >
                              {plan ? 'Voir le plan' : 'Répondre'}
                            </Button>
                          )}
                        </Box>
                      </>,
                    )
                  }

                  const color = edgeOf(row)

                  return card(
                    key,
                    color,
                    <>
                      <Box justifyContent="space-between">
                        <Box gap={1}>
                          {idOf(row)}
                          {nameOf(row, key)}
                        </Box>
                        <Text color={color}>{runningStatus(row)}</Text>
                      </Box>
                      <Box gap={1}>
                        {segments(row.step).map(segment => (
                          <Box
                            key={segment.name}
                            flexGrow={1}
                            height={1}
                            backgroundColor={
                              segment.state === 'done'
                                ? 'success'
                                : segment.state === 'current'
                                  ? color
                                  : 'inactive'
                            }
                          />
                        ))}
                      </Box>
                    </>,
                  )
                })
              )}
              {section.id === 'running' && (
                <Text size="caption" dimColor>
                  plan · rouge · vert · review · ship
                </Text>
              )}
            </Box>
          ))}
      </Box>
    )
  })
}

const SECTION_TITLES = { toi: 'À toi', running: 'En cours', pr: 'PR' } as const

const LABELS: Record<string, string> = {
  'awaiting-answer': 'Réponse attendue',
  'awaiting-plan-validation': 'Plan à valider',
  'no-session': 'Pas de session',
}

const WAITS: Record<string, string> = {
  'awaiting-answer': 'attend une réponse',
  'awaiting-plan-validation': 'attend la validation du plan',
  'no-session': "n'a pas de session",
}

const CI = {
  passing: { icon: '✓', color: 'success' },
  pending: { icon: '◷', color: 'warning' },
  failing: { icon: '✕', color: 'error' },
} as const

// The color of a row's edge: by who has the ball, then by its step (plan,
// red, green, review, ship).
const STEP_COLORS = ['inactive', 'error', 'success', 'suggestion', 'inactive']

function edgeOf(row: PilotRow): string {
  if (row.section === 'toi') return 'warning'
  if (row.section === 'pr') return 'success'

  return STEP_COLORS[row.step - 1] ?? 'inactive'
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// The local time, HH:MM.
function clock(at: number): string {
  const date = new Date(at)
  const two = (n: number) => String(n).padStart(2, '0')

  return `${two(date.getHours())}:${two(date.getMinutes())}`
}

// The line under a toi row's title: the question, else what the plan holds,
// else the state's label.
function toiLine(row: PilotRow): string {
  const { kind, question } = row.state
  if (question) return question
  if (kind === 'awaiting-plan-validation' && row.facts) {
    return `Plan prêt · ${plural(row.facts.criteria, 'critère')} · ${plural(row.facts.files, 'fichier')}`
  }

  return LABELS[kind] ?? kind
}

// The short status on the right of an En cours row.
function runningStatus(row: PilotRow): string {
  const { kind } = row.state
  if (kind === 'no-spec') return 'pas de spec'
  if (kind === 'review' && row.review) {
    return `review ${row.review.rounds}/${row.review.cap} · ${row.review.fixes} fix`
  }
  if (row.step === 2) {
    return row.facts ? `rouge · ${plural(row.facts.criteria, 'critère')}` : 'rouge'
  }

  return ['plan en cours', '', 'vert · en dev', 'review', 'ship en cours'][row.step - 1] ?? ''
}
