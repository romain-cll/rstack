import type { EngineInterface, Register } from 'claude-code'

import type { PilotNext, PilotRow, PilotTicket } from '../types'
import {
  QUESTION_PREFIX,
  readFiles,
  readPlaneConfig,
  readPr,
  readProject,
  readQuestions,
  readRelations,
  readSelf,
  readSessions,
  readStates,
  readWorkItems,
  readWorktrees,
} from './collect'
import { candidates, excludedIds, rankNext, startArgs, summaryKey, summaryPrompt } from './next'
import type { Candidate, PlaneItem, Relations } from './next'
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
const START_SESSION = 'mcp__ccd_session__start_session'
const POLL_MS = 10_000
const PR_MS = 60_000
const ITEMS_MS = 60_000
const RELATIONS_MS = 300_000

const tickets = { plugin: 'rstack', key: 'tickets' } as const
const polledAt = { plugin: 'rstack', key: 'polledAt' } as const
const main = { plugin: 'rstack', key: 'main' } as const
const nextKey = { plugin: 'rstack', key: 'next' } as const

// Per branch: the last `gh` or `glab` answer and when it was asked. A PR read MERGED or
// CLOSED is final: it is not asked again.
const prs = new Map<string, { at: number; pr: Pr | undefined }>()
let timer: { cancel: () => void } | undefined

// What Plane answered since the pane loaded: the project, its states, the work
// items (60 s) and the relations of each (5 min). `Actualiser` empties it.
type PlaneCache = {
  project?: string
  states?: Record<string, string>
  items?: { at: number; list: PlaneItem[] }
  relations: Map<string, { at: number; relations: Relations }>
}
let plane: PlaneCache = { relations: new Map() }
// The ids launched from the pane, which Plane may still list as unstarted.
const launched = new Set<string>()
// What the last build of the list rests on, so a launch can rebuild it at once.
let known:
  | { pool: Candidate[]; tickets: PilotTicket[]; paths: string[]; sessions: string }
  | undefined
