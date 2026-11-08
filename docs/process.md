# rstack — development process

How a feature goes from a request to a merged pull request, solo or as a team, with several agents working on the same repo.

## Principles

- **Skills are the entry points.** You call them yourself. There is no conversational product owner in between.
- **One skill, one phase. The end of a skill is a gate.** Nothing moves on until you say so.
- **The spec is the contract.** Agents only see the spec file, never the conversation.
- **Agents only where isolation pays.** Single-pass work (diagnosing, planning, explaining) runs inside the skill. Work that needs a fresh context or its own guardrails (writing tests, implementing, reviewing) runs in agents.
- **TDD with frozen tests.** Tests are written red first, committed, then locked: the dev can't touch them.
- **Shortest test time, every behaviour covered.** Every criterion, and every behaviour the feature's user can trigger (a visible result, a refusal, an error message, a change in stored state), has a test that observes it, through the cheapest tests that do it: the lowest level that observes the behaviour, one mode unless another runs code or gives a result the first doesn't, no test that checks again what another does. Defensive code may stay untested. The plan sets a ceiling, the tester stays under it, the reviewer sends back a behaviour no test observes or a test that breaks the project's written test rules, and the build loops on it without you.
- **A KO is a real problem.** The reviewer blocks only on a closed list: a changed test, a behaviour no test observes, a red suite, lint or typecheck, an unmet Definition of Done item, a test against the project's test rules, an unplanned dependency or file, and a bug the feature's user triggers with normal actions, with a consequence they'd feel. Everything else is a note in the pull request.
- **Portable core, host adapters.** Everything that can be plain Markdown is. Host-specific power (hooks, mods, workflows) is layered on top.

## Flow

When the cause of a problem, or the state of an area, isn't known yet, `/rs-diagnose` comes first:

```
/rs-diagnose ──▶ ◆ you read ──┬── plan it ──▶ /rs-plan
      ▲                       │
      └──── dig further ──────┘
```

Then, or straight away:

```
/rs-plan ──▶ ◆ you validate ──▶ /rs-build ── review OK ──▶ /rs-ship ──▶ ◆ you merge
                                  ▲    │                      ▲
                       look first │    │ stop                 │ ship anyway
                                  │    ▼                      │
                                  └── ◆ you decide ───────────┘
```

| Skill | With you? | Does |
|---|---|---|
| `/rs-diagnose` | at the start and the gate | investigates one subject before planning: a problem whose cause must be found, or an area whose state, risks and open questions must be laid out. Facts kept apart from hypotheses, every claim with its evidence and a confidence (proven, likely, unknown); temporary instrumentation on a throwaway branch, dropped after. Never fixes. Ends on a gate, in the chat: dig further, or plan it, which starts `/rs-plan` from the report. |
| `/rs-plan` | yes | clarifies the need, or starts from a diagnosis, writes the spec (story, acceptance criteria, out of scope), designs the technical plan, checks the Definition of Ready. Ends on the first gate: your ok starts `/rs-build`. |
| `/rs-build` | no | started by your ok at the end of `/rs-plan`, or by hand to resume a stopped build. Builds in the current workspace: tester (red) → dev (green, refactor) → rebase on the default branch → reviewer. KO on the code goes back to the same dev, KO on the tests to the tester, 3 fix rounds max, counted across runs (the project instructions may set another cap); fixes that don't converge, or KO upstream (a wrong or ambiguous criterion, a plan to rework), stop and come back to you. Review OK → `/rs-ship` starts, without asking. A stop on the review ends on a question, in the chat: look at it first, or ship anyway? You settle it with the agent, in the chat, and the build applies your decision. |
| `/rs-ship` | no | started by `/rs-build` once its review is OK, by your ok to ship over a review stop, or by hand. Rebases on the default branch, runs the checks again, checks the Definition of Done, opens the pull request. The merge is yours. |
| `/rs-explain` | anytime | turns an explanation into a visual: vertical, airy, only what's needed. |

Two decisions, no more: the spec and its plan (your ok starts the build), and the merge. Starting from `/rs-diagnose` adds one before them: its report, to dig further or plan it. The build comes back to you only on a stop: a red base, fix rounds at the cap or that don't converge, an upstream item. A stop on the review ends on a question at the end of the reply, answered in the chat, never through a question tool, like the plan's gate. A point you want to look at is settled with you in the chat, never handed straight to an agent; your decision then goes through the dev and a new reviewer, or through the spec when it changes a criterion, the plan or the tests, and the build ends on `/rs-ship` or a stop again.

**One feature, one workspace.** Workspaces are your harness's job (Claude Code, Superset, T3 Code…): it opens the worktree and sets it up. rstack never does. Open one per feature and run `/rs-plan` in it: your ok builds it there, an OK review ships it. That is how several features build side by side.

## Roles

