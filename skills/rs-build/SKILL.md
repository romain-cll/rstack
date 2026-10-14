---
name: rs-build
description: Build a ready spec without the user — opens the feature's own workspace, then failing tests (rs-tester), implementation (rs-dev) and review (rs-reviewer), with at most two fix rounds. Use when the user invokes /rs-build or asks to build a feature whose spec is ready in .rs/features/.
argument-hint: "<slug>"
---

# rs-build

You turn a `ready` spec into reviewed code on its own branch, without the user. You orchestrate, the agents do the work: `rs-tester` writes the red tests, `rs-dev` makes them pass, `rs-reviewer` checks. You handle git and the spec's state.

Output: branch `feat/<slug>` in its own workspace, with the spec, the red tests and the implementation committed, and the spec at `status: reviewed`. No push, no pull request: that's `/rs-ship`.

## Which half you run

`/rs-build <slug>` runs in two places:

- **Not on `feat/<slug>`** → you open the feature's workspace and hand the build over to it (section 1). The user is with you.
- **On `feat/<slug>`** → you build (sections 2 to 7). Nobody is watching: never ask a question. Whatever needs the user stops the build (section 6).

No slug → on `feat/<slug>`, the branch gives it; elsewhere, the only `ready` spec in `.rs/features/`, and if there are several, ask which one.

## Talking to the user

- Speak the user's language. Specs, agent prompts and commit messages stay in English.
- Report what happened and what's next. No narration.

## Commits

- Messages: the project's convention if its instructions set one, else the ones below.
- In the workspace, every commit takes all its changes (`git add -A`): the workspace holds only this feature. A secret or a build artefact shows up in `git status` → don't commit it, stop.
- Local only: never push.

`<default>` is the default branch: `git symbolic-ref --short refs/remotes/origin/HEAD`, without `origin/`.

## 1. Open the workspace

Checks in this order, any failure → tell the user and stop:

1. The repository has an `origin` remote.
2. `feat/<slug>` exists neither locally nor on `origin`. If it does, the build already started: say where (its Superset workspace in `superset ws list --local --json`, or its worktree in `git worktree list`) and that running `/rs-build <slug>` there resumes it.
3. `.rs/features/<slug>.md` exists with `status: ready`.

**Branch.** `git fetch origin`, then `git branch --no-track feat/<slug> origin/<default>`. This checkout stays on its branch.

**Workspace.**

- **Superset** — `superset` is on the PATH and `superset projects list --json` has a project whose `path` is the main checkout (first entry of `git worktree list`):

      superset ws create --local --project <project-id> --name <slug> --branch feat/<slug> --skip-branch-prefix --json

  Keep the workspace id and the terminal labelled "Workspace Setup", if any. Its path: `worktreePath` in `superset ws get --local <workspace-id> --json`.
- **Otherwise** — `git worktree add <main checkout's parent>/<repo>.worktrees/<slug> feat/<slug>`.

**Spec.** It moves to its branch:

1. Set `branch: feat/<slug>` in its frontmatter.
2. Copy it to the same path in the workspace and commit that file alone, from the workspace: `docs(<slug>): add the spec`.
3. Delete the original.

**Setup.** The workspace must be able to run the tests before the build starts.

- Superset returned a "Workspace Setup" terminal: it is running the project's setup. Read it (`superset terminals read --local --workspace <workspace-id> --terminal <terminal-id>`) every ~10 s until the screen is back at a bare shell prompt after the setup's output. Never type into that terminal: the text lands in the setup's command line. Still running after 10 minutes → ask the user.
- No Superset setup → in the workspace, run the setup command from the project instructions if there is one. Otherwise install the dependencies with the package manager of the lockfile, then copy the main checkout's git-ignored `.env*` files to the same relative paths (never committed).

Setup failed → stop: show the user the last lines, say the workspace is open (name, path), and that once its setup is fixed and run again there, `/rs-build <slug>` in it starts the build.

**Hand over.**

- Superset → `superset agents create --local --workspace <workspace-id> --agent <your own preset: claude, codex…> --prompt "/rs-build <slug>"`. Tell the user, in two lines, that the workspace is open (name, branch) and the build runs there, then stop.
- Otherwise → move into the workspace (Claude Code: `EnterWorktree` with its path; elsewhere, run every command from it) and go on at section 2.

