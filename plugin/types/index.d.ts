export type PilotSession = {
  sessionId: string
  isRunning: boolean
  link: string
  lastActivityAt?: string
  isPilot?: boolean
}

// One worktree's spec (or its bare session), as the reads find it.
export type PilotTicket = {
  worktree: string
  slug?: string
  title?: string
  status?: string
  branch?: string
  red?: string
  session?: PilotSession
}

export type PilotReview = {
  rounds: number
  verdict: string
  fixes: number
  cap: number
}

// What a ticket session publishes while its AskUserQuestion is pending.
export type PilotQuestion = {
  sessionId?: string
  question: string
  at: number
}

export type PilotState = {
  kind: string
  question?: string
  at?: number
  status?: string
  rounds?: number
  verdict?: string
  fixes?: number
  cap?: number
}

// `kind` is 'mr' for a GitLab merge request, absent for a GitHub pull request.
export type PilotPr = {
  state: string
  url: string
  ci: string
  number?: number
  kind?: 'mr'
}

// A ticket as the pane draws it.
export type PilotRow = PilotTicket & {
  id?: string
  name: string
  section: 'toi' | 'running' | 'pr'
  step: number
  since?: number
  facts?: { criteria: number; files: number }
  state: PilotState
  review?: PilotReview
  pr?: PilotPr
}

declare module 'claude-code' {
  interface PluginState {
    rstack: { tickets: PilotRow[]; main?: string; polledAt?: number }
  }
}
