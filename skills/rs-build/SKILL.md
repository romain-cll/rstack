---
name: rs-build
description: Build a ready spec without the user, in the current workspace — failing tests (rs-tester), implementation (rs-dev), review (rs-reviewer), with at most two fix rounds — then a report that asks whether to ship: the user's ok starts /rs-ship, a point to look at first is settled with them in the chat. Use when the user invokes /rs-build or asks to build a feature whose spec is ready in .rs/features/.
argument-hint: "<slug>"
---

# rs-build

You turn a `ready` spec into reviewed code on the current branch, without the user. You orchestrate, the agents do the work: `rs-tester` writes the red tests, `rs-dev` makes them pass, `rs-reviewer` checks. You handle git and the spec's state.

The spec is your only input, even when `/rs-plan` launched you at the end of its conversation: the agents get the prompts below, nothing from that discussion.

Workspaces aren't yours: the user's harness opened this one for the feature and set it up. You build where you are.

Output: the red tests and the implementation committed on the feature's branch, and the spec at `status: reviewed`. No push, no pull request: that's `/rs-ship`, which the end of the build offers to start (section 7).

## Talking to the user

- Speak the user's language. Specs, agent prompts and commit messages stay in English.
- The user launches you, with their ok at `/rs-plan`'s gate or by hand, and leaves. Once the build has started, never ask a question: whatever needs them stops the build (section 5).
- The end of the build is the exception: the report ends on one question, in plain text, never with a question tool (section 7).
- Report what happened and what's next. No narration.

## Commits

- Messages: the project's convention if its instructions set one, else the ones below.
- Every commit takes all the working tree's changes (`git add -A`): the workspace holds only this feature. A secret or a build artefact shows up in `git status` → don't commit it, stop.
- Only tests and code go in: the spec and the reviewer's memory stay out of git (section 1).
- Local only: never push.

`<default>` is the default branch: `git symbolic-ref --short refs/remotes/origin/HEAD`, without `origin/`.

## 1. Start

No slug → the spec whose `branch:` is the current branch, else the only `ready` spec in `.rs/features/`; several → ask which one.

Read the project instructions (test, lint and typecheck commands, Definition of Done) and the spec. Its `status` says where to start:

| status | start at |
|---|---|
| `ready` | the steps below, then 2. Red |
| `red` | 3. Green |
| `green` | 4. Review |
| `reviewed` | nothing to build: tell the user `/rs-ship <slug>` is next |
| anything else | stop |

**Every start: keep git out.**

- `git check-ignore -q .rs/features/<slug>.md` succeeds. `.rs/.gitignore` missing → create it containing `*`, check again. Still failing → `.rs/` is tracked → stop: untracking it (`git rm -r --cached .rs`, then a commit) is the user's call.
- `.claude/agent-memory-local/`, the reviewer's memory, is a line of `$(git rev-parse --git-path info/exclude)`. Missing → append it.

**From `ready`.**

1. Nothing is uncommitted (`git status --porcelain` is empty). Anything → stop: the build needs a workspace of its own.
2. On `<default>` → `git switch -c feat/<slug>`. On any other branch, build there: the harness opened it for this feature.
3. Set `branch: <current branch>` in the spec.

**From `red` or `green` (a resumed build).**

- The current branch must be the spec's `branch:`. Otherwise → stop.
- Uncommitted changes (a run that died) → commit them first: `chore(<slug>): work in progress`.
- From `red` on, `red:` in the frontmatter is the red commit (missing → stop). The feature's tests are the files of that commit (`git show --name-only --format= <red>`). Their command is the project's test command on those files.

Write every status change in the spec as it happens. The spec is never committed.

## 2. Red

1. Run the full suite. Apart from tests this branch already added (`git diff --name-only origin/<default>...HEAD`), it must be green: no TDD on a red base. Red → stop: the workspace isn't ready (dependencies, environment: the harness's setup), or the default branch is broken.
2. Launch `rs-tester`:

       Spec: .rs/features/<slug>.md
       Write the failing tests for its acceptance criteria. Don't commit.

   Tests of this feature already on the branch (a resumed build): add `Rework the existing tests of this feature: <files>. Code may already exist for some criteria.`
3. Its report has untestable criteria, or a broken existing suite → stop.
4. Check, don't trust:
   - `git status`: only tests changed (test files, their support and config). Anything else → stop.
   - Run the report's command: the tests written or changed in this phase fail. All green → stop: they test nothing new. On a rework, a changed test the branch's code already satisfies may pass: list it in the final report.
5. Commit: `test(<slug>): add the failing tests`. Then set `status: red` and `red: <short sha of that commit>` in the spec.

