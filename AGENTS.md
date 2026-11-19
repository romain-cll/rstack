# Checks

Run from the repository root; a failing one is a blocking item.

- `for f in $(git ls-files '*.sh'); do bash -n "$f"; done` — the shell scripts parse
- `claude plugin validate plugin` — the plugin's manifest, hooks, skills and agents
- `npx -y -p typescript@5.6.3 tsc -p plugin` — types (the engine lays `plugin/.claude-plugin/types/` when it loads the plugin: `claude --plugin-dir plugin`, or the installed plugin; a fresh clone has none until then)
- `claude plugin test plugin` — the plugin's tests

# Releasing the rstack plugin

Everything rstack ships lives under `plugin/`: skills, agents, hooks, the pilot pane. A change there bumps `version` in `plugin/.claude-plugin/plugin.json`: `claude plugin update rstack@rstack` only reinstalls a new version, so without it the installed plugin keeps the old code.
