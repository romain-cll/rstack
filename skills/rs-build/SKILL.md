---
name: rs-build
description: Build a ready spec without the user, in the current workspace — failing tests (rs-tester), implementation (rs-dev), rebase on the default branch, review (rs-reviewer), with fix rounds capped across runs — then /rs-ship on an OK review. Only a stop comes back to the user; a stop on the review's blocking items asks, in the chat, whether to look at them first or ship anyway. Use when the user invokes /rs-build or asks to build a feature whose spec is ready in .rstack/features/.
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

**Every start: the state folder.** Before reading or writing `.rstack/`: `.rs/.gitignore` exists and contains `*`, and `.rstack/` doesn't exist → `mv .rs .rstack`, said in one line (the folder was `.rs/` in an earlier version). Both exist → leave `.rs/` alone, said in one line.

No slug → the spec whose `branch:` is the current branch, else the only `ready` spec in `.rstack/features/`; several → ask which one.

Read the project instructions (test, lint and typecheck commands, Definition of Done) and the spec. Its `status` says where to start:

| status | start at |
|---|---|
| `ready` | the steps below, then 2. Red |
| `red` | 3. Green |
| `green` | 4. Review |
| `reviewed` | nothing to build: tell the user `/rs-ship <slug>` is next |
| anything else | stop |

**Every start: keep git out.**

- `git check-ignore -q .rstack/features/<slug>.md` succeeds. `.rstack/.gitignore` missing → create it containing `*`, check again. Still failing → `.rstack/` is tracked → stop: untracking it (`git rm -r --cached .rstack`, then a commit) is the user's call.
- `.claude/agent-memory-local/`, the reviewer's memory, is a line of `$(git rev-parse --git-path info/exclude)`. Missing → append it.

**From `ready`.**

1. Nothing is uncommitted (`git status --porcelain` is empty). Anything → stop: the build needs a workspace of its own.
2. On `<default>` → `git switch -c feat/<slug>`. On any other branch, build there: the harness opened it for this feature.
3. Set `branch: <current branch>` in the spec.

**From `red` or `green` (a resumed build).**

- The current branch must be the spec's `branch:`. Otherwise → stop.
- A rebase or a merge in progress (`git status`) → stop: finishing or aborting it is the user's call.
- Uncommitted changes (a run that died) → commit them first: `chore(<slug>): work in progress`.
- From `red` on, `red:` in the frontmatter is the red commit (missing → stop).

**Red files.** From `red:` on, the feature's tests are its red files: the files of the red commits, never found by their subject: the commit in the spec's `red:` plus every `red: <sha>` line of the review history (a rework that replaces `red:` appends one, below). Per commit: `git diff --name-only <sha>^ <sha>`; a commit rewritten by a rebase outlives it, its file list still holds. Not just the last commit's files: a rework commits only the files it changes, and the earlier ones stay frozen. Keep those that still exist at `red:`. No criterion → no red file. Each is *test-only*, or *shared with code* when it holds production code beside its tests (a Rust `#[cfg(test)] mod tests`, doctests…): read it at `red:` to tell. The test command is the project's, on those files.

