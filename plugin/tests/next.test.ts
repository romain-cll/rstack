// The pure functions of plugin/hooks/next.ts (pilot-next). The contract these
// tests fix beyond the spec:
//
//   planeConfig(json text) -> { project: string } | undefined
//   candidates(items, relations, stateGroups, identifier) -> Candidate[]
//     items:       Plane work items as `workitem list` answers them
//                  ({ id, name, sequence_id, priority, state: { group },
//                  is_draft, updated_at, description_stripped, type_id })
//     relations:   work item id -> { blocking: Rel[], blocked_by: Rel[] } (the
//                  content of `workitem_relation list`'s `dependencies`;
//                  Rel = { id, sequence_id, project_id, state_id })
//     stateGroups: state id -> state group
//     identifier:  the project identifier (`SPOTIME`): ids are `<identifier>-<sequence_id>`
//     Candidate:   { id, name, workitemId, updatedAt, priority, sequenceId,
//                    description, unblocks: string[] }
//                  (unblocks: ids of the open items it blocks)
//   rankNext(candidates, excluded: Set<string>, limit = 5) -> Candidate[]
//     excluded: upper-case ids
//   excludedIds(tickets, worktreePaths, sessionsJson, launched: Set<string>) -> Set<string>
//     tickets: [{ title? }] (what listTickets gives); sessionsJson: the JSON
//     text `list_sessions` answers ([{ title, isArchived }]); upper-case ids out
//   startArgs(row, description) -> the input of `start_session`, `tool` aside
//   readOrder(items, excluded, identifier) -> the startable items not excluded,
//     by priority then sequence: the order their relations are read in
//   isBlocked(relations, stateGroups) -> whether an open item blocks it
//
// Not covered, and why: "not an epic" in AC2 (see the report).
import { expect, test } from 'claude-code/testing'

import {
  candidates,
  excludedIds,
  isBlocked,
  planeConfig,
  readOrder,
  rankNext,
  startArgs,
} from '../hooks/next'

const GROUPS: Record<string, string> = {
  's-backlog': 'backlog',
  's-unstarted': 'unstarted',
  's-started': 'started',
  's-done': 'completed',
  's-cancel': 'cancelled',
}

const item = (seq: number, over: Record<string, unknown> = {}) => ({
  id: `w${seq}`,
  name: `Item ${seq}`,
  sequence_id: seq,
  priority: 'none',
  state: { group: 'unstarted' },
  is_draft: false,
  updated_at: '2026-11-20T10:00:00Z',
  description_stripped: `Description ${seq}`,
  type_id: null,
  ...over,
})
const rel = (seq: number, state_id: string) => ({
  id: `w${seq}`,
  sequence_id: seq,
  project_id: 'p1',
  state_id,
})
const free = { blocking: [], blocked_by: [] }

test('AC1 — planeConfig gives the project of a config, nothing when it holds none', () => {
  expect(planeConfig('{ "plane": { "project": "SPOTIME" } }')).toEqual({
    project: 'SPOTIME',
  })
  expect(planeConfig('{}')).toBeUndefined()
  expect(planeConfig('{ "plane": {} }')).toBeUndefined()
  expect(planeConfig('{ "plane": { "project": "" } }')).toBeUndefined()
  expect(planeConfig('not json')).toBeUndefined()
})

test('AC2 — a candidate is a backlog or unstarted item, not a draft, with every blocker completed or cancelled', () => {
  const items = [
    item(1, { state: { group: 'backlog' } }),
    item(2),
    item(3, { state: { group: 'started' } }),
    item(4, { state: { group: 'completed' } }),
    item(5, { state: { group: 'cancelled' } }),
    item(6, { is_draft: true }),
    item(7), // blocked by an open item
    item(8), // blocked by a completed item
    item(9), // blocked by a cancelled item
    item(10), // one blocker done, one still open
    item(11), // blocked by a backlog item
  ]
  const relations = {
    w7: { blocking: [], blocked_by: [rel(2, 's-started')] },
    w8: { blocking: [], blocked_by: [rel(4, 's-done')] },
    w9: { blocking: [], blocked_by: [rel(5, 's-cancel')] },
    w10: { blocking: [], blocked_by: [rel(4, 's-done'), rel(3, 's-started')] },
    w11: { blocking: [], blocked_by: [rel(1, 's-backlog')] },
  }
  const found = candidates(
    items,
    Object.fromEntries(items.map(i => [i.id, (relations as any)[i.id] ?? free])),
    GROUPS,
    'SPOTIME',
  )

  expect(found.map(c => c.id).sort()).toEqual([
    'SPOTIME-1',
    'SPOTIME-2',
    'SPOTIME-8',
    'SPOTIME-9',
  ])
})

test('AC3 — a candidate lists the ids of the open items it blocks, not the done ones', () => {
  const items = [item(1), item(2), item(3), item(4)]
  const relations = {
    w1: {
      blocking: [rel(2, 's-unstarted'), rel(3, 's-done'), rel(4, 's-cancel')],
      blocked_by: [],
    },
    w2: { blocking: [], blocked_by: [rel(1, 's-unstarted')] },
    w3: { blocking: [], blocked_by: [rel(1, 's-unstarted')] },
    w4: { blocking: [], blocked_by: [rel(1, 's-unstarted')] },
  }
  const found = candidates(items, relations, GROUPS, 'SPOTIME')

  expect(found.find(c => c.id === 'SPOTIME-1')?.unblocks).toEqual(['SPOTIME-2'])
})

