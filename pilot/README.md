# pilot

A pane beside the chat of your "pilot" session: one row per rstack ticket, grouped by who has the ball, the ones waiting for you first. Pressing a row brings its session to the front.

## Install

```sh
claude plugin marketplace add <this repository>
claude plugin install pilot@rstack
```

Then run `/pilot` in the session you want as the pilot. The pane opens, and opens again each time that session starts. Closing the pane stops it. Running `/pilot` again in another session moves the pane there. Sessions that did not run `/pilot` open no pane and poll nothing.

## What it reads

Every 10 seconds, from the pilot session: `git worktree list --porcelain`, the `.rstack/features/` folder of each worktree (`.rs/features/` when `.rstack/` is absent), the sessions the app lists (the pilot reads its own through `get_session`, the list leaves it out), and the questions the ticket sessions publish. Every 60 seconds, `gh pr view <branch>` for a shipped ticket with a branch. The plugin must be loaded in the ticket sessions too: each publishes its pending `AskUserQuestion` to the plugin's store, with its app session id, so a question only counts for the ticket whose session asked it.

## States

First match wins.

| State | Meaning |
|---|---|
| awaiting answer | the session asks a question (shown), or its build or ship stopped |
| shipped | status `shipped`, with or without a session: pull request state and CI |
| no session | no session of the app runs in the ticket's worktree |
| awaiting plan validation | a draft, session stopped |
| planning | a draft, session running |
| review | green, with the review's round, verdict, fixes and cap (3) |
| in dev | status `ready`, `red` or `green` |
| shipping | status `reviewed` |
| no spec | a session in a worktree with no spec |

## What the pane shows

A header with the main checkout's folder name in capitals, the number of rows and a count per section, then the sections, empty ones left out:

| Section | States |
|---|---|
| À toi | awaiting answer, awaiting plan validation, no session: the row waiting longest first, marked with the accent |
| En cours | planning, in dev, review, shipping, no spec |
| PR | shipped |

Each row is two lines. The first has the ticket id (`SPOTIME-192`, taken out of the spec title: `Dashboard (SPOTIME-192)`, `Export CSV — SPOTIME-279`, `SPOTIME-301: Export CSV`, `[SPOTIME-188] Login`) and the name. The second has the state's label, how long the row has waited in À toi (`depuis 12 min`: since its pending question, else since its stopped session last did something), the progress as dots over plan, red, green, review, ship, the review line (`Review 2/3 · fix en cours`) or the PR line (`#412 · CI ✓ · prête à merger`). A pending question is shown under its row.

Pressing a row focuses the ticket's session in the app; when the app refuses, it runs `open` on the session's `claude://` link. The pilot's own row, and a row with no session, are not pressable. Voir le plan shows the spec's user story and acceptance criteria under the row.

There is no control to validate a plan or answer a question from the pane: the app delivers a message sent from another session as a peer's, which a session at a gate does not take as its user's answer. Validate in the ticket's session, which the row opens.

## What the pane hides

- The specs of a worktree whose HEAD is detached with no session matched to it: the app keeps an archived session's worktree in a reuse pool that way, `.rstack/` specs included. Its shipped specs with a branch stay for the rule below to decide from their pull request. With a session matched (a rebase in progress, for example), its tickets are listed.
- A shipped ticket with a branch whose pull request is `MERGED` or `CLOSED`, with or without a session. A pull request `OPEN`, or `gh` failing, keeps it. A `MERGED` or `CLOSED` answer is kept until the pane reloads: `gh` is not asked again for that branch. An `OPEN` or failed one is asked again after 60 seconds.
- The main checkout's session when it has no spec: it is the pilot's own place, not a ticket.

## Checks

```sh
claude plugin validate pilot
npx -y -p typescript@5.6.3 tsc -p pilot
claude plugin test pilot
```
