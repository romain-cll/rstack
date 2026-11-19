# rstack

A Claude Code plugin to build features with several coding agents on the same repo, solo or as a team: from a spec you validate to a pull request you merge, tests first.

## Install

```sh
claude plugin marketplace add romain-cll/rstack
claude plugin install rstack@rstack
```

Restart Claude Code. To update: `claude plugin update rstack@rstack`.

Coming from an earlier `./install.sh`: run `./uninstall.sh` from this repository first. It removes the copies it put in `~/.claude`, which would shadow the plugin's skills and agents. Coming from the `pilot` plugin: `claude plugin uninstall pilot@rstack`, the pane is now part of `rstack`.

The reviewer's write guard needs `jq`.

## What's in it

| | |
|---|---|
| `/rs-diagnose` | finds the cause of a problem, or lays out the state of an area, before planning |
| `/rs-plan` | turns a request into a spec you validate: story, acceptance criteria, technical plan |
| `/rs-build` | builds it without you: failing tests, implementation, review, with capped fix rounds |
| `/rs-ship` | rebases, runs the checks again, opens the pull request; the merge is yours |
| `/rs-explain` | turns an explanation into a visual |
| agents | `rs-tester`, `rs-dev`, `rs-reviewer`, launched by `/rs-build` |
| `/pilot` | a pane beside the chat that shows where every ticket stands and which one waits for you: [docs/pilot.md](docs/pilot.md) |

When another skill or command already uses one of these names, call it with the plugin's prefix: `/rstack:rs-build`.

The process, step by step: [docs/process.md](docs/process.md).

## What a project provides

rstack installs once per machine; a project provides its own instructions (`AGENTS.md` / `CLAUDE.md`): the test, lint and typecheck commands, and the Definition of Done. The agents use the session's tools, whatever the stack, and the reviewer runs the checks itself, check-only, from those instructions, else from the project's manifest or scripts (`package.json`, `Makefile`, `Cargo.toml`, `pyproject.toml`…). A check it can't run is a blocking item.

rstack keeps its state in `.rstack/` at the project root, out of git: specs, review histories, diagnoses, visuals.

Details: [docs/process.md](docs/process.md#feature-state--rstack).

## Host

Claude Code only. rstack relies on its subagents, hooks and plugin system; no other host is planned.