## 2. Resume point

Read the project instructions (test, lint and typecheck commands, Definition of Done) and the spec.

Uncommitted changes in the workspace (a run that died) → commit them first: `chore(<slug>): work in progress`.

The spec's `status` says where to start:

| status | start at |
|---|---|
| `ready` | 3. Red |
| `red` | 4. Green |
| `green` | 5. Review |
| `reviewed` | nothing to build: tell the user `/rs-ship <slug>` is next |
| anything else | stop |

From `red` on, `red:` in the frontmatter is the red commit (missing → stop). The feature's tests are the files of that commit except the spec (`git show --name-only --format= <red>`); their command is the project's test command on those files.

Write every status change in the spec as it happens; it goes in the next commit.

## 3. Red

1. Run the full suite. Apart from tests this branch already added (`git diff --name-only origin/<default>...HEAD`), it must be green: no TDD on a red base. Red → stop.
2. Launch `rs-tester`:

       Spec: .rs/features/<slug>.md
       Write the failing tests for its acceptance criteria. Don't commit.

   Tests of this feature already on the branch (a resumed build): add `Rework the existing tests of this feature: <files>. Code may already exist for some criteria.`
3. Its report has untestable criteria, or a broken existing suite → stop.
4. Check, don't trust:
   - `git status`: only tests changed (test files, their support and config). Anything else → stop.
   - Run the report's command: the tests written or changed in this phase fail. All green → stop: they test nothing new. On a rework, a changed test the branch's code already satisfies may pass: list it in the final report.
5. Set `status: red`, commit: `test(<slug>): add the failing tests`. Then write `red: <short sha of that commit>` in the spec and commit it: `docs(<slug>): record the red commit`.

## 4. Green

1. Launch `rs-dev`, named so you can come back to it later (Claude Code: `name: "dev"`):

       Spec: .rs/features/<slug>.md
       Red commit: <sha> — tests: <files>
       Test command: <command>
       Make these tests pass, following the technical plan.

2. Read its report:
   - Blockers → stop.
   - Targeted tests, full suite, lint or typecheck not green → send the failures back to the same dev. That's a fix round (section 5).
3. Set `status: green`, commit: `feat(<slug>): <spec title, lowercase>`.

## 5. Review

1. Launch a new `rs-reviewer` each round, for fresh eyes:

       Spec: .rs/features/<slug>.md
       Red commit: <sha> — tests: <files>

2. OK → set `status: reviewed`, commit (the spec, and the reviewer's memory if it changed): `docs(<slug>): mark reviewed`. Go to section 7.
3. KO:
   - an `[upstream]` item → stop;
   - only `[code]` items, fewer than 2 fix rounds → send the "Blocking" items verbatim to the same dev (Claude Code: `SendMessage` to `dev`; no dev in this run, as after a resume → launch `rs-dev` named `dev` with the 4.1 prompt plus the items). Read its report as in 4.2, commit `fix(<slug>): address review round <n>`, back to 5.1;
   - 2 fix rounds done → stop.

Two fix rounds per run, whether the failures come from the dev's own report or from the reviewer.

## 6. Stop

- Commit whatever changed, without touching `status`: `chore(<slug>): work in progress, stopped at <red|green|review>`. A stop before any work (red base) has nothing to commit.
- Report, then stop:

      <Title> — stopped at <red|green|review>, feat/<slug>
      Why      one line
      Items    the blocking items, untestable criteria or failures, verbatim
      Resume   what to fix, then /rs-build <slug> in this workspace

  How to resume, by what gets fixed: criteria, or a test that's wrong or trivial → set `status: ready`, the tests get reworked. Plan or design → set `status: red`, the dev reworks the code. Anything else → leave the status.

## 7. Done

    <Title> — reviewed, feat/<slug>
    Tests    <n> tests, AC1–ACn · red <sha>
    Review   OK after <n> fix round(s)
    Note     the reviewer's "Worth noting", one line each   (or "nothing")
    Next     /rs-ship <slug>

## Host without subagents

Play each role yourself, in the same order, following its file in `agents/` (`rs-tester.md`, `rs-dev.md`, `rs-reviewer.md`). Their guardrails become rules you keep: the dev never touches a test, the reviewer changes nothing.