| Role | Runs as | Why |
|---|---|---|
| architect | inside `/rs-plan` | single pass, works with you, nothing to isolate |
| tester | agent `rs-tester` | writes tests from the criteria without seeing an implementation; writes test files only, a hook blocks `.rs/checks` |
| dev | agent `rs-dev` | a hook blocks any edit to tests and to `.rs/checks` |
| reviewer | agent `rs-reviewer` | fresh eyes that didn't write the code; read-only by hook, runs only the checks of `.rs/checks` |

## Language

Skills talk to you in your language. Specs, agents and reports are written in English.

## Feature state — `.rs/`

`.rs/` lives at the project root and stays out of git: rstack commits a feature's tests and code, nothing else. The first skill that writes there creates `.rs/.gitignore` containing `*`, which ignores the folder, itself included; the project's `.gitignore` is left alone.

```
.rs/
├── .gitignore                   *
├── checks                       the reviewer's check-only commands, one per line (below)
├── features/<slug>.md           spec + state, one file per feature
├── features/<slug>.review.md    review history: one section per review round, fix round and decision
├── diagnoses/<slug>.md          diagnosis report, in the main checkout only (below)
├── diagnoses/<slug>.patch       the instrumentation a diagnosis ran, to apply again
└── explain/                     rendered visuals
```

The state is in the spec's frontmatter:

```yaml
status: ready        # draft → ready → red → green → reviewed → shipped
owner: Romain        # who planned it
branch: feat/<slug>  # set by /rs-build
red: a1b2c3d         # last commit of the tests, set by /rs-build, updated by /rs-ship after a rebase
```

| Status | Set by | Means |
|---|---|---|
| `draft` | `/rs-plan` | being written with you |
| `ready` | `/rs-plan` | you validated it, `/rs-build` starts |
| `red` | `/rs-build` | failing tests committed, now frozen |
| `green` | `/rs-build` | implementation passes them |
| `reviewed` | `/rs-build` | reviewer said OK, or you shipped over its KO |
| `shipped` | `/rs-ship` | pull request open (set just before the push) |

The spec also carries what one skill leaves for the next. `## Diagnosis`: the findings of a diagnosis the spec addresses, copied from the report by `/rs-plan`, their causes put in the pull request by `/rs-ship`. `## Review notes`: the "Worth noting" of every review round, plus the blocking items you chose to ship anyway, written by `/rs-build`, put in the pull request by `/rs-ship`. `## Ship failures`: what failed after `/rs-ship` rebased, handed to the dev when `/rs-build` resumes.

The review history, `<slug>.review.md`, is written by `/rs-build` and read by `rs-reviewer`. Round 1 is a full review; later rounds check only that the earlier blocking items are fixed and that the diff since the last reviewed commit adds none, and a note never turns blocking later. The fix-round count is read from it, so it holds across runs of `/rs-build`.

**The reviewer's checks — `.rs/checks`.** `rs-reviewer` runs the suite, lint and typecheck itself, and its hook knows no package manager or runner: each project declares its check-only commands, one per line. Blank lines and `#` comments are ignored. A line allows the command followed by any arguments, never another script: `npm test` allows `npm test -- auth`, not `npm test:update`. Besides these, the reviewer runs only read-only commands (`cd`, `ls`, `cat`, `grep`, `diff`, `find` without `-exec` or `-delete`, git's read subcommands). Always refused, even on a declared line: `--fix`, the options that write (`-u`, `--update*`, `--output*`, `-o`, `--init`), a redirection to a file, `$(…)`, backticks, `<(…)`. Lines starting with `!` are the project's refusals: a glob on the whole command, refused even when it starts with a declared line (`!*--write*` refuses any command with `--write`, `!bunx prettier --check . -w*` that one). They add to the hook's refusals, never lift one. No file → nothing but reading.

The file concerns the reviewer only: it is the only agent whose Bash is filtered, rs-dev and rs-tester keep theirs open. None of the three can write it (Edit and Write refused by hook). `/rs-build` writes it when it's missing, from the project instructions, with the refusals of the tools it knows (Prettier, Biome, RuboCop, pytest snapshots, Go golden files), shows it to you in the chat at every start, and stops if it changed before a review; edit it if a line is wrong.

```
# .rs/checks
bun run typecheck
bun run test
bunx turbo run typecheck test
bunx prettier --check .

# refusals
!*--write*
!*prettier* -w*
```

**Where the spec lives.** In the feature's workspace, next to the code, and nowhere else: the skills and agents that run there share it through the file, not through git. So a feature is planned, built and shipped in the same workspace. The team gets what it needs from the pull request: `/rs-ship` writes the user story, the acceptance criteria and the review notes into it. Deleting the workspace, or a `git clean -x`, deletes the spec.

**Where diagnoses live.** In `.rs/diagnoses/` of the clone's main checkout (the first worktree of `git worktree list`), not in the workspace: a diagnosis often outlives the feature that follows it, leads to several, or to none. Every workspace of the clone reads it there, and it stays out of git like the rest of `.rs/`: it stays on your machine, a teammate doesn't see it, and deleting the clone, or a `git clean -x` in the main checkout, deletes it. The team's trace is the pull request: the causes a feature fixes go in it through the spec.

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
├── rs-diagnose/
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
