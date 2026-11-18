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

function sessionOf(worktree: string, sessions: Record<string, unknown>[]) {
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

  return worktreePaths(input.worktrees).flatMap((worktree): Ticket[] => {
    const session = sessionOf(worktree, sessions)
    const files = input.files[worktree] ?? {}
    const specs = Object.keys(files)
      .filter(name => name.endsWith('.md') && !name.endsWith('.review.md'))
      .sort()
    if (specs.length === 0) return session ? [{ worktree, session }] : []

    return specs.map(name => {
      const text = files[name] ?? ''
      const meta = frontmatter(text)

      return {
        worktree,
        slug: name.slice(0, -'.md'.length),
        title: title(text),
        status: meta.status,
        branch: meta.branch,
        red: meta.red,
        session,
      }
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
    .filter(q => q.cwd === ticket.worktree)
    .sort((a, b) => b.at - a.at)[0]

  if (asked && session?.isRunning) {
    return { kind: 'awaiting-answer', question: asked.question }
  }
  if (!session) return { kind: 'no-session' }
  if (status === 'shipped') return { kind: 'shipped' }
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

    return { state: pr.state, url: String(pr.url), ci }
  } catch {
    return undefined
  }
}
