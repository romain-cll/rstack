---
name: rs-build
description: Build a ready spec without the user, in the current workspace — failing tests (rs-tester), implementation (rs-dev), rebase on the default branch, review (rs-reviewer), with fix rounds capped across runs — then /rs-ship on an OK review. Only a stop comes back to the user; a stop on the review's blocking items asks, in the chat, whether to look at them first or ship anyway. Use when the user invokes /rs-build or asks to build a feature whose spec is ready in .rs/features/.
argument-hint: "<slug>"
---

# rs-build

You turn a `ready` spec into reviewed code on the current branch, without the user. You orchestrate, the agents do the work: `rs-tester` writes the red tests, `rs-dev` makes them pass, `rs-reviewer` checks. You handle git, the spec's state and the review history.

The spec is your only input, even when `/rs-plan` launched you at the end of its conversation: the agents get the prompts below, nothing from that discussion.

Workspaces aren't yours: the user's harness opened this one for the feature and set it up. You build where you are.

Output: the red tests and the implementation committed on the feature's branch, up to date with the default branch, and the spec at `status: reviewed`. No push, no pull request: that's `/rs-ship`, which the build starts once the review is OK (section 6).

## Talking to the user

- Speak the user's language. Specs, agent prompts and commit messages stay in English.
- The user launches you, with their ok at `/rs-plan`'s gate or by hand, and leaves. Once the build has started, never ask a question: whatever needs them stops the build (section 5).
- An OK review asks nothing: `/rs-ship` starts (section 6). A stop on the review's blocking items is the exception: its report ends on one question, in plain text, never with a question tool (section 7).
- Report what happened and what's next. No narration.

## Commits

- Messages: the project's convention if its instructions set one, else the ones below.
- Every commit takes all the working tree's changes (`git add -A`): the workspace holds only this feature. A secret or a build artefact shows up in `git status` → don't commit it, stop.
- Only tests and code go in: the spec, its review history and the reviewer's memory stay out of git (section 1).
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
- A rebase or a merge in progress (`git status`) → stop: finishing or aborting it is the user's call.
- Uncommitted changes (a run that died) → commit them first: `chore(<slug>): work in progress`.
- From `red` on, `red:` in the frontmatter is the red commit (missing → stop). The feature's tests are the test files (tests, their support and config) the branch has up to that commit: `git diff --name-only --diff-filter=d origin/<default>...<red>`, without the code. Not just that commit's files: a rework commits only the files it changes. Their command is the project's test command on those files.

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

**The review history** is `.rs/features/<slug>.review.md`, out of git like the spec. You write it, the reviewer only reads it. Append to it, never rewrite it:

- after each review, its round:

      ## Round <n> — OK | KO — <short sha of the commit reviewed>
      ### Blocking
      <the reviewer's "Blocking", verbatim>
      ### Worth noting
      <the reviewer's "Worth noting", verbatim>

- at the start of each fix round: `## Fix <n> — <its source: review round <k>, the dev's report, the ship failures, the rebase, the user's decisions>`, with the failures verbatim when no review round holds them;
- on a decision of the user (section 7): `## Decision — <YYYY-MM-DD>`, with the decisions verbatim.

**Fix rounds** are the history's `## Fix` sections since its last `## Decision`: the count holds across runs. Every fix round counts, whether the failures come from the dev's own report, the rebase or the reviewer, and whether the tester, the dev or both fix them. Cap: 3, unless the project instructions set another. A fix round once the cap is reached → stop instead.

1. **Up to date.** The review sees the branch on today's default branch, not the one the build started from.
   1. `git fetch origin`. The branch was never pushed (`git ls-remote --heads origin <branch>` is empty) → `git rebase origin/<default>`. Already pushed → `git merge --no-edit origin/<default>` instead: never rewrite what was pushed, never force-push.
   2. A conflict → a fix round: send the conflicting files (`git diff --name-only --diff-filter=U`) to the dev as in 4.4.2, to resolve without committing. Then `git add -A` and `git -c core.editor=true rebase --continue` (`git commit --no-edit` for a merge); another conflict, the same. The dev can't resolve one (a test file, a blocker), or the cap is reached → `git rebase --abort` (`git merge --abort`), stop.
   3. The rebase rewrote `red:` or the last reviewed commit (`git merge-base --is-ancestor <sha> HEAD` fails) → each is now the newest commit of `origin/<default>..HEAD` with the same subject and author date (`git log -1 --format='%s%n%aI' <old sha>`: the old commit outlives the rebase). Write the new `red:` in the spec. None → stop.
   4. Run the full suite. Red → a fix round: the failures to the dev as in 4.4.2, read its report as in 3.2, commit `fix(<slug>): pass the suite on <default>`.
