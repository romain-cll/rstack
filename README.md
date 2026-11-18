# rstack

Skills, agents and guardrails to build features with several coding agents on the same repo, solo or as a team: from a spec you validate to a pull request you merge, tests first.

## Compatibility

| Host | Status |
|---|---|
| Claude Code | supported |
| OpenCode | planned |
| Hermes | planned |
| Codex | planned |

Process and install: [docs/process.md](docs/process.md).

## What a project provides

rstack installs once per machine; a project provides its own instructions (`AGENTS.md` / `CLAUDE.md`): the test, lint and typecheck commands, and the Definition of Done. The agents use the session's tools, whatever the stack, and the reviewer runs the checks itself, check-only, from those instructions, else from the project's manifest or scripts (`package.json`, `Makefile`, `Cargo.toml`, `pyproject.toml`…). A check it can't run is a blocking item.

rstack keeps its state in `.rstack/` at the project root, out of git: specs, review histories, diagnoses, visuals.

Details: [docs/process.md](docs/process.md#feature-state--rstack).
