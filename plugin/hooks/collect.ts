// The reads of the pilot: git, the features folders, the app's sessions, the
// questions the sessions publish, gh or glab. Their parsing is in tickets.ts.
import type { EngineInterface } from 'claude-code'

import { planeConfig } from './next'
import type { PlaneItem, Relations } from './next'
import { forgeOf, parseMr, parsePr } from './tickets'
import type { Pr, Question } from './tickets'

type Engine = EngineInterface

export const LIST_SESSIONS = 'mcp__ccd_session_mgmt__list_sessions'
export const GET_SESSION = 'mcp__ccd_session_mgmt__get_session'
export const QUESTION_PREFIX = 'question:'

export async function readWorktrees($: Engine): Promise<string> {
  const git = await $.process.run(['git', 'worktree', 'list', '--porcelain'])

  return git.exitCode === 0 ? git.stdout : ''
}

// `.rstack/features/`, or `.rs/features/` when `.rstack/` is absent.
async function readFeatures(
  $: Engine,
  worktree: string,
): Promise<Record<string, string>> {
  const root = (await $.fs.exists(`${worktree}/.rstack`)) ? '.rstack' : '.rs'
  const dir = `${worktree}/${root}/features`
  const files: Record<string, string> = {}
  const entries = await $.fs.list(dir).catch(() => [])
  for (const entry of entries) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.md')) continue
    const text = await $.fs.read(`${dir}/${entry.name}`)
    if (typeof text === 'string') files[entry.name] = text
  }

  return files
}

export async function readFiles(
  $: Engine,
  worktrees: string[],
): Promise<Record<string, Record<string, string>>> {
  const files: Record<string, Record<string, string>> = {}
  for (const worktree of worktrees) files[worktree] = await readFeatures($, worktree)

  return files
}

export async function readSessions($: Engine): Promise<string> {
  const listed = await $.tool.call({ tool: LIST_SESSIONS, limit: 100 })

  return listed.deny === undefined && listed.isError !== true
    ? (listed.text ?? '[]')
    : '[]'
}

// `list_sessions` leaves out the calling session: the pilot reads its own.
export async function readSelf($: Engine): Promise<string | undefined> {
  const own = await $.tool
    .call({ tool: GET_SESSION, session_id: 'self' })
    .catch(() => undefined)

  return own && own.deny === undefined && own.isError !== true ? own.text : undefined
}

export async function readQuestions($: Engine): Promise<Question[]> {
  const questions: Question[] = []
  for (const key of await $.store.keys()) {
    if (!key.startsWith(QUESTION_PREFIX)) continue
    const value = (await $.store.get(key)) as Question | undefined
    if (value) questions.push(value)
  }

  return questions
}

const FAILED_READ = { exitCode: 1, stdout: '' }

// The pull request or merge request of a branch, read with the tool of the
// forge the worktree's `origin` is on, and the parser of its answer.
export async function readPr(
  $: Engine,
  worktree: string,
  branch: string,
): Promise<{
  result: { exitCode: number; stdout: string }
  parse: (result: { exitCode: number; stdout: string }) => Pr | undefined
}> {
  const origin = await $.process
    .run(['git', 'remote', 'get-url', 'origin'], { cwd: worktree })
    .catch(() => FAILED_READ)
  const gitlab = origin.exitCode === 0 && forgeOf(origin.stdout) === 'gitlab'
  const argv = gitlab
    ? ['glab', 'mr', 'view', branch, '-F', 'json']
    : ['gh', 'pr', 'view', branch, '--json', 'state,url,statusCheckRollup,number']
  const result = await $.process.run(argv, { cwd: worktree }).catch(() => FAILED_READ)

  return { result, parse: gitlab ? parseMr : parsePr }
}

const PLANE = {
  project: 'mcp__plane__project',
  state: 'mcp__plane__state',
  items: 'mcp__plane__workitem',
  relations: 'mcp__plane__workitem_relation',
}
// Open items, epics left out: Plane marks an epic by its type, which a work
// item read does not flag.
const OPEN_ITEMS = 'stateGroup IN ("backlog", "unstarted") AND NOT isEpic()'

// `.rstack/pilot.json`, or `.rs/pilot.json` when `.rstack/` is absent, in the
// main checkout. Undefined when there is none or it names no Plane project.
export async function readPlaneConfig(
  $: Engine,
  main: string,
): Promise<{ project: string } | undefined> {
  try {
    const root = (await $.fs.exists(`${main}/.rstack`)) ? '.rstack' : '.rs'
    const text = await $.fs.read(`${main}/${root}/pilot.json`)

    return typeof text === 'string' ? planeConfig(text) : undefined
  } catch {
    return undefined
  }
}

// One Plane read, its JSON answer; undefined when denied, errored or unparsable.
// Plane wraps a list answer in `result` (`{ result: { results, ... } }`) and
// answers relations bare: the wrapper is taken off when there is one.
async function planeRead(
  $: Engine,
  input: Record<string, unknown>,
): Promise<Record<string, any> | undefined> {
  try {
    const answer = await $.tool.call({ ...input, action: 'list' } as never)
    if (answer.deny !== undefined || answer.isError === true) return undefined
    const parsed = JSON.parse(answer.text ?? '')
    const body =
      parsed && typeof parsed.result === 'object' && parsed.result !== null
        ? parsed.result
        : parsed

    return body && typeof body === 'object' ? body : undefined
  } catch {
    return undefined
  }
}

// Every page of a list read.
async function planePages(
  $: Engine,
  input: Record<string, unknown>,
): Promise<any[] | undefined> {
  const results: any[] = []
  let cursor: string | undefined
  do {
    const page = await planeRead($, cursor ? { ...input, cursor } : input)
    if (!page || !Array.isArray(page.results)) return undefined
    results.push(...page.results)
    cursor = page.next_page_results === true ? page.next_cursor : undefined
  } while (cursor)

  return results
}

export async function readProject($: Engine, identifier: string): Promise<string | undefined> {
  const projects = await planePages($, { tool: PLANE.project })

  return projects?.find(p => p.identifier === identifier)?.id
}

// State id -> state group.
export async function readStates(
  $: Engine,
  project: string,
): Promise<Record<string, string> | undefined> {
  const states = await planePages($, { tool: PLANE.state, project_id: project })

  return states && Object.fromEntries(states.map(s => [s.id, s.group]))
}

export async function readWorkItems(
  $: Engine,
  project: string,
): Promise<PlaneItem[] | undefined> {
  return planePages($, {
    tool: PLANE.items,
    project_id: project,
    pql: OPEN_ITEMS,
    expand: 'state',
  })
}

export async function readRelations(
  $: Engine,
  project: string,
  workitem: string,
): Promise<Relations | undefined> {
  const body = await planeRead($, {
    tool: PLANE.relations,
    project_id: project,
    workitem_id: workitem,
  })
  const { blocking, blocked_by } = body?.dependencies ?? {}

  return Array.isArray(blocking) && Array.isArray(blocked_by)
    ? { blocking, blocked_by }
    : undefined
}