let planeBusy = false

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
  const sessions = await readSessions($)
  const listed = listTickets({
    worktrees: porcelain,
    files,
    sessions,
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
  await pollPlane($, porcelain, listed, sessions).catch(() => undefined)
}

// The summary of a candidate: kept per (id, updated_at), else asked from Haiku.
// A call that is not answered leaves none, and is made again at the next poll.
async function summaryOf($: Engine, candidate: Candidate): Promise<string | undefined> {
  const key = summaryKey(candidate.id, candidate.updatedAt)
  const kept = await $.store.get(key)
  if (typeof kept === 'string') return kept
  const answer = await $.model.complete({
    model: 'haiku',
    prompt: summaryPrompt(candidate.name, candidate.description),
    maxTokens: 200,
  })
  const text = answer.isAnswered ? answer.text.trim() : ''
  if (text === '') return undefined
  await $.store.set(key, text)

  return text
}

// The 5 rows from the known candidates, the ids at work and the launched ones.
async function publishNext($: Engine) {
  if (!known) return
  const excluded = excludedIds(known.tickets, known.paths, known.sessions, launched)
  const rows: PilotNext[] = []
  for (const candidate of rankNext(known.pool, excluded)) {
    rows.push({
      id: candidate.id,
      name: candidate.name,
      summary: await summaryOf($, candidate).catch(() => undefined),
      unblocks: candidate.unblocks,
      workitemId: candidate.workitemId,
      updatedAt: candidate.updatedAt,
    })
  }
  await $.state.set(nextKey, JSON.parse(JSON.stringify(rows)))
}

// Reads Plane at its own cadence. A read that fails leaves the last list as it
// is: what was read stays cached, the rest is asked again at the next poll.
async function pollPlane($: Engine, porcelain: string, listed: PilotTicket[], sessions: string) {
  const paths = worktreePaths(porcelain)
  const config = await readPlaneConfig($, paths[0] ?? '')
  if (!config) {
    known = undefined
    await $.state.set(nextKey, [])

    return
  }
  if (planeBusy) return
  planeBusy = true
  try {
    const now = await $.clock.now()
    plane.project ??= await readProject($, config.project)
    if (plane.project === undefined) return
    plane.states ??= await readStates($, plane.project)
    if (plane.states === undefined) return
    if (!plane.items || now - plane.items.at >= ITEMS_MS) {
      const list = await readWorkItems($, plane.project)
      if (list === undefined) return
      plane.items = { at: now, list }
    }
    const relations: Record<string, Relations> = {}
    for (const item of plane.items.list) {
      let kept = plane.relations.get(item.id)
      if (!kept || now - kept.at >= RELATIONS_MS) {
        const fresh = await readRelations($, plane.project, item.id)
        if (fresh === undefined) return
        kept = { at: now, relations: fresh }
        plane.relations.set(item.id, kept)
      }
      relations[item.id] = kept.relations
    }
    known = {
      pool: candidates(plane.items.list, relations, plane.states, config.project),
      tickets: listed,
      paths,
      sessions,
    }
    await publishNext($)
  } finally {
    planeBusy = false
  }
}

// Starts the session of a ticket. Refused from the pane, the pilot session is
// asked to start it, and to report the refusal as a pane defect.
async function launch($: Engine, row: PilotNext) {
  launched.add(row.id)
  const description =
    known?.pool.find(c => c.workitemId === row.workitemId)?.description ?? ''
  const args = startArgs(row, description)
  const answer = await $.tool
    .call({ tool: START_SESSION, ...args })
    .catch((error: unknown) => ({ isError: true, text: String(error), deny: undefined }))
  if (answer.deny !== undefined || answer.isError === true) {
    const reason = answer.deny ?? answer.text ?? 'no reason given'
    await $.prompt.submit({
      text:
        `The rstack pilot pane could not start the session of ${row.id}: ` +
        `\`${START_SESSION}\` was refused with "${reason}". ` +
        `Start that session yourself with this input:\n\n${JSON.stringify(args, null, 2)}\n\n` +
        `Then report the refusal and its reason to the user as a pane defect to fix.`,
    })
  }
  await publishNext($)
}

async function startPolling($: Engine, id: string) {
  timer?.cancel()
  plane = { relations: new Map() }
  launched.clear()
  known = undefined
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
    // Rows that are not a PilotNext (an unset key, a stub answering one value
    // to every key) are not drawn.
    const upNext = ((await $.state.get(nextKey)).value ?? []).filter(
      row => Array.isArray(row?.unblocks),
    )
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
        <Text weight="medium" wrap="truncate-end">
          {row.name}
        </Text>
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
        <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} paddingX={1}>
          {lines as never}
        </Box>
      </Box>
    )
    const tile = (n: number, label: string, color?: string) => (
      <Box
        key={label}
        flexDirection="column"
        flexGrow={1}
        minWidth={12}
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
    // A line of a row: the left part gives way to the right one, clipped when
    // the pane is too narrow for both, so the right part stays in view.
    const line = (left: unknown[], right: unknown[]) => (
      <Box justifyContent="space-between" gap={1}>
        <Box gap={1} flexShrink={1} minWidth={0} overflow="hidden">
          {left.filter(Boolean) as never}
        </Box>
        <Box gap={1} flexShrink={0}>
          {right.filter(Boolean) as never}
        </Box>
      </Box>
    )
    let hotkey = 0

    return (
      <Box flexDirection="column" gap={1}>
        <Box justifyContent="space-between" flexWrap="wrap" gap={1}>
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
            <Button
              key="refresh"
              onPress={() => {
                plane = { relations: new Map() }
                void poll($).catch(() => undefined)
              }}
            >
              Actualiser
            </Button>
          </Box>
        </Box>
        <Box gap={1} flexWrap="wrap">
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
                        {line(
                          [
                            pr?.number !== undefined && (
                              <Text mono dimColor>
                                {`${pr.kind === 'mr' ? '!' : '#'}${pr.number}`}
                              </Text>
                            ),
                            nameOf(row, key),
                          ],
                          [
                            ci && <Text color={ci.color}>{`${ci.icon} CI`}</Text>,
                            pr && (
                              <Link href={pr.url}>{pr.kind === 'mr' ? 'MR' : 'PR'}</Link>
                            ),
                          ],
                        )}
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
                        <Box gap={1} minWidth={0} overflow="hidden">
                          <Text color="warning">{plan ? '☑' : '?'}</Text>
                          {idOf(row)}
                          {nameOf(row, key)}
                        </Box>
                        <Text dimColor>{toiLine(row)}</Text>
                        <Box justifyContent="space-between" flexWrap="wrap" gap={1}>
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
                      {line(
                        [idOf(row), nameOf(row, key)],
                        [<Text color={color}>{runningStatus(row)}</Text>],
                      )}
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
        {upNext.length > 0 && (
          <Box flexDirection="column" gap={1}>
            <Text size="caption" dimColor>
              {SECTION_TITLES.next}
            </Text>
            {upNext.map(row =>
              card(
                `next:${row.id}`,
                'inactive',
                <>
                  <Box gap={1} minWidth={0} overflow="hidden">
                    <Text mono dimColor>
                      {row.id}
                    </Text>
                    <Text weight="medium" wrap="truncate-end">
                      {row.name}
                    </Text>
                  </Box>
                  <Box>{row.summary && <Text dimColor>{row.summary}</Text>}</Box>
                  <Box justifyContent="space-between" flexWrap="wrap" gap={1}>
                    <Text size="caption" dimColor>
                      {row.unblocks.length > 0 ? `débloque ${row.unblocks.join(', ')}` : ''}
                    </Text>
                    <Button
                      key={`next:${row.id}:launch`}
                      variant="secondary"
                      onPress={() => void launch($, row).catch(() => undefined)}
                    >
                      Lancer
                    </Button>
                  </Box>
                </>,
              ),
            )}
          </Box>
        )}
      </Box>
    )
  })
}

const SECTION_TITLES = { toi: 'À toi', running: 'En cours', pr: 'PR', next: 'À lancer' } as const

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