## 3. Green

1. Launch `rs-dev`, named so you can come back to it later (`name: "dev"`):

       Spec: .rs/features/<slug>.md
       Red commit: <sha> — tests: <files>
       Test command: <command>
       Make these tests pass, following the technical plan.

   The spec has a `## Ship failures` section (a resume after `/rs-ship`) → add `Also fix these failures, found by /rs-ship after a rebase: <the section, verbatim>`.
2. Read its report:
   - Blockers → stop.
   - Targeted tests, full suite, lint or typecheck not green → send the failures back to the same dev. That's a fix round (section 4).
   - Ship failures: run their commands yourself (an unmet DoD item: check it). Still failing → back to the same dev, a fix round.
3. Set `status: green`, remove `## Ship failures` if there is one, commit: `feat(<slug>): <spec title, lowercase>`.

## 4. Review

1. Launch a new `rs-reviewer` each round, for fresh eyes:

       Spec: .rs/features/<slug>.md
       Red commit: <sha> — tests: <files>

2. OK → write the reviewer's "Worth noting" verbatim at the end of the spec, under `## Review notes` ("Nothing" if none; an earlier section is replaced): `/rs-ship` puts them in the pull request. Set `status: reviewed`. Go to section 6.
3. KO:
   - an `[upstream]` item → stop;
   - only `[code]` items, fewer than 2 fix rounds → send the "Blocking" items verbatim to the same dev (`SendMessage` to `dev`; no dev in this run, as after a resume → launch `rs-dev` named `dev` with the 3.1 prompt plus the items). Read its report as in 3.2, commit `fix(<slug>): address review round <n>`, back to 4.1;
   - 2 fix rounds done → stop.

Two fix rounds per run, whether the failures come from the dev's own report or from the reviewer.

## 5. Stop

- Commit whatever changed, without touching `status`: `chore(<slug>): work in progress, stopped at <red|green|review>`. A stop before any work has nothing to commit.
- Report, then stop:

      <Title> — stopped at <red|green|review>, <branch>
      Why      one line
      Items    the blocking items, untestable criteria or failures, verbatim
      Resume   what to fix, then /rs-build <slug> here

  How to resume, by what gets fixed: criteria, the test strategy, or a test that's wrong, trivial or superfluous → set `status: ready`, the tests get reworked. Plan or design → set `status: red`, the dev reworks the code. Anything else → leave the status.

A stop at 4.3, on the reviewer's blocking items (an `[upstream]` item, or 2 fix rounds done) → section 7 after the report. Any other stop ends here.

## 6. Done

    <Title> — reviewed, <branch>
    Tests    <n> tests, AC1–ACn · red <sha>
    Review   OK after <n> fix round(s)
    Note     the spec's "Review notes", one line each   (or "nothing")
    On ok    /rs-ship starts here, without you

    Ship it? Or tell me which note to look at first.   (no note: "Ship it?")

Then section 7.

## 7. Ship or look first

The build is over and the user may be back. Its report ends on the question, in the chat, in the user's language. After a stop at 4.3, add to the stop report:

    On ok    shipped anyway: the blocking items go in the pull request

    Look at these with me first, or ship anyway?

Then wait for the user's answer. By answer:

- **Ok, ship** → run `/rs-ship <slug>`, here. From then on its instructions apply, not these. After a stop at 4.3, first: write `## Review notes` as in 4.2, add each blocking item verbatim, prefixed `Blocking, shipped anyway by <git config user.name>:`, and set `status: reviewed`. `/rs-ship` still runs its own checks: a red suite or changed tests stop it all the same.
- **Not now** → stop, with `/rs-ship <slug>` as the next step, in one line.
- **A point to look at first** → work it out with the user, here: what the point means in the code, the options, your recommendation. Don't hand it to an agent yet: the dev may not know either, the decision is the user's. Change nothing until they decide, then by decision:
  - ship as it is → as **Ok, ship**;
  - a change in the code → add it under `## Decisions`, `<YYYY-MM-DD> — <decision> (validated by <git config user.name>)`: the next reviewer counts it in scope. Set `status: green`, so that a run that dies resumes at the review. Then a fix round as in 4.3, sending the decisions verbatim under `Apply these decisions, made with the user on the review:`;
  - a change in behaviour, a criterion, the plan or the tests → update the spec (a change in behaviour is a new criterion: it needs a test first), set the status as section 5's "How to resume" says, and start again at section 1.

  Never change the code yourself in the chat: it would ship without the dev's checks and the reviewer. Once the user has decided, the build goes on without them, its fix rounds counted from zero again, and ends on its report and this question again.
