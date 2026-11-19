#!/usr/bin/env bash
# PreToolUse hook on Edit and Write, for rstack's agents. A plugin agent can't carry
# its own hooks or permissionMode, so this hook, declared by the plugin, does both
# from the agent_type of the call:
# - rs-reviewer only writes to its memory. Anything else is refused: git can't see
#   what the reviewer would write to the ignored .rstack/ files or outside the repo.
# - rs-tester and rs-dev edit the workspace without a prompt, as acceptEdits would:
#   inside the repo of the session, never under .git/. Elsewhere, the usual prompt.
# Any other agent, or the main session: no decision, the usual permissions apply.

source "$(dirname "$0")/_common.sh" 2>/dev/null || { echo "Blocked: _common.sh not found." >&2; exit 2; }

read_hook_input
AGENT=$(jq -r '.agent_type // empty' <<<"$HOOK_INPUT")
AGENT=${AGENT##*:} # rstack:rs-dev → rs-dev

case "$AGENT" in
  rs-reviewer)
    MESSAGE="the reviewer doesn't fix, it only writes to its memory. Put the problem under \"Blocking\"."
    REAL=$(canonical_path "$HOOK_FILE") || deny "$MESSAGE"
    case "$REAL" in
      */.claude/agent-memory-local/rs-reviewer/*) exit 0 ;;
    esac
    deny "$MESSAGE"
    ;;
  rs-tester | rs-dev)
    REAL=$(canonical_path "$HOOK_FILE") || exit 0
    ROOT=$(git -C "${HOOK_CWD:-$PWD}" rev-parse --show-toplevel 2>/dev/null) || exit 0
    ROOT=$(realpath "$ROOT") || exit 0
    case "$REAL" in
      "$ROOT"/.git/* | "$ROOT"/.git) exit 0 ;;
      "$ROOT"/*) echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","permissionDecisionReason":"rstack: the tester and the dev edit the workspace"}}' ;;
    esac
    exit 0
    ;;
esac
exit 0
