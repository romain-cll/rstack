#!/usr/bin/env bash
# PreToolUse hook (Edit|Write) of the rs-dev and rs-tester agents: .rs/checks lists
# what the reviewer may run, and no agent of the build writes it. /rs-build writes
# it, the user edits it.

source "$(dirname "$0")/_common.sh" 2>/dev/null || { echo "Blocked: _common.sh not found." >&2; exit 2; }

MESSAGE=".rs/checks lists the commands the reviewer may run: no agent writes it. A check missing or wrong → say so in your report."

read_hook_input
REAL=$(canonical_path "$HOOK_FILE") || deny "unresolved path ($HOOK_FILE). Use an absolute path without \"..\"."

# Case-insensitive: macOS volumes are, .RS/Checks is .rs/checks.
for path in "$HOOK_FILE" "$REAL"; do
  case "$(printf '%s' "$path" | tr '[:upper:]' '[:lower:]')" in
    .rs/checks|*/.rs/checks) deny "$MESSAGE" ;;
  esac
done

exit 0
