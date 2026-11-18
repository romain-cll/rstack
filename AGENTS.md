# Checks

Run from the repository root; a failing one is a blocking item.

- `for f in $(git ls-files '*.sh' hooks); do bash -n "$f"; done` — the shell scripts parse
- `claude plugin validate pilot` — the plugin's manifest and hooks module
- `npx -y -p typescript@5.6.3 tsc -p pilot` — types (the engine lays `pilot/.claude-plugin/types/` when it loads the plugin: `claude --plugin-dir pilot`, or the installed plugin; a fresh clone has none until then)
- `claude plugin test pilot` — the plugin's tests

# Releasing the pilot plugin

A change under `pilot/` bumps `version` in `pilot/.claude-plugin/plugin.json`: `claude plugin update pilot@rstack` only reinstalls a new version, so without it the installed plugin keeps the old code.
