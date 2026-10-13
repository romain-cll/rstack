#!/usr/bin/env bash
# Installs or updates rstack in Claude Code (~/.claude) as symlinks to this repo:
# edits in the repo are live everywhere. Re-run after adding, renaming or
# removing a skill or an agent. To remove rstack: ./uninstall.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")" && pwd -P)"
CLAUDE="$HOME/.claude"
status=0

pretty() { echo "~${1#"$HOME"}"; }

link() { # <source> <destination>
  local src="$1" dst="$2"
  if [ -L "$dst" ]; then
    if [ "$(readlink "$dst")" = "$src" ]; then
      echo "  ok       $(pretty "$dst")"
      return
    fi
    echo "  skipped  $(pretty "$dst") — already links to $(readlink "$dst")" >&2
    status=1
    return
  fi
  if [ -e "$dst" ]; then
    echo "  skipped  $(pretty "$dst") — exists and isn't a link, move it away first" >&2
    status=1
    return
  fi
  ln -s "$src" "$dst"
  echo "  linked   $(pretty "$dst")"
}

prune() { # links to this repo whose target is gone (skill or agent renamed or removed)
  for entry in "$CLAUDE"/skills/* "$CLAUDE"/agents/*; do
    [ -L "$entry" ] && [ ! -e "$entry" ] || continue
    case "$(readlink "$entry")" in
      "$REPO"/*)
        rm "$entry"
        echo "  removed  $(pretty "$entry") — no longer in the repo"
        ;;
    esac
  done
}

[ $# -eq 0 ] || { echo "usage: $0" >&2; exit 2; }

mkdir -p "$CLAUDE/skills" "$CLAUDE/agents" "$CLAUDE/hooks"
prune

echo "skills"
for dir in "$REPO"/skills/rs-*/; do
  [ -d "$dir" ] || continue
  dir="${dir%/}"
  link "$dir" "$CLAUDE/skills/$(basename "$dir")"
done

echo "agents"
for file in "$REPO"/agents/rs-*.md; do
  [ -f "$file" ] || continue
  link "$file" "$CLAUDE/agents/$(basename "$file")"
done

echo "hooks"
link "$REPO/hooks" "$CLAUDE/hooks/rstack"

command -v jq >/dev/null 2>&1 || {
  echo "warning: jq not found — the agents' guards block everything without it (brew install jq)" >&2
  status=1
}

echo
echo "Restart Claude Code: agents are loaded at startup."
exit "$status"
