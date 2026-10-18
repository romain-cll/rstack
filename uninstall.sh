#!/usr/bin/env bash
# Removes rstack from Claude Code: what install.sh copied into ~/.claude, as
# listed in ~/.claude/.rstack-manifest. Nothing else is touched.
set -euo pipefail

CLAUDE="$HOME/.claude"
MANIFEST="$CLAUDE/.rstack-manifest"
removed=0

pretty() { echo "~${1#"$HOME"}"; }

[ $# -eq 0 ] || { echo "usage: $0" >&2; exit 2; }

if [ -f "$MANIFEST" ]; then
  while IFS= read -r rel; do
    case "$rel" in
      *..*) continue ;;
      skills/rs-?* | agents/rs-?*.md | hooks/rstack) ;;
      *) continue ;;
    esac
    [ -e "$CLAUDE/$rel" ] || [ -L "$CLAUDE/$rel" ] || continue
    rm -rf "$CLAUDE/$rel"
    echo "  removed  $(pretty "$CLAUDE/$rel")"
    removed=$((removed + 1))
  done < "$MANIFEST"
  rm -f "$MANIFEST" "$MANIFEST.new"
fi

if [ "$removed" -eq 0 ]; then
  echo "Nothing to remove."
else
  echo
  echo "Restart Claude Code to unload the agents."
fi