2. Launch a new `rs-reviewer` each round, for fresh eyes:

       Spec: .rs/features/<slug>.md
       Red commit: <sha> — tests: <files>
       Round: <n>

   From round 2, add `History: .rs/features/<slug>.review.md — last reviewed: <its last round's commit, after 4.1.3>`. `<n>`: the history's rounds plus one.
3. Append the round to the history, with `HEAD` as the commit reviewed.
   OK → write `## Review notes` at the end of the spec ("Nothing" if none; an earlier section is replaced): the Worth noting items of every round in the history, verbatim, those flagged `[outside spec]` first. `/rs-ship` puts them in the pull request. Set `status: reviewed`. Go to section 6.
4. KO:
   - an `[upstream]` item → stop;
   - the fixes don't converge → stop: an item marked `(back from round <k>)`, or, the round before being KO too (since the last `## Decision`), no fewer blocking items than it had;
   - the cap reached → stop;
   - otherwise a fix round, without the user, the tests first:
     1. `[tests]` items → launch `rs-tester`:

            Spec: .rs/features/<slug>.md
            Rework the tests of this feature after review: <files>. The code is there. Don't commit.
            <the [tests] items, verbatim>

        Check its report and the tree as in 2.3 and 2.4, except that reworked tests may pass. Commit `test(<slug>): rework the tests, review round <n>`, write `red: <its short sha>` in the spec. A reworked test fails → set `status: red`.
     2. `[code]` items, or reworked tests that fail → send them verbatim to the same dev, with the new red commit and tests if they changed (`SendMessage` to `dev`; no dev in this run, as after a resume → launch `rs-dev` named `dev` with the 3.1 prompt plus the items). Read its report as in 3.2, commit `fix(<slug>): address review round <n>`, set `status: green`.
     3. Back to 4.1.

## 5. Stop

- Commit whatever changed, without touching `status`: `chore(<slug>): work in progress, stopped at <red|green|review>`. A stop before any work has nothing to commit.
- Report, then stop:

      <Title> — stopped at <red|green|review>, <branch>
      Why      one line
      Items    the blocking items, untestable criteria or failures, verbatim
      Resume   what to fix, then /rs-build <slug> here

  How to resume, by what gets fixed: criteria, the test strategy, or a test that's wrong, trivial or superfluous → set `status: ready`, the tests get reworked. Plan or design → set `status: red`, the dev reworks the code. Anything else → leave the status.

A stop at 4.4, on the reviewer's blocking items (an `[upstream]` item, fixes that don't converge, the cap) → section 7 after the report. Any other stop ends here.

## 6. Done

    <Title> — reviewed, <branch>
    Tests    <n> tests, AC1–ACn · red <sha>
    Review   OK after <n> fix round(s)
    Outside  the notes flagged [outside spec], one line each: behaviour the spec doesn't describe   (none → drop the line)
    Note     the other review notes, one line each   (or "nothing")
    Next     /rs-ship, now: it opens the pull request, the merge stays yours

Then run `/rs-ship <slug>`, here, without asking: it never merges. From then on its instructions apply, not these.

## 7. Look first or ship anyway

A stop on the review's blocking items (4.4) is the one the user settles in the chat: the build is over and they may be back. Add to its report, in the user's language:

    On ok    shipped anyway: the blocking items go in the pull request

    Look at these with me first, or ship anyway?

Then wait for the user's answer. By answer:

- **Ship anyway** → write `## Review notes` as in 4.3, add each blocking item of the last round verbatim, prefixed `Blocking, shipped anyway by <git config user.name>:`, and set `status: reviewed`. Then run `/rs-ship <slug>`, here. From then on its instructions apply, not these. `/rs-ship` still runs its own checks: a red suite or changed tests stop it all the same.
- **Not now** → stop, with the report's Resume as the next step, in one line.
- **A point to look at first** → work it out with the user, here: what the point means in the code, the options, your recommendation. Don't hand it to an agent yet: the dev may not know either, the decision is the user's. Change nothing until they decide, then by decision:
  - ship as it is → as **Ship anyway**;
  - a change in the code → add it under `## Decisions`, `<YYYY-MM-DD> — <decision> (validated by <git config user.name>)`: the next reviewer counts it in scope. Append it to the history as a `## Decision`. Set `status: green`, so that a run that dies resumes at the review. Then a fix round as in 4.4, sending the decisions verbatim under `Apply these decisions, made with the user on the review:`;
  - a change in behaviour, a criterion, the plan or the tests → update the spec (a change in behaviour is a new criterion: it needs a test first), append it to the history as a `## Decision`, set the status as section 5's "How to resume" says, and start again at section 1.

  Never change the code yourself in the chat: it would ship without the dev's checks and the reviewer. Once the user has decided, the build goes on without them, its fix rounds counted again from the `## Decision`, and ends on `/rs-ship` or a stop again.
