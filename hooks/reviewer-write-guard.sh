#!/usr/bin/env bash
# PreToolUse hook of the rs-reviewer agent: it only writes to its memory.
# Anything else is refused: git can't see what the reviewer would write to the ignored
# .rstack/ files or outside the repo.

source "$(dirname "$0")/_common.sh" 2>/dev/null || { echo "Blocked: _common.sh not found." >&2; exit 2; }

MESSAGE="the reviewer doesn't fix, it only writes to its memory. Put the problem under \"Blocking\"."

read_hook_input
REAL=$(canonical_path "$HOOK_FILE") || deny "$MESSAGE"

case "$REAL" in
  */.claude/agent-memory-local/rs-reviewer/*) exit 0 ;;
esac

deny "$MESSAGE"
