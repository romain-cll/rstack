// The pure functions of the pilot: what the reads return in, tickets and
// their state out. Nothing here touches the engine.
import type {
  PilotPr as Pr,
  PilotQuestion as Question,
  PilotReview as Review,
  PilotState as State,
  PilotTicket as Ticket,
} from '../types'

export type { Pr, Question, Review, State, Ticket }

const REVIEW_CAP = 3

export function worktreePaths(porcelain: string): string[] {
  return porcelain
    .split('\n')
    .filter(line => line.startsWith('worktree '))
    .map(line => line.slice('worktree '.length))
}

// The worktrees HEAD is detached in: the app keeps an archived session's
// worktree in a reuse pool that way.
function detachedPaths(porcelain: string): Set<string> {
  return new Set(
    porcelain
      .split(/\n\s*\n/)
      .filter(block => block.split('\n').includes('detached'))
      .flatMap(worktreePaths),
  )
}

function frontmatter(text: string): Record<string, string> {
  const lines = text.split('\n')
  const fields: Record<string, string> = {}
  if (lines[0]?.trim() !== '---') return fields
  for (const line of lines.slice(1)) {
    if (line.trim() === '---') break
    const colon = line.indexOf(':')
    if (colon > 0) fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim()
  }

  return fields
}

function title(text: string): string | undefined {
  return text
    .split('\n')
    .find(line => line.startsWith('# '))
    ?.slice(2)
    .trim()
}

