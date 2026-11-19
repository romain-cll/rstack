# rstack — development process

How a feature goes from a request to a merged pull request, solo or as a team, with several agents working on the same repo.

## Principles

- **Skills are the entry points.** You call them yourself. There is no conversational product owner in between.
- **One skill, one phase. The end of a skill is a gate.** Nothing moves on until you say so.
- **The spec is the contract.** Agents only see the spec file, never the conversation.
- **Agents only where isolation pays.** Single-pass work (diagnosing, planning, explaining) runs inside the skill. Work that needs a fresh context or its own guardrails (writing tests, implementing, reviewing) runs in agents.
- **TDD with frozen tests.** Tests are written red first, committed, then frozen: git checks them after each phase. After every run of the dev, `/rs-build` compares the red files with the red commit; the reviewer checks them again.
- **Shortest test time, every behaviour covered.** Every criterion, and every behaviour the feature's user can trigger (the result of a rule or a calculation, a refusal, an error path taken, a change in stored state — never what the UI shows of it), has a test that observes it, through the cheapest tests that do it: the lowest level that observes the behaviour, one mode unless another runs code or gives a result the first doesn't, no test that checks again what another does. Defensive code may stay untested, and so does rendering: a test observes logic, never what the UI shows of it — not a prop displayed, a layout, a wording, a class, a token, a colour, and never a presentational component such as a table or a card. Checking the UI is the dev's job, in the running application. A ticket with no logic at all therefore has no criterion and no test, and `/rs-build` runs it without a red phase. The plan sets a ceiling, the tester stays under it, the reviewer sends back a behaviour no test observes or a test that breaks the project's written test rules, and the build loops on it without you.
- **A KO is a real problem.** The reviewer blocks only on a closed list: a changed test, a behaviour no test observes, a red suite, lint or typecheck, an unmet Definition of Done item, a test against the project's test rules, an unplanned dependency or file, and a bug the feature's user triggers with normal actions, with a consequence they'd feel. Everything else is a note in the pull request.
- **One plugin.** Skills, agents, hooks and the pilot pane ship together in the Claude Code plugin `rstack`. The agents inherit the session's tools, MCP servers included, and no hook decides in advance what they may run: git catches their overreach after each phase.

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
| `/rs-build` | no | started by your ok at the end of `/rs-plan`, or by hand to resume a stopped build. Builds in the current workspace: tester (red) → dev (green, refactor) → rebase on the default branch → reviewer. KO on the code goes back to the same dev, KO on the tests to the tester, and so does a red test the dev reports it can't make pass; 3 fix rounds max, counted across runs (the project instructions may set another cap); fixes that don't converge, or KO upstream (a wrong or ambiguous criterion, a plan to rework), stop and come back to you. Review OK → `/rs-ship` starts, without asking. A stop on the review ends on a question, in the chat: look at it first, or ship anyway? You settle it with the agent, in the chat, and the build applies your decision. |
| `/rs-ship` | no | started by `/rs-build` once its review is OK, by your ok to ship over a review stop, or by hand. Rebases on the default branch, runs the checks again, checks the Definition of Done, opens the pull request. The merge is yours. |
| `/rs-explain` | anytime | turns an explanation into a visual: vertical, airy, only what's needed. |

Two decisions, no more: the spec and its plan (your ok starts the build), and the merge. Starting from `/rs-diagnose` adds one before them: its report, to dig further or plan it. The build comes back to you only on a stop: a red base, fix rounds at the cap or that don't converge, an upstream item. A stop on the review ends on a question at the end of the reply, answered in the chat, never through a question tool, like the plan's gate. A point you want to look at is settled with you in the chat, never handed straight to an agent; your decision then goes through the dev and a new reviewer, or through the spec when it changes a criterion, the plan or the tests, and the build ends on `/rs-ship` or a stop again.

**One feature, one workspace.** Workspaces are your harness's job (Claude Code, Superset, T3 Code…): it opens the worktree and sets it up. rstack never does. Open one per feature and run `/rs-plan` in it: your ok builds it there, an OK review ships it. That is how several features build side by side.

## Roles

| Role | Runs as | Why |
|---|---|---|
| architect | inside `/rs-plan` | single pass, works with you, nothing to isolate |
| tester | agent `rs-tester` | writes tests from the criteria without seeing an implementation; writes test files only; the build checks it with git |
| dev | agent `rs-dev` | after each run, the build compares the red files with git; a changed test comes back as a fix round |
| reviewer | agent `rs-reviewer` | fresh eyes that didn't write the code; a write guard limits its Edit and Write to its memory; runs the checks from the project instructions, and the build checks with git that it changed nothing |

## Language

Skills talk to you in your language, in plain markdown (bold title, bulleted fields, links), never an aligned block. Specs, agents and reports are written in English.

## Feature state — `.rstack/`

`.rstack/` lives at the project root and stays out of git: rstack commits a feature's tests and code, nothing else. The first skill that writes there creates `.rstack/.gitignore` containing `*`, which ignores the folder, itself included; the project's `.gitignore` is left alone.

