#!/usr/bin/env bash
# Installs or updates rstack in Claude Code (~/.claude) by copying skills, agents
# and hooks from this checkout. The copies don't follow the repo: an edit, a
# branch switch or a deleted worktree changes nothing until the next run.
# Re-run to update. To remove rstack: ./uninstall.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")" && pwd -P)"
CLAUDE="$HOME/.claude"
MANIFEST="$CLAUDE/.rstack-manifest" # what rstack installed, one path relative to ~/.claude per line
status=0

pretty() { echo "~${1#"$HOME"}"; }

owned() { grep -Fxq "$1" "$MANIFEST"; }

remove() { # <path relative to ~/.claude> — refuses anything rstack doesn't name
  case "$1" in
    *..*) return 1 ;;
    skills/rs-?* | agents/rs-?*.md | hooks/rstack) rm -rf "$CLAUDE/$1" ;;
    *) return 1 ;;
  esac
}

copy() { # <source> <destination relative to ~/.claude>
  local src="$1" rel="$2" dst="$CLAUDE/$2"
  if { [ -e "$dst" ] || [ -L "$dst" ]; } && ! owned "$rel"; then
    echo "  skipped  $(pretty "$dst") — not installed by rstack, move it away first" >&2
    status=1
    return
  fi
  # Recorded before copying, so an interrupted run can replace it next time.
  owned "$rel" || echo "$rel" >> "$MANIFEST"
  remove "$rel"
  cp -R "$src" "$dst"
  echo "$rel" >> "$MANIFEST.new"
  echo "  copied   $(pretty "$dst")"
}

[ $# -eq 0 ] || { echo "usage: $0" >&2; exit 2; }

mkdir -p "$CLAUDE/skills" "$CLAUDE/agents" "$CLAUDE/hooks"
touch "$MANIFEST"
: > "$MANIFEST.new"

echo "skills"
for dir in "$REPO"/skills/rs-*/; do
  [ -d "$dir" ] || continue
  dir="${dir%/}"
  copy "$dir" "skills/$(basename "$dir")"
done

echo "agents"
for file in "$REPO"/agents/rs-*.md; do
  [ -f "$file" ] || continue
  copy "$file" "agents/$(basename "$file")"
done

echo "hooks"
copy "$REPO/hooks" "hooks/rstack"

# What an earlier install copied and this checkout no longer has (skill or agent renamed or removed).
while IFS= read -r rel; do
  grep -Fxq "$rel" "$MANIFEST.new" && continue
  remove "$rel" && echo "  removed  $(pretty "$CLAUDE/$rel") — no longer in the repo"
done < "$MANIFEST"
mv "$MANIFEST.new" "$MANIFEST"

command -v jq >/dev/null 2>&1 || {
  echo "warning: jq not found — the agents' guards block everything without it (brew install jq)" >&2
  status=1
}

echo
echo "Restart Claude Code: agents are loaded at startup."
exit "$status"
