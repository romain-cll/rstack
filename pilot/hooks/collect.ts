// The reads of the pilot: git, the features folders, the app's sessions, the
// questions the sessions publish, gh or glab. Their parsing is in tickets.ts.
import type { EngineInterface } from 'claude-code'

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