**Bookkeeping of `red:`.** A rework of the tests (2.4 on a resumed build, 4.4.1) replaces `red:` and records the replaced sha: a line `red: <the replaced sha>` at the end of the review history, created if missing (4.4.1: under the round's `## Fix <n>`). A line, never a heading. Never record the branch point of a spec with no criterion: a sha that `git merge-base --is-ancestor <sha> origin/<default>` accepts is the default branch's, its files aren't tests. A first run (no `red:` yet) records nothing. A rebase rewrite (4.1.3, `/rs-ship`) replaces a sha by its rewritten twin and records nothing.

Write every status change in the spec as it happens. The spec is never committed.

## 2. Red

**No acceptance criterion** — a pure UI ticket, with no logic to state (`/rs-plan`, Definition of Ready): nothing to make fail, so no red phase. Don't launch `rs-tester`, there's nothing to stop on. In the spec, write `status: red` and `red:` the short sha of `git merge-base origin/<default> HEAD` — the branch point, so the feature has no test file — then go to 3. Green. The dev and the reviewer get `tests: none` (3.1, 4.2).

1. Launch `rs-tester`:

       Spec: .rstack/features/<slug>.md
       Write the failing tests for its acceptance criteria. Don't commit.

   Tests of this feature already on the branch (a resumed build): add `Rework the existing tests of this feature: <files>. Code may already exist for some criteria.`
2. Its report has untestable criteria, or a broken existing suite → stop. A criterion reported as rendering, not logic, stops the build the same way: it's the spec to fix, by moving it to the scope. The existing suite is the base check: no TDD on a red base. Broken, it means the workspace isn't ready (dependencies, environment: the harness's setup), the default branch is broken, or the tester's support or config files broke it.
3. Check, don't trust:
   - `git status` and the diff: read what changed, not the paths. Only tests changed (test files, their support and config, and the test part of a file shared with code). Any production code → stop.
   - Run the report's command: the tests written or changed in this phase fail. All green → stop: they test nothing new. On a rework, a changed test the branch's code already satisfies may pass: list it in the final report.
4. Commit: `test(<slug>): add the failing tests`. Then set `status: red` and `red: <short sha of that commit>` in the spec. A `red:` was already set (a resumed build) → record the replaced sha first, as in section 1.

## 3. Green

1. Launch `rs-dev`, named so you can come back to it later (`name: "dev"`):

       Spec: .rstack/features/<slug>.md
       Red commit: <sha> — tests: <test-only red files>   (shared with code: <files>, when any)
       Test command: <command>
       Make these tests pass, following the technical plan. The red files are frozen: the shared ones too, for their test part.

   No criterion (section 2) → `tests: none: the spec has no criterion, don't write any` and, instead of the last line, `Implement the technical plan. Check the UI you build in the running application: nothing else does.`

   The spec has a `## Ship failures` section (a resume after `/rs-ship`) → add `Also fix these failures, found by /rs-ship after a rebase: <the section, verbatim>`.
2. Read its report:
   - Blockers → stop.
   - Targeted tests, full suite, lint or typecheck not green → send the failures back to the same dev. That's a fix round (section 4).
   - Ship failures: run their commands yourself (an unmet DoD item: check it). Still failing → back to the same dev, a fix round.
3. **After every run of `rs-dev`** (here, 4.1.2, 4.1.4, 4.4.2, section 7), compare the red files with git, before any commit: `git diff --name-only <red>` and the untracked files (`git ls-files --others --exclude-standard`), ∩ the red files.
   - A test-only red file changed → a fix round back to the same dev (`SendMessage` to `dev`): `These test files changed after your run: <files>. Restore each as at <red> (git checkout <red> -- <file>) and make the tests pass through the code, or report a Blocker.` Read its report as in 3.2, check again.
   - A shared red file changed → it passes. The reviewer gets it as `shared with code`, and checks that its test part is unchanged since `red:`.
4. Set `status: green`, remove `## Ship failures` if there is one, commit: `feat(<slug>): <spec title, lowercase>`.

## 4. Review

**The review history** is `.rstack/features/<slug>.review.md`, out of git like the spec. You write it, the reviewer only reads it. Append to it, never rewrite it:

- after each review, its round:

      ## Round <n> — OK | KO — <short sha of the commit reviewed>
      ### Blocking
      <the reviewer's "Blocking", verbatim>
      ### Worth noting
      <the reviewer's "Worth noting", verbatim>

- at the start of each fix round: `## Fix <n> — <its source: review round <k>, the dev's report, the red files, the ship failures, the rebase, the user's decisions>`, with the failures verbatim when no review round holds them;
- when a rework of the tests replaces `red:` (2.4, 4.4.1): a line `red: <the replaced sha>` (section 1), so that the frozen tests of every red commit stay known;
- on a decision of the user (section 7): `## Decision — <YYYY-MM-DD>`, with the decisions verbatim.

**Fix rounds** are the history's `## Fix` sections since its last `## Decision`: the count holds across runs. Every fix round counts, whether the failures come from the dev's own report, the rebase or the reviewer, and whether the tester, the dev or both fix them. Cap: 3, unless the project instructions set another. A fix round once the cap is reached → stop instead.

1. **Up to date.** The review sees the branch on today's default branch, not the one the build started from.
   1. `git fetch origin`. The branch was never pushed (`git ls-remote --heads origin <branch>` is empty) → `git rebase origin/<default>`. Already pushed → `git merge --no-edit origin/<default>` instead: never rewrite what was pushed, never force-push.
   2. A conflict → a fix round: send the conflicting files (`git diff --name-only --diff-filter=U`) to the dev as in 4.4.2, to resolve without committing. Then check the red files as in 3.3, before going on, so that a restore is part of the resolution and never left uncommitted (`red:` isn't updated yet: compare with `HEAD` instead of `<red>`). Then `git add -A` and `git -c core.editor=true rebase --continue` (`git commit --no-edit` for a merge); another conflict, the same. The dev can't resolve one (a red file, a blocker), or the cap is reached → `git rebase --abort` (`git merge --abort`), stop.
   3. The rebase rewrote `red:` or the last reviewed commit (`git merge-base --is-ancestor <sha> HEAD` fails) → each is now the newest commit of `origin/<default>..HEAD` with the same subject and author date (`git log -1 --format='%s%n%aI' <old sha>`: the old commit outlives the rebase). Write the new `red:` in the spec, nothing in the history. None → stop.
   4. Run the full suite. Red → a fix round: the failures to the dev as in 4.4.2, read its report as in 3.2, check the red files as in 3.3, commit `fix(<slug>): pass the suite on <default>`.
2. Review, guarded: the reviewer's Bash is open, git says whether it changed anything.
   1. Before: record `HEAD`, the current branch (`git branch --show-current`) and a fingerprint of the spec and its history (`cksum` of both files, the history may not exist yet). The tree is clean (`git status --porcelain` empty). Anything → stop, without committing it: a test run or a tool left files git doesn't ignore, the report names them, the project's `.gitignore` is the fix.
   2. Launch a new `rs-reviewer` each round, for fresh eyes:

          Spec: .rstack/features/<slug>.md
          Red commit: <sha> — tests: <test-only red files>   (shared with code: <files>, when any)
          Round: <n>

      No criterion (section 2) → `tests: none: the spec has no criterion, the branch must change no test file`. From round 2, add `History: .rstack/features/<slug>.review.md — last reviewed: <its last round's commit, after 4.1.3>`. `<n>`: the history's rounds plus one.
   3. After: spec or history fingerprint changed → stop: they are out of git, nothing restores them. Tree still clean, same `HEAD`, same branch → the round counts, go on. Otherwise the round is cancelled: not written to the history, not counted. Restore the workspace, resetting before switching so that local changes left by the reviewer can't make it fail: on `<branch>` → `git reset --hard <recorded HEAD>`; on another branch or a detached `HEAD` → `git switch --discard-changes <branch>` first (never reset another branch), then the reset; then `git clean -fd` (never `-x`: ignored files stay). A command failing → stop. Then launch a new `rs-reviewer` once, same prompt plus `The previous review of this round was cancelled: it changed <what: the files of git status, the HEAD or the branch it moved>. Change nothing.` A second cancelled round in a row → stop: the report names what each changed. Any stop in this step restores what it can first, and commits nothing of the cancelled reviewer's changes (section 5).
3. Append the round to the history, with `HEAD` as the commit reviewed.
   OK → write `## Review notes` at the end of the spec ("Nothing" if none; an earlier section is replaced): the Worth noting items of every round in the history, verbatim, those flagged `[outside spec]` first. `/rs-ship` puts them in the pull request. Set `status: reviewed`. Go to section 6.
4. KO:
   - an `[upstream]` item → stop;
   - the fixes don't converge → stop: an item marked `(back from round <k>)`, or, the round before being KO too (since the last `## Decision`), no fewer blocking items than it had;
   - the cap reached → stop;
   - otherwise a fix round, without the user, the tests first:
     1. `[tests]` items → launch `rs-tester`:

            Spec: .rstack/features/<slug>.md
            Rework the tests of this feature after review: <files>. The code is there. Don't commit.
            <the [tests] items, verbatim>

        Check its report and the tree as in 2.2 and 2.3, except that reworked tests may pass. Commit `test(<slug>): rework the tests, review round <n>`, write `red: <its short sha>` in the spec, and record the replaced sha under the current `## Fix <n>` of the history, as in section 1. A reworked test fails → set `status: red`.
     2. `[code]` items, or reworked tests that fail → send them verbatim to the same dev, with the new red commit and tests if they changed (`SendMessage` to `dev`; no dev in this run, as after a resume → launch `rs-dev` named `dev` with the 3.1 prompt plus the items). Read its report as in 3.2, check the red files as in 3.3, commit `fix(<slug>): address review round <n>`, set `status: green`.
     3. Back to 4.1.

## 5. Stop

- Commit whatever changed, without touching `status`: `chore(<slug>): work in progress, stopped at <red|green|review>`. A stop before any work has nothing to commit. A stop in 4.2 on a cancelled review or a changed fingerprint: restore as far as possible (4.2.3) and commit nothing: what a cancelled reviewer changed never goes in.
- Report, then stop:

      <Title> — stopped at <red|green|review>, <branch>
      Why      one line
      Items    the blocking items, untestable criteria or failures, verbatim
      Resume   what to fix, then /rs-build <slug> here

  How to resume, by what gets fixed: criteria, the test strategy, or a test that's wrong, trivial or superfluous → set `status: ready`, the tests get reworked. Plan or design → set `status: red`, the dev reworks the code. Anything else → leave the status. Files a test run leaves that git doesn't ignore → add them to the project's `.gitignore`, then leave the status.

A stop at 4.4, on the reviewer's blocking items (an `[upstream]` item, fixes that don't converge, the cap) → section 7 after the report. Any other stop ends here.

## 6. Done

    <Title> — reviewed, <branch>
    Tests    <n> tests, AC1–ACn · red <sha>   (no criterion → "no test, UI only")
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
