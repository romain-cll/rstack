---
name: rs-ship
description: Ship a reviewed feature without the user — rebase on the default branch, run the checks and the Definition of Done again, push, open the pull request. Never merges. Started by the user's ok on /rs-build's report. Use when the user invokes /rs-ship or asks to open the pull request of a feature reviewed by /rs-build.
argument-hint: "<slug>"
---

# rs-ship

You take a `reviewed` feature to an open pull request, without the user. The branch is rebased on the default branch, so the code is no longer the one the reviewer saw: you check it again before anyone else sees it. The merge is the user's, never yours.

Output: the branch rebased and pushed, the spec at `status: shipped`, a pull request to the default branch (a merge request on GitLab).

## Talking to the user

- Speak the user's language. Commit messages, the pull request and the spec stay in English.
- The user launches you, with their ok on `/rs-build`'s report or by hand, and leaves. Once the ship has started, never ask a question: whatever needs them stops the ship (section 6).
- The spec and the branch are your only inputs, even when `/rs-build` launched you: nothing from its conversation goes in the pull request.
- Report what happened and what's next. No narration.

## Git

- Commit messages and the pull request: the project's convention if its instructions (or a pull request template) set one, else the ones below.
- You commit nothing: you change no code, and the spec stays out of git (`.rs/` is ignored).
- You push this branch only, to `origin`. Never to `<default>`, never a merge.
- The project instructions say how to push or open a pull request (push options, labels, pipelines) → follow them.

`<default>` is the default branch: `git symbolic-ref --short refs/remotes/origin/HEAD`, without `origin/` (unset → `git remote set-head origin --auto` first).

## 1. Start

No slug → the spec whose `branch:` is the current branch, else the only `reviewed` spec in `.rs/features/`; several → ask which one.

Read the project instructions (test, lint and typecheck commands, Definition of Done, how to push and open a pull request) and the spec. Its `status` says what to do:

| status | do |
|---|---|
| `reviewed` | the checks below, then 2. Rebase |
| `shipped` | the branch's pull request, in any state (`gh pr list --head <branch> --state all`, `glab mr list --source-branch <branch> --all`): open or merged → give its link, stop. Closed → stop: reopening it is the user's call. None (a run that died) → as `reviewed` |
| `ready`, `red`, `green` | stop: `/rs-build <slug>` first |
| anything else | stop |

Check before touching anything. One fails → stop.

1. No rebase in progress (`git status`): it's the user's or a dead run's, not yours to finish or abort.
2. The current branch is the spec's `branch:`, and it isn't `<default>`.
3. No tracked file changed (`git status --porcelain --untracked-files=no` is empty): a change made after the review was never reviewed. Untracked files are left alone, never committed.
4. `red:` is set. The feature's tests are the files of that commit (`git show --name-only --format= <red>`).
5. The pull request tool, from the host of `git remote get-url origin`: `github.com` → `gh`, `gitlab.com` → `glab`, another host → the one of the two logged in to it. Either way it is installed and logged in (`gh auth status --hostname <host>`, `glab auth status --hostname <host>`).

## 2. Rebase

1. `git fetch --prune origin`: a remote branch deleted since the last fetch must not linger as `origin/<branch>`.
2. Branch already on `origin` → its tip was pushed from here: `git rev-parse origin/<branch>` is in `git reflog --format=%H <branch>`. Not in it → someone else pushed to the branch → stop. Compare with the reflog, not with `HEAD`: once rebased, the branch no longer contains what it pushed before.
3. `git rebase origin/<default>`. Conflict → list the conflicting files (`git diff --name-only --diff-filter=U`), `git rebase --abort`, stop.
4. Update `red:`. A rebase rewrites the SHAs, this one or one done by hand before this run: `git merge-base --is-ancestor <red> HEAD` fails → the red commit is now the newest commit of `origin/<default>..HEAD` with the same subject and author date as the old one (`git log -1 --format='%s%n%aI' <red>`: the old commit outlives the rebase). Newest, because a rework of the tests leaves several commits with that subject, and the last one is the red commit. Write `red: <its short sha>` in the spec. None → stop.

