#!/usr/bin/env bash
# Removes the copies an old install.sh put into ~/.claude, as listed in
# ~/.claude/.rstack-manifest, before moving to the rstack plugin: left in place,
# they would shadow the plugin's skills and agents. Nothing else is touched.
# Goes away once no machine has those copies left.
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
  echo "Restart Claude Code to unload the agents, then install the plugin: claude plugin install rstack@rstack"
fi
