# rstack — development process

How a feature goes from a request to a merged pull request, solo or as a team, with several agents working on the same repo.

## Principles

- **Skills are the entry points.** You call them yourself. There is no conversational product owner in between.
- **One skill, one phase. The end of a skill is a gate.** Nothing moves on until you say so.
- **The spec is the contract.** Agents only see the spec file, never the conversation.
- **Agents only where isolation pays.** Single-pass work (planning, explaining) runs inside the skill. Work that needs a fresh context or its own guardrails (writing tests, implementing, reviewing) runs in agents.
- **TDD with frozen tests.** Tests are written red first, committed, then locked: the dev can't touch them.
- **Tests as low and as few as the criteria allow.** Each criterion at the lowest level that observes it, in one mode unless its result depends on the mode. The plan sets the level, the tester stays within it, the reviewer blocks what goes beyond.
- **Portable core, host adapters.** Everything that can be plain Markdown is. Host-specific power (hooks, mods, workflows) is layered on top.

## Flow

```
/rs-plan ──▶ ◆ you validate ──▶ /rs-build ──▶ ◆ you ship it ──▶ /rs-ship ──▶ ◆ you merge
                                    ▲               │
                                    └─ look first ──┘
```

| Skill | With you? | Does |
|---|---|---|
| `/rs-plan` | yes | clarifies the need, writes the spec (story, acceptance criteria, out of scope), designs the technical plan, checks the Definition of Ready. Ends on the first gate: your ok starts `/rs-build`. |
| `/rs-build` | no | started by your ok at the end of `/rs-plan`, or by hand to resume a stopped build. Builds in the current workspace: tester (red) → dev (green, refactor) → reviewer. KO on the code goes back to the same dev, 2 loops max; KO upstream (spec, plan, tests) stops and comes back to you. Its report ends on a question, in the chat: ship it? Your ok starts `/rs-ship`. A note or a blocking item to look at first → you settle it with the agent, in the chat, and the build applies your decision. |
| `/rs-ship` | no | started by your ok on `/rs-build`'s report, or by hand. Rebases on the default branch, runs the checks again, checks the Definition of Done, opens the pull request. The merge is yours. |
| `/rs-explain` | anytime | turns an explanation into a visual: vertical, airy, only what's needed. |

Three decisions, no more: the spec and its plan (your ok starts the build), the build's report (your ok ships it), the merge. The first two are a question at the end of a reply, answered in the chat, never through a question tool. A point you want to look at before shipping is settled with you in the chat, never handed straight to an agent; your decision then goes through the dev and a new reviewer, or through the spec when it changes a criterion, the plan or the tests, and the build ends on its report again.

**One feature, one workspace.** Workspaces are your harness's job (Claude Code, Superset, T3 Code…): it opens the worktree and sets it up. rstack never does. Open one per feature and run `/rs-plan` in it: your ok builds it there, your ok on the build's report ships it. That is how several features build side by side.

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

`.rs/` lives at the project root and stays out of git: rstack commits a feature's tests and code, nothing else. The first skill that writes there creates `.rs/.gitignore` containing `*`, which ignores the folder, itself included; the project's `.gitignore` is left alone.

```
.rs/
├── .gitignore            *
├── features/<slug>.md    spec + state, one file per feature
└── explain/              rendered visuals
```

The state is in the spec's frontmatter:

```yaml
status: ready        # draft → ready → red → green → reviewed → shipped
owner: Romain        # who planned it
branch: feat/<slug>  # set by /rs-build
red: a1b2c3d         # commit of the red tests, set by /rs-build, updated by /rs-ship after a rebase
```

| Status | Set by | Means |
|---|---|---|
| `draft` | `/rs-plan` | being written with you |
| `ready` | `/rs-plan` | you validated it, `/rs-build` starts |
| `red` | `/rs-build` | failing tests committed, now frozen |
| `green` | `/rs-build` | implementation passes them |
| `reviewed` | `/rs-build` | reviewer said OK, or you shipped over its KO |
| `shipped` | `/rs-ship` | pull request open (set just before the push) |

The spec also carries what one skill leaves for the next. `## Review notes`: the reviewer's "Worth noting", plus the blocking items you chose to ship anyway, written by `/rs-build`, put in the pull request by `/rs-ship`. `## Ship failures`: what failed after `/rs-ship` rebased, handed to the dev when `/rs-build` resumes.

**Where the spec lives.** In the feature's workspace, next to the code, and nowhere else: the skills and agents that run there share it through the file, not through git. So a feature is planned, built and shipped in the same workspace. The team gets what it needs from the pull request: `/rs-ship` writes the user story, the acceptance criteria and the review notes into it. Deleting the workspace, or a `git clean -x`, deletes the spec.

The reviewer's memory stays out of git too: `rs-reviewer` keeps it in `.claude/agent-memory-local/rs-reviewer/`, which `/rs-build` adds to `.git/info/exclude` (local to the clone, never committed). Like the spec, it lives in the workspace.

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
├── rs-ship/
└── rs-explain/
agents/            rs-tester, rs-dev, rs-reviewer (Claude Code format)
hooks/             guards used by the agents, installed in ~/.claude/hooks/rstack/
docs/
install.sh, uninstall.sh
```

## Install

rstack installs once per machine, at the Claude Code level, not per project. A project only holds what rstack produces (`.rs/`, out of git) and its own instructions (`AGENTS.md` / `CLAUDE.md`: test and lint commands, Definition of Done).

```sh
./install.sh     # copies skills, agents and hooks into ~/.claude
./uninstall.sh   # removes only what install.sh copied
```

Everything is a copy, not a link: an edit, a branch switch or a deleted worktree doesn't reach your projects, which keep the version you installed. Re-run `./install.sh` from the version you want to update: it replaces the copies and drops the skills and agents the repo no longer has. It never touches a file it didn't install; `~/.claude/.rstack-manifest` lists what it did. The guards need `jq`.

## Not now

Bug fixing (`/rs-fix`), retrospectives, project setup, the state mod, hosts other than Claude Code, `/rs-build` as a deterministic workflow: each in its own time.