function sessionsOf(json: string): Record<string, unknown>[] {
  try {
    const parsed: unknown = JSON.parse(json)

    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function selfOf(json: string | undefined): Record<string, unknown>[] {
  try {
    const parsed: unknown = JSON.parse(json ?? '')

    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? [parsed as Record<string, unknown>]
      : []
  } catch {
    return []
  }
}

// The app session id of a `get_session` answer, if it names one.
export function selfId(json: string | undefined): string | undefined {
  const id = selfOf(json)[0]?.sessionId

  return typeof id === 'string' ? id : undefined
}

function sessionOf(
  worktree: string,
  sessions: Record<string, unknown>[],
  selfSessionId?: string,
) {
  const found = sessions
    .filter(s => s.cwd === worktree && s.isArchived !== true)
    .sort(
      (a, b) =>
        Date.parse(String(b.lastActivityAt)) -
        Date.parse(String(a.lastActivityAt)),
    )[0]

  return found
    ? {
        sessionId: String(found.sessionId),
        isRunning: found.isRunning === true,
        link: String(found.link),
        ...(typeof found.lastActivityAt === 'string'
          ? { lastActivityAt: found.lastActivityAt }
          : {}),
        ...(selfSessionId !== undefined && String(found.sessionId) === selfSessionId
          ? { isPilot: true }
          : {}),
      }
    : undefined
}

export function listTickets(input: {
  worktrees: string
  files: Record<string, Record<string, string>>
  sessions: string
  self?: string
}): Ticket[] {
  const sessions = [...sessionsOf(input.sessions), ...selfOf(input.self)]
  const own = selfId(input.self)
  const detached = detachedPaths(input.worktrees)

  const [main] = worktreePaths(input.worktrees)

  return worktreePaths(input.worktrees).flatMap((worktree): Ticket[] => {
    const session = sessionOf(worktree, sessions, own)
    const pooled = !session && detached.has(worktree)
    const files = input.files[worktree] ?? {}
    const specs = Object.keys(files)
      .filter(name => name.endsWith('.md') && !name.endsWith('.review.md'))
      .sort()
    if (specs.length === 0) {
      // The main checkout's session is the user's own, not a ticket's.
      return session && worktree !== main ? [{ worktree, session }] : []
    }

    return specs.flatMap((name): Ticket[] => {
      const text = files[name] ?? ''
      const meta = frontmatter(text)
      // A pool worktree keeps its shipped specs with a branch: the PR decides.
      if (pooled && !(meta.status === 'shipped' && meta.branch)) return []

      return [{
        worktree,
        slug: name.slice(0, -'.md'.length),
        title: title(text),
        status: meta.status,
        branch: meta.branch,
        red: meta.red,
        session,
      }]
    })
  })
}

export function parseReview(text: string | undefined): Review | undefined {
  if (text === undefined) return undefined
  const rounds = [...text.matchAll(/^## Round \d+ — (OK|KO) — /gm)]
  const last = rounds[rounds.length - 1]
  if (!last?.[1]) return undefined

  return {
    rounds: rounds.length,
    verdict: last[1],
    fixes: [...text.matchAll(/^## Fix \d+/gm)].length,
    cap: REVIEW_CAP,
  }
}

const BUILDING = ['ready', 'red', 'green', 'reviewed']

export function deriveState(
  ticket: Ticket,
  context: { review?: Review; questions?: Question[] },
): State {
  const { status, session } = ticket
  const asked = (context.questions ?? [])
    .filter(q => q.sessionId !== undefined && q.sessionId === session?.sessionId)
    .sort((a, b) => b.at - a.at)[0]

  if (asked && session?.isRunning) {
    return { kind: 'awaiting-answer', question: asked.question, at: asked.at }
  }
  if (status === 'shipped') return { kind: 'shipped' }
  if (!session) return { kind: 'no-session' }
  if (status === 'draft' && !session.isRunning) {
    return { kind: 'awaiting-plan-validation' }
  }
  if (status && BUILDING.includes(status) && !session.isRunning) {
    return { kind: 'awaiting-answer' }
  }
  if (status === 'draft') return { kind: 'planning' }
  if (status === 'green' && context.review) return { kind: 'review', ...context.review }
  if (status === 'ready' || status === 'red' || status === 'green') {
    return { kind: 'in-dev', status }
  }
  if (status === 'reviewed') return { kind: 'shipping' }

  return { kind: 'no-spec' }
}

const FAILED = ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ERROR']

export function parsePr(result: {
  exitCode: number
  stdout: string
}): Pr | undefined {
  if (result.exitCode !== 0) return undefined
  try {
    const pr = JSON.parse(result.stdout)
    if (!['OPEN', 'MERGED', 'CLOSED'].includes(pr.state)) return undefined
    const checks: Record<string, string>[] = pr.statusCheckRollup ?? []
    const concluded = (c: Record<string, string>) => c.conclusion || c.state || ''
    const ci = checks.some(c => FAILED.includes(concluded(c)))
      ? 'failing'
      : checks.some(c => c.status !== 'COMPLETED' && c.state !== 'SUCCESS')
        ? 'pending'
        : checks.length > 0
          ? 'passing'
          : 'none'

    return {
      state: pr.state,
      url: String(pr.url),
      ci,
      ...(typeof pr.number === 'number' ? { number: pr.number } : {}),
    }
  } catch {
    return undefined
  }
}

export type Forge = 'gitlab' | 'github'

const ORIGIN_HOST = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@/]*@)?([^/:]+)[:/]/i

// The forge of an `origin` URL: gitlab.com is gitlab, anything else github.
export function forgeOf(url: string | undefined): Forge {
  return url?.trim().match(ORIGIN_HOST)?.[1]?.toLowerCase() === 'gitlab.com'
    ? 'gitlab'
    : 'github'
}

const MR_STATES: Record<string, string> = {
  opened: 'OPEN',
  locked: 'OPEN',
  merged: 'MERGED',
  closed: 'CLOSED',
}

const MR_CI: Record<string, string> = {
  success: 'passing',
  failed: 'failing',
  canceled: 'failing',
  running: 'pending',
  pending: 'pending',
  created: 'pending',
  preparing: 'pending',
  waiting_for_resource: 'pending',
  scheduled: 'pending',
}

// The result of `glab mr view <branch> -F json`.
export function parseMr(result: {
  exitCode: number
  stdout: string
}): Pr | undefined {
  if (result.exitCode !== 0) return undefined
  try {
    const mr = JSON.parse(result.stdout)
    const state = MR_STATES[mr.state]
    if (!state) return undefined

    return {
      state,
      url: String(mr.web_url),
      ci: MR_CI[mr.head_pipeline?.status] ?? 'none',
      ...(typeof mr.iid === 'number' ? { number: mr.iid } : {}),
      kind: 'mr',
    }
  } catch {
    return undefined
  }
}

const TICKET_ID = /[A-Z][A-Z0-9]+-\d+/
const DANGLING = /^[\s—–\-:·]+|[\s—–\-:·]+$/g

// The ticket id a spec title holds, and the title without it, its brackets
// and the separator it leaves dangling.
export function ticketId(
  title: string | undefined,
  slug: string,
): { id?: string; name: string } {
  const id = title?.match(TICKET_ID)?.[0]
  if (title === undefined || title === '') return { name: slug }
  if (!id) return { name: title }
  const name = title
    .replace(id, ' ')
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(DANGLING, '')
    .replace(/\s{2,}/g, ' ')

  return { id, name: name || slug }
}

export type SectionId = 'toi' | 'running' | 'pr'

const SECTION_OF: Record<string, SectionId> = {
  'awaiting-answer': 'toi',
  'awaiting-plan-validation': 'toi',
  'no-session': 'toi',
  shipped: 'pr',
}

export function sectionOf(kind: string): SectionId {
  return SECTION_OF[kind] ?? 'running'
}

// The rows in sections, in the order they are drawn: what waits for the user,
// longest first, then what runs, then the pull requests.
export function sections<T extends { state: { kind: string }; since?: number }>(
  rows: T[],
): { id: SectionId; rows: T[]; count: number }[] {
  const ids: SectionId[] = ['toi', 'running', 'pr']

  return ids.map(id => {
    const own = rows.filter(row => sectionOf(row.state.kind) === id)
    if (id === 'toi') {
      own.sort((a, b) => (a.since ?? Infinity) - (b.since ?? Infinity))
    }

    return { id, rows: own, count: own.length }
  })
}

const STEPS: Record<string, number> = {
  ready: 2,
  red: 3,
  green: 4,
  reviewed: 5,
  shipped: 5,
}

// Where a ticket stands in plan, red, green, review, ship.
export function stepOf(status: string | undefined): number {
  return (status && STEPS[status]) || 1
}

// When the user's turn started: the pending question's, else the stopped
// session's last activity.
export function waitingSince(row: {
  state: State
  session?: Partial<Ticket['session'] & object>
}): number | undefined {
  if (sectionOf(row.state.kind) !== 'toi') return undefined
  if (row.state.at !== undefined) return row.state.at
  const last = Date.parse(row.session?.lastActivityAt ?? '')

  return Number.isNaN(last) ? undefined : last
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function elapsed(
  since: number,
  now: number,
): { n: number; unit: 'min' | 'h' | 'd' } {
  const ms = Math.max(0, now - since)
  if (ms >= DAY) return { n: Math.floor(ms / DAY), unit: 'd' }
  if (ms >= HOUR) return { n: Math.floor(ms / HOUR), unit: 'h' }

  return { n: Math.floor(ms / MINUTE), unit: 'min' }
}

// The review's rounds, its cap and what runs now: after a KO, the fix while
// one is missing, then the next round.
export function reviewLine(review: Review): {
  rounds: number
  cap: number
  running?: 'fix' | 'round'
} {
  const { rounds, cap, verdict, fixes } = review
  if (verdict !== 'KO') return { rounds, cap }

  return { rounds, cap, running: fixes < rounds ? 'fix' : 'round' }
}

const PLAN_SECTIONS = ['User story', 'Acceptance criteria']

// The user story then the acceptance criteria of a spec, headings included.
export function planSummary(text: string): string | undefined {
  const found: Record<string, string[]> = {}
  let current: string[] | undefined
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) {
      const name = line.slice(3).trim()
      current = PLAN_SECTIONS.includes(name) ? (found[name] = [line]) : undefined
    } else current?.push(line)
  }
  const parts = PLAN_SECTIONS.flatMap(name => {
    const lines = found[name]

    return lines ? [lines.join('\n').trim()] : []
  })

  return parts.length > 0 ? parts.join('\n\n') : undefined
}

// The tiles' numbers: what waits for the user, what is in review, the rest of
// what runs, the pull requests.
export function counters(
  rows: { section: SectionId; state: { kind: string } }[],
): { toi: number; review: number; dev: number; pr: number } {
  const inSection = (id: SectionId) => rows.filter(row => row.section === id)
  const running = inSection('running')
  const review = running.filter(row => row.state.kind === 'review').length

  return {
    toi: inSection('toi').length,
    review,
    dev: running.length - review,
    pr: inSection('pr').length,
  }
}

// What a spec says of its plan: its acceptance criteria and its files.
export function planFacts(text: string): { criteria: number; files: number } {
  let criteria = 0
  let files = 0
  let inFiles = false
  for (const line of text.split('\n')) {
    if (line.startsWith('#')) inFiles = /^###\s+Files\s*$/.test(line)
    else if (/^- \[[ x]\] AC\d+/.test(line)) criteria += 1
    else if (inFiles && line.startsWith('- ')) files += 1
  }

  return { criteria, files }
}

const SEGMENTS = ['plan', 'red', 'green', 'review', 'ship'] as const

// The five segments of a ticket's progress bar, from its step (1 to 5).
export function segments(
  step: number,
): { name: (typeof SEGMENTS)[number]; state: 'done' | 'current' | 'todo' }[] {
  return SEGMENTS.map((name, i) => ({
    name,
    state: i + 1 < step ? 'done' : i + 1 === step ? 'current' : 'todo',
  }))
}
