#!/usr/bin/env bash
# Removes rstack from Claude Code: every link in ~/.claude pointing to this repo.
# Nothing else is touched.
set -euo pipefail

REPO="$(cd "$(dirname "$0")" && pwd -P)"
CLAUDE="$HOME/.claude"
removed=0

pretty() { echo "~${1#"$HOME"}"; }

[ $# -eq 0 ] || { echo "usage: $0" >&2; exit 2; }

for entry in "$CLAUDE"/skills/* "$CLAUDE"/agents/* "$CLAUDE/hooks/rstack"; do
  [ -L "$entry" ] || continue
  case "$(readlink "$entry")" in
    "$REPO"/*)
      rm "$entry"
      echo "  removed  $(pretty "$entry")"
      removed=$((removed + 1))
      ;;
  esac
done

if [ "$removed" -eq 0 ]; then
  echo "Nothing to remove."
else
  echo
  echo "Restart Claude Code to unload the agents."
fi