## 3. Check

Yourself, after the rebase: the review was done before it.

1. Tests untouched since the red phase: `git diff --quiet <red> HEAD -- <test files>`. Otherwise → stop.
2. Run the full suite, lint and typecheck: the project instructions' commands, check-only (no `--fix`). A project without lint or typecheck → "none" in the reports. Anything red → stop.

## 4. Definition of Done

Every item of the Definition of Done in the project instructions, against the rebased branch:

- a command (build, e2e…) → run it; red → stop;
- what this skill makes true (criteria ticked, the spec's status, the pull request itself) → met once section 5 is done;
- what only a person can check (a manual test, a device, a visual check), or what can only be true once the pull request is open (CI, approvals, a preview deploy) → not a stop: it goes to the pull request's Notes, to check before merging;
- anything else not met → stop.

No Definition of Done in the instructions → "none" in the reports.

## 5. Ship

1. In the spec, tick every acceptance criterion (`- [x]`), remove `## Ship failures` if a stop left one, set `status: shipped`. Already `shipped` (a resumed run) → nothing to change.
2. Push: `git push -u origin <branch>`, with `--force-with-lease --force-if-includes` if the branch is already on `origin`: the rebase rewrote it. The lease refuses if the remote moved since the fetch; `--force-if-includes` also refuses if a background fetch (IDE, harness) picked up someone else's push meanwhile.
3. A pull request already open for the branch (`gh pr list --head <branch>`, `glab mr list --source-branch <branch>`) → the push updated it, keep it. Otherwise open one to `<default>`, not as a draft:

       gh pr create --base <default> --head <branch> --title "<title>" --body-file -
       glab mr create --target-branch <default> --source-branch <branch> --title "<title>" --description-file - --yes

   The body goes through stdin, never inline: the shell would expand its backticks and `$`.

Title: `feat(<slug>): <spec title, lowercase>`, the subject of the feature's commit.

Body, from the spec and your checks only, nothing invented:

    ## Summary
    <the user story>

    - <the approach, from the technical plan>

    ## Testing
    - AC1 — <criterion>
    - …
    - Red tests: <files>, unchanged since <red sha>
    - Rebased on <default> (<short sha of origin/<default>>): suite, lint, typecheck green
    - Definition of Done: met   (or "none", or "met, except what's under Notes")

    ## Notes
    - Review: <the spec's "Review notes", one line each>   (or "nothing")
    - To check before merging: <the DoD items left to a person or to the pull request, section 4>   (none → drop the line)

## 6. Stop

- Leave the branch as it is: a rebase that went through and a push that went through stay.
- A command fails where it shouldn't (fetch, push, pull request) → stop too, its error verbatim in Items.
- Stopped on a failing suite, lint, typecheck or DoD item → write the Items verbatim at the end of the spec, under `## Ship failures` (an earlier section is replaced). That is how the dev gets them on resume.
- Report, then stop:

      <Title> — stopped at <start|rebase|check|dod|push|pr>, <branch>
      Why      one line
      Items    conflicting files, failures or unmet DoD items, verbatim
      State    rebased on <default> <sha> | not rebased · pushed | not pushed
      Resume   what to fix, then /rs-ship <slug> here

  How to resume, by what failed: a conflict → rebase on `origin/<default>` and resolve it yourself. The red commit not found after the rebase → write its new sha in `red:` yourself. Tests changed since the red commit → undo that change, or set `status: ready` to rework them. The branch's code (a failing check, a DoD item) → set `status: red`: `/rs-build <slug>` hands the Ship failures to the dev and has a new reviewer check the fix. The default branch itself is broken → wait until it's fixed. Then `/rs-ship <slug>` again.

## 7. Done

    <Title> — shipped, <branch>
    PR        <url>
    Criteria  AC1–ACn ✓ · red <sha>
    Checks    suite, lint, typecheck green on <default> <short sha>
    DoD       met   (or "none", or "to check before merging: …")
    Next      review and merge the pull request: that's yours