const cand = (seq: number, priority: string, unblocks: number[] = []) => ({
  id: `SPOTIME-${seq}`,
  name: `Item ${seq}`,
  workitemId: `w${seq}`,
  updatedAt: '2026-11-20T10:00:00Z',
  priority,
  sequenceId: seq,
  description: `Description ${seq}`,
  unblocks: unblocks.map(n => `SPOTIME-${n}`),
})

test('AC3 — 5 rows by priority, then by open items blocked descending, then by sequence ascending', () => {
  const pool = [
    cand(21, 'none', [1, 2, 3, 4, 5]),
    cand(12, 'high', [1, 2, 3]),
    cand(30, 'medium', [1, 2, 3, 4]),
    cand(11, 'high', [1, 2]),
    cand(20, 'medium'),
    cand(10, 'urgent'),
    cand(22, 'low', [1]),
    cand(5, 'high', [1, 2, 3]),
  ]

  const rows = rankNext(pool, new Set())

  expect(rows.map(r => r.id)).toEqual([
    'SPOTIME-10',
    'SPOTIME-5',
    'SPOTIME-12',
    'SPOTIME-11',
    'SPOTIME-30',
  ])
  expect(rows[1]).toMatchObject({
    id: 'SPOTIME-5',
    name: 'Item 5',
    unblocks: ['SPOTIME-1', 'SPOTIME-2', 'SPOTIME-3'],
  })
  expect(rows[0]?.unblocks).toEqual([])
})

test('AC4 — an id in a spec title, a worktree path, a non-archived session title or the launched set leaves the candidate out and the next one comes up', () => {
  const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => cand(n, 'none'))
  const excluded = excludedIds(
    [{ title: 'Fix the login (SPOTIME-1)' }, { title: undefined }],
    ['/work/main', '/work/spotime-2-billing'],
    JSON.stringify([
      { sessionId: 's1', title: 'SPOTIME-3 — Export', isArchived: false },
      { sessionId: 's2', title: 'SPOTIME-4 — Archived', isArchived: true },
    ]),
    new Set(['SPOTIME-5']),
  )

  const rows = rankNext(pool, excluded)

  expect(rows.map(r => r.id)).toEqual([
    'SPOTIME-4',
    'SPOTIME-6',
    'SPOTIME-7',
    'SPOTIME-8',
    'SPOTIME-9',
  ])
})

test('AC4 — the id is matched whatever its case', () => {
  const excluded = excludedIds(
    [{ title: 'spotime-1 — lower' }],
    [],
    '[]',
    new Set(),
  )

  expect(rankNext([cand(1, 'none'), cand(2, 'none')], excluded).map(r => r.id)).toEqual([
    'SPOTIME-2',
  ])
})

test('AC6 — the start arguments: a fresh worktree session on the lowercased id, running /rs-plan with the description', () => {
  const row = {
    id: 'SPOTIME-42',
    name: 'Export the planning',
    unblocks: [],
    workitemId: 'w42',
    updatedAt: '2026-11-20T10:00:00Z',
  }

  const args = startArgs(row, 'Plain text of the ticket.')

  expect(args).toMatchObject({
    initiation: 'user_asked',
    context: 'fresh',
    use_worktree: true,
    branch_name: 'spotime-42',
    title: 'SPOTIME-42 — Export the planning',
  })
  expect(args.prompt.startsWith('/rs-plan SPOTIME-42 — Export the planning')).toBe(true)
  expect(args.prompt).toContain('Plain text of the ticket.')
  expect(args.background.length).toBeGreaterThanOrEqual(80)
})

test('lazy relations — readOrder keeps the startable items not excluded, by priority then sequence', () => {
  const items = [
    item(1),
    item(2, { priority: 'low' }),
    item(3, { priority: 'urgent' }),
    item(4, { state: { group: 'started' } }),
    item(5, { is_draft: true }),
    item(6, { priority: 'high', state: { group: 'backlog' } }),
    item(7, { priority: 'high' }),
    item(8, { priority: 'urgent' }),
    item(9, { priority: null }),
  ]

  const order = readOrder(items, new Set(['SPOTIME-8']), 'SPOTIME')

  expect(order.map(i => i.sequence_id)).toEqual([3, 6, 7, 2, 1, 9])
})

test('lazy relations — isBlocked is true while one blocker is open, false once all are done or cancelled', () => {
  expect(isBlocked(free, GROUPS)).toBe(false)
  expect(isBlocked({ blocking: [rel(2, 's-unstarted')], blocked_by: [] }, GROUPS)).toBe(false)
  expect(isBlocked({ blocking: [], blocked_by: [rel(4, 's-done'), rel(5, 's-cancel')] }, GROUPS)).toBe(false)
  expect(isBlocked({ blocking: [], blocked_by: [rel(4, 's-done'), rel(1, 's-backlog')] }, GROUPS)).toBe(true)
})
