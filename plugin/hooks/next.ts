// The next tickets to launch, from the Plane answers: which work items are
// free to start, in which order, and what to start a session with. Pure: the
// reads are in collect.ts, the cadence and the pane in register.tsx.
import type { PilotNext } from '../types'

export type Rel = { id: string; sequence_id: number; project_id?: string; state_id: string }
export type Relations = { blocking: Rel[]; blocked_by: Rel[] }

// A work item as `workitem list` answers it, what the pilot reads of it.
export type PlaneItem = {
  id: string
  name: string
  sequence_id: number
  priority?: string | null
  state?: { group?: string }
  is_draft?: boolean
  updated_at: string
  description_stripped?: string | null
}

export type Candidate = {
  id: string
  name: string
  workitemId: string
  updatedAt: string
  priority: string
  sequenceId: number
  description: string
  unblocks: string[]
}

export const LIMIT = 5
const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none']
const DONE = ['completed', 'cancelled']
const STARTABLE = ['backlog', 'unstarted']
const TICKET_ID = /[A-Za-z][A-Za-z0-9]*-\d+/g

export function planeConfig(json: string): { project: string } | undefined {
  try {
    const project = (JSON.parse(json) as { plane?: { project?: unknown } })?.plane?.project

    return typeof project === 'string' && project !== '' ? { project } : undefined
  } catch {
    return undefined
  }
}

const isOpen = (rel: Rel, groups: Record<string, string>) =>
  !DONE.includes(groups[rel.state_id] ?? '')

const isStartable = (item: PlaneItem) =>
  STARTABLE.includes(item.state?.group ?? '') && item.is_draft !== true

export const isBlocked = (relations: Relations, stateGroups: Record<string, string>) =>
  relations.blocked_by.some(rel => isOpen(rel, stateGroups))

// The startable items not at work, in the order their relations are read:
// Plane gives an item's relations one call at a time, so the pane reads them
// by priority and stops once it has enough free items.
export function readOrder(
  items: PlaneItem[],
  excluded: Set<string>,
  identifier: string,
): PlaneItem[] {
  return items
    .filter(item => isStartable(item) && !excluded.has(`${identifier}-${item.sequence_id}`.toUpperCase()))
    .sort(
      (a, b) =>
        rankOf(a.priority ?? 'none') - rankOf(b.priority ?? 'none') ||
        a.sequence_id - b.sequence_id,
    )
}

export function candidates(
  items: PlaneItem[],
  relations: Record<string, Relations>,
  stateGroups: Record<string, string>,
  identifier: string,
): Candidate[] {
  const found: Candidate[] = []
  for (const item of items) {
    if (!isStartable(item)) continue
    const { blocking = [], blocked_by = [] } = relations[item.id] ?? {}
    if (isBlocked({ blocking, blocked_by }, stateGroups)) continue
    found.push({
      id: `${identifier}-${item.sequence_id}`,
      name: item.name,
      workitemId: item.id,
      updatedAt: item.updated_at,
      priority: item.priority ?? 'none',
      sequenceId: item.sequence_id,
      description: item.description_stripped ?? '',
      unblocks: blocking
        .filter(rel => isOpen(rel, stateGroups))
        .map(rel => `${identifier}-${rel.sequence_id}`),
    })
  }

  return found
}

const rankOf = (priority: string) => {
  const rank = PRIORITIES.indexOf(priority)

  return rank === -1 ? PRIORITIES.length - 1 : rank
}

export function rankNext(
  pool: Candidate[],
  excluded: Set<string>,
  limit = LIMIT,
): Candidate[] {
  return pool
    .filter(c => !excluded.has(c.id.toUpperCase()))
    .sort(
      (a, b) =>
        rankOf(a.priority) - rankOf(b.priority) ||
        b.unblocks.length - a.unblocks.length ||
        a.sequenceId - b.sequenceId,
    )
    .slice(0, limit)
}

// The ids already at work: in a spec title, a worktree path, the title of a
// session not archived, or launched from the pane.
export function excludedIds(
  tickets: { title?: string }[],
  worktreePaths: string[],
  sessionsJson: string,
  launched: Set<string>,
): Set<string> {
  const texts = [...tickets.map(t => t.title ?? ''), ...worktreePaths]
  try {
    const sessions = JSON.parse(sessionsJson) as { title?: string; isArchived?: boolean }[]
    for (const session of sessions) {
      if (session.isArchived !== true) texts.push(session.title ?? '')
    }
  } catch {
    // no sessions known
  }
  const ids = new Set([...launched].map(id => id.toUpperCase()))
  for (const text of texts) {
    for (const id of text.match(TICKET_ID) ?? []) ids.add(id.toUpperCase())
  }

  return ids
}

export function startArgs(row: PilotNext, description: string) {
  const title = `${row.id} — ${row.name}`

  return {
    initiation: 'user_asked',
    context: 'fresh',
    use_worktree: true,
    branch_name: row.id.toLowerCase(),
    title,
    prompt: `/rs-plan ${title}\n\n${description}`,
    background:
      `Plane ticket ${row.id}, launched from the rstack pilot pane: run /rs-plan on it ` +
      `to turn it into a spec, then wait for the user to validate the plan.`,
  }
}

export const summaryKey = (id: string, updatedAt: string) => `summary:${id}:${updatedAt}`

export const summaryPrompt = (name: string, description: string) =>
  `Summarize this ticket in one short line of French, plain text, no quotes and no prefix.\n\n` +
  `Title: ${name}\n\n${description}`
