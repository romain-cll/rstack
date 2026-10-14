# rstack — development process

How a feature goes from a request to a merged pull request, solo or as a team, with several agents working on the same repo.

## Principles

- **Skills are the entry points.** You call them yourself. There is no conversational product owner in between.
- **One skill, one phase. The end of a skill is a gate.** Nothing moves on until you say so.
- **The spec is the contract.** Agents only see the spec file, never the conversation.
- **Agents only where isolation pays.** Single-pass work (planning, explaining) runs inside the skill. Work that needs a fresh context or its own guardrails (writing tests, implementing, reviewing) runs in agents.
- **TDD with frozen tests.** Tests are written red first, committed, then locked: the dev can't touch them.
- **Portable core, host adapters.** Everything that can be plain Markdown is. Host-specific power (hooks, mods, workflows) is layered on top.

## Flow

```
/rs-plan ──▶ ◆ you validate ──▶ /rs-build ──▶ /rs-ship ──▶ ◆ you merge
```

| Skill | With you? | Does |
|---|---|---|
| `/rs-plan` | yes | clarifies the need, writes the spec (story, acceptance criteria, out of scope), designs the technical plan, checks the Definition of Ready. Ends on the first gate. |
| `/rs-build` | no | builds in the current workspace: tester (red) → dev (green, refactor) → reviewer. KO on the code goes back to the same dev, 2 loops max; KO upstream (spec, plan, tests) stops and comes back to you. |
| `/rs-ship` | no | checks the Definition of Done, opens the pull request. The merge is yours. |
| `/rs-explain` | anytime | turns an explanation into a visual: vertical, airy, only what's needed. |

Two gates, no more: validating the spec and the plan is one decision, merging is the other.

**One feature, one workspace.** Workspaces are your harness's job (Claude Code, Superset, T3 Code…): it opens the worktree and sets it up. rstack never does. Open one per feature, then run `/rs-plan` and `/rs-build` in it: that is how several features build side by side.

## Roles

| Role | Runs as | Why |
|---|---|---|
| architect | inside `/rs-plan` | single pass, works with you, nothing to isolate |
| tester | agent `rs-tester` | writes tests from the criteria without seeing an implementation; writes test files only |
| dev | agent `rs-dev` | a hook blocks any edit to tests |
| reviewer | agent `rs-reviewer` | fresh eyes that didn't write the code; read-only by hook |

## Language

Skills talk to you in your language. Specs, agents and reports are written in English.

## Feature state — `.rs/`

`.rs/` lives at the project root and is versioned: it is how a team sees who is building what.

```
.rs/
├── features/<slug>.md    spec + state, one file per feature
└── explain/              rendered visuals (git-ignored)
```

The state is in the spec's frontmatter:

```yaml
status: ready        # draft → ready → red → green → reviewed → shipped
owner: Romain        # who planned it
branch: feat/<slug>  # set by /rs-build
red: a1b2c3d         # commit of the red tests, set by /rs-build
```

| Status | Set by | Means |
|---|---|---|
| `draft` | `/rs-plan` | being written with you |
| `ready` | `/rs-plan` | you validated it |
| `red` | `/rs-build` | failing tests committed, now frozen |
| `green` | `/rs-build` | implementation passes them |
| `reviewed` | `/rs-build` | reviewer said OK |
| `shipped` | `/rs-ship` | pull request open |

**Where the spec lives over time.** `/rs-plan` writes it in the feature's workspace without committing. `/rs-build` commits it first, on the workspace's branch (`feat/<slug>` if it starts from the default branch). From then on the spec travels with its branch and reaches the main branch with the feature's pull request. Until `/rs-build` runs, a `ready` spec is an untracked file: invisible to the team, and wiped by `git clean`.

## Portability

Supported host today: Claude Code. OpenCode, Hermes and Codex come later, one at a time, each with full support (skills, agents, guards), not just its skills.

- **Portable core**: `skills/*/SKILL.md` follow the open Agent Skills format; role prompts are plain Markdown.
- **Claude Code adapter**: agent frontmatter (model, tools, per-role hooks), guardrail hooks, a mod that shows the state of every feature in flight.
- **Hosts without subagents**: the skill plays the roles one after the other. Guardrails then become instructions only: weaker, still usable.

OpenCode already reads `~/.claude/skills`: once rstack is installed, it sees the skills without the agents and guards. That is not supported; `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS=1` turns it off.

## Repository layout

```
skills/
├── rs-plan/
├── rs-build/
├── rs-ship/       (next)
└── rs-explain/
agents/            rs-tester, rs-dev, rs-reviewer (Claude Code format)
hooks/             guards used by the agents, installed in ~/.claude/hooks/rstack/
docs/
install.sh, uninstall.sh
```

## Install

rstack installs once per machine, at the Claude Code level, not per project. A project only holds what rstack produces (`.rs/`) and its own instructions (`AGENTS.md` / `CLAUDE.md`: test and lint commands, Definition of Done).

```sh
./install.sh     # links skills, agents and hooks into ~/.claude
./uninstall.sh   # removes only the links pointing to this repo
```

Everything is a symlink to the repo, so an edit or a `git pull` is live everywhere. Re-run `./install.sh` when a skill or an agent is added, renamed or removed: it links the new ones and drops the stale ones. It never overwrites an existing file. The guards need `jq`.

## Not now

Bug fixing (`/rs-fix`), retrospectives, project setup, the state mod, hosts other than Claude Code, `/rs-build` as a deterministic workflow: each in its own time.
