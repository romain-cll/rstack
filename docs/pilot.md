# pilot pane

A pane beside the chat of your "pilot" session: one row per rstack ticket, grouped by who has the ball, the ones waiting for you first. Pressing a row brings its session to the front.

## Install

The pane comes with the rstack plugin: see the [README](../README.md#install).

Then run `/pilot` in the session you want as the pilot. The pane opens, and opens again each time that session starts. Closing the pane stops it. Running `/pilot` again in another session moves the pane there. Sessions that did not run `/pilot` open no pane and poll nothing.

## What it reads

Every 10 seconds, from the pilot session: `git worktree list --porcelain`, the `.rstack/features/` folder of each worktree (`.rs/features/` when `.rstack/` is absent), the sessions the app lists (the pilot reads its own through `get_session`, the list leaves it out), and the questions the ticket sessions publish. Every 60 seconds, for a shipped ticket with a branch, the pull request or merge request: `glab mr view <branch> -F json` when the worktree's `origin` is on gitlab.com, `gh pr view <branch>` otherwise. The rstack plugin must be loaded in the ticket sessions too: each publishes its pending `AskUserQuestion` to the plugin's store, with its app session id, so a question only counts for the ticket whose session asked it.

## The next tickets, from Plane

Optional. With a `.rstack/pilot.json` in the main checkout (the first worktree of `git worktree list --porcelain`; `.rs/pilot.json` when `.rstack/` is absent) that names the Plane project by its identifier, the pane lists the 5 tickets to launch next:

```json
{ "plane": { "project": "SPOTIME" } }
```

Without that file, or without `plane.project`, no Plane tool is called and the section does not show. The file is local to each clone: `.rstack/` stays out of git. The Plane MCP server must be named `plane` in your settings (the pane calls `mcp__plane__*`), and the pane never writes to Plane.

What it reads, through the Plane MCP: the project id (`project list`) and its states (`state list`) once per pane load; the open work items (`workitem list`, PQL `stateGroup IN ("backlog", "unstarted") AND NOT isEpic()`, every page) at most every 60 seconds; the relations of each item (`workitem_relation list`) at most every 5 minutes. `Actualiser` reads them all again at once. A read that fails leaves the last list as it was.

A candidate is a backlog or unstarted item, not a draft, whose every `blocked_by` item is completed or cancelled. The rows come by priority (urgent, high, medium, low, none), then by the number of open items they block (most first), then by sequence number. A ticket whose id (`SPOTIME-42`, any case) is in a spec title, a worktree path, the title of a session not archived, or was launched from the pane since it loaded, is left out and the next one takes its place.

Each row shows its id, its name, a one-line summary, and `débloque <ids>`. The summary is written by Haiku (`$.model.complete`) from the name and the description, kept per id and `updated_at`; when the call is not answered, the row has none and the call is made again at the next poll.

`Lancer` starts a session through `start_session` (a fresh worktree on the lowercased id) whose prompt starts with `/rs-plan <ID> — <name>`, followed by the ticket's description. The row leaves at once. When the app refuses (denied, or an error), the pilot session is asked to start the session itself and to report the refusal as a pane defect.

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

The pane is drawn in two ways, by where the desktop seats it: a dock view, and a widget view when the person minimizes it to a widget.

### Dock view

- A header: `Pilot` and the main checkout's folder name, on the right `collecte à <HH:MM>` (the local time of the last collect) and a `Actualiser` Button that collects at once, without waiting for the 10 s tick.
- Four tiles: `t'attendent` (rows in À toi), `en dev` (the other rows of En cours), `en review`, `PR ouvertes`.
- The sections, empty ones left out, each row a card with a colored edge:

| Section | States | Card |
|---|---|---|
| À toi | awaiting answer, awaiting plan validation, no session: the row waiting longest first | `warning` edge; the id and name; the pending question, else `Plan prêt · <n> critères · <n> fichiers`, else the state's label; `depuis 12 min`; an action Button |
| En cours | planning, in dev, review, shipping, no spec | edge colored by the step (red `error`, green `success`, review `suggestion`, plan and ship `inactive`); a short status on the right (`rouge · 6 critères`, `vert · en dev`, `review 2/3 · 1 fix`); five progress segments over plan, red, green, review, ship |
| PR | shipped | one bordered list: `#412` or `!100`, the name, the CI state (`✓`, `◷`, `✕`) and the `PR` or `MR` link |

The ticket id (`SPOTIME-192`) is taken out of the spec title: `Dashboard (SPOTIME-192)`, `Export CSV — SPOTIME-279`, `SPOTIME-301: Export CSV`, `[SPOTIME-188] Login`.

Pressing the name of an En cours or PR row focuses the ticket's session in the app; when the app refuses, it runs `open` on the session's `claude://` link. The pilot's own row, and a row with no session, are not pressable.

### Hotkeys

A row in À toi with a session has an action Button, `Répondre` or `Voir le plan`, that opens the session the same way. They take the hotkeys `1`, `2`, … in the order of the rows (up to 9), pressed while the pane holds the focus. A row with no session has none.

### Widget view

`Pilot` and a `<n> à toi` pill, a row of squares (one per ticket, colored as its edge: `warning` in À toi, `success` for a PR), and one line for the first row of À toi: `<id> attend une réponse` or `attend la validation du plan`.

There is no control to validate a plan or answer a question from the pane: the app delivers a message sent from another session as a peer's, which a session at a gate does not take as its user's answer. Validate in the ticket's session, which the action Button opens.

## What the pane hides

- The specs of a worktree whose HEAD is detached with no session matched to it: the app keeps an archived session's worktree in a reuse pool that way, `.rstack/` specs included. Its shipped specs with a branch stay for the rule below to decide from their pull request. With a session matched (a rebase in progress, for example), its tickets are listed.
- A shipped ticket with a branch whose pull request (or GitLab merge request) is `MERGED` or `CLOSED`, with or without a session. A pull request `OPEN`, or `gh` or `glab` failing, keeps it. A `MERGED` or `CLOSED` answer is kept until the pane reloads: it is not asked again for that branch. An `OPEN` or failed one is asked again after 60 seconds.
- The main checkout's session when it has no spec: it is the pilot's own place, not a ticket.

## Checks

```sh
claude plugin validate plugin
npx -y -p typescript@5.6.3 tsc -p plugin
claude plugin test plugin
```
