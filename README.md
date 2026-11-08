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

## Per project: `.rs/checks`

The reviewer runs the suite, lint and typecheck itself, whatever the stack: each project declares its check-only commands in `.rs/checks`, one per line, and the reviewer's guard allows those and read-only commands, nothing else. A line allows extra arguments, never another script (`npm test` allows `npm test -- auth`, not `npm test:update`); `--fix`, options that write and redirections stay refused. `/rs-build` writes the file from the project instructions when it's missing and shows it to you; edit it if a line is wrong.

```
# .rs/checks
bun run typecheck
bun run test
bunx turbo run typecheck test
```

Details: [docs/process.md](docs/process.md#feature-state--rs).
