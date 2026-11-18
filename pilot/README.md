# pilot

A pane beside the chat of your "pilot" session: one row per rstack ticket, the ones waiting for you first, each with an Open session button that brings its session to the front.

## Install

```sh
claude plugin marketplace add <this repository>
claude plugin install pilot@rstack
```

Then run `/pilot` in the session you want as the pilot. The pane opens, and opens again each time that session starts. Closing the pane stops it; `/pilot` in another session moves it there. Sessions that did not run `/pilot` open no pane and poll nothing.

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

## What the pane hides

- A worktree whose HEAD is detached with no session matched to it: the app keeps an archived session's worktree in a reuse pool that way, `.rstack/` specs included. With a session matched (a rebase in progress, for example), its tickets are listed.
- A shipped ticket with a branch whose pull request is `MERGED` or `CLOSED`, with or without a session. A pull request `OPEN`, or `gh` failing, keeps it.

Open session focuses the ticket's session in the app (the pilot's own row has no button); when the app refuses, it runs `open` on the session's `claude://` link.

## Checks

```sh
claude plugin validate pilot
npx -y -p typescript@5.6.3 tsc -p pilot
claude plugin test pilot
```