```
.rstack/
├── .gitignore                   *
├── features/<slug>.md           spec + state, one file per feature
├── features/<slug>.review.md    review history: one section per review round, fix round, decision and stop
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

The review history, `<slug>.review.md`, is written by `/rs-build` and read by `rs-reviewer`. Round 1 is a full review; later rounds check only that the earlier blocking items are fixed and that the diff since the last reviewed commit adds none, and a note never turns blocking later. The fix-round count is read from it, so it holds across runs of `/rs-build`. It also keeps `red: <sha>` lines (lines, not sections): each red commit a rework of the tests replaced (whether the review or a resumed build asked for it), so that its tests stay frozen. A rebase rewrite records nothing.

**The red files.** The feature's tests are the files of the red commits: the one in the spec's `red:` plus every `red: <sha>` line of the review history, where `/rs-build` records each commit a rework replaces (never the branch point of a spec with no criterion). Never found by commit subject. Not only the last one's files: a rework commits only the files it changes. A red file is test-only, or shared with code when it holds production code beside its tests (a Rust `#[cfg(test)] mod tests`, doctests…). A test-only file changed by the dev goes back to it, to restore as at `red:`. A shared file may change; the reviewer and `/rs-ship` check that its test part didn't.

**The reviewer's checks.** `rs-reviewer` runs the suite, lint and typecheck itself, check-only, with the commands of the project instructions, else of the project's manifest or scripts. No hook filters its Bash: `/rs-build` records `HEAD`, the branch and the clean tree before each review, and compares them after. A change cancels the round, the workspace is restored and a new reviewer runs once; a second cancelled round in a row stops the build. A check it can't run is a blocking item for you to settle.

**Migrating from `.rs/`.** The folder was `.rs/` in earlier versions. Each skill, before reading or writing `.rstack/`, moves `.rs/` to `.rstack/` when `.rs/.gitignore` contains `*` and `.rstack/` doesn't exist, and says so in one line. Both exist → `.rs/` is left alone. A `.rstack/checks` carried over is ignored.

**Where the spec lives.** In the feature's workspace, next to the code, and nowhere else: the skills and agents that run there share it through the file, not through git. So a feature is planned, built and shipped in the same workspace. The team gets what it needs from the pull request: `/rs-ship` writes the user story, the acceptance criteria and the review notes into it. Deleting the workspace, or a `git clean -x`, deletes the spec.

**Where diagnoses live.** In `.rstack/diagnoses/` of the clone's main checkout (the first worktree of `git worktree list`), not in the workspace: a diagnosis often outlives the feature that follows it, leads to several, or to none. Every workspace of the clone reads it there, and it stays out of git like the rest of `.rstack/`: it stays on your machine, a teammate doesn't see it, and deleting the clone, or a `git clean -x` in the main checkout, deletes it. The team's trace is the pull request: the causes a feature fixes go in it through the spec.

The reviewer's memory stays out of git too: `rs-reviewer` keeps it in `.claude/agent-memory-local/rs-reviewer/`, which `/rs-build` adds to `.git/info/exclude` (local to the clone, never committed). Like the spec, it lives in the workspace.

## Host

Claude Code only, through its plugin system: rstack relies on its subagents, hooks and mods. No other host is planned.

The agents are plugin agents, and Claude Code ignores the `hooks` and `permissionMode` of an agent shipped in a plugin. The plugin's own `PreToolUse` hook on Edit and Write (`plugin/scripts/agent-edits.sh`) does that work from the call's `agent_type`: it limits `rs-reviewer` to its memory, and lets `rs-tester` and `rs-dev` edit the repository without a prompt, as `acceptEdits` would, never under `.git/`.

## Repository layout

```
plugin/                 the rstack plugin, everything it ships
├── .claude-plugin/     plugin.json
├── skills/             rs-diagnose, rs-plan, rs-build, rs-ship, rs-explain
├── agents/             rs-tester, rs-dev, rs-reviewer
├── hooks/              agents.json (the agents' edit hook), hooks.json + register.tsx (the pilot pane)
├── scripts/            the edit hook's shell scripts
├── tests/              the pilot pane's tests
└── types/
.claude-plugin/         marketplace.json, declaring ./plugin
docs/
uninstall.sh            removes the copies of the old install.sh
```

## Install

rstack installs once per machine, as a Claude Code plugin, not per project. A project only holds what rstack produces (`.rstack/`, out of git) and its own instructions (`AGENTS.md` / `CLAUDE.md`: test and lint commands, Definition of Done).

```sh
claude plugin marketplace add romain-cll/rstack
claude plugin install rstack@rstack
claude plugin update rstack@rstack   # later, for a new version
```

The plugin is a copy, at the version of the marketplace: an edit or a branch switch in this repository doesn't reach your projects. To try a checkout instead, start Claude Code with `claude --plugin-dir plugin`. A machine that ran the old `./install.sh` runs `./uninstall.sh` once first: its copies in `~/.claude` would shadow the plugin's skills and agents. The reviewer's write guard needs `jq`.

## Not now

Bug fixing (`/rs-fix`), retrospectives, project setup, `/rs-build` as a deterministic workflow: each in its own time.
