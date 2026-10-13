#!/usr/bin/env bash
# PreToolUse hook of the rs-dev agent: blocks any write related to tests
# (see is_test_path), including the test part of package.json files.

source "$(dirname "$0")/_common.sh" 2>/dev/null || { echo "Blocked: _common.sh not found." >&2; exit 2; }
set -o pipefail

MESSAGE="the dev changes nothing related to tests. If a test looks wrong, stop and report it under \"Blockers\"."

read_hook_input
REAL=$(canonical_path "$HOOK_FILE") || deny "unresolved path ($HOOK_FILE). Use an absolute path without \"..\"."

if is_test_path "$HOOK_FILE" || is_test_path "$REAL"; then
  deny "$MESSAGE"
fi

[[ $REAL == */package.json ]] || exit 0

# Replays the Edit on the current content, as the tool will.
APPLY_EDIT='.tool_input as $t | ($cur | split($t.old_string)) as $parts
  | if ($parts | length) == 1 then $cur
    elif $t.replace_all then $parts | join($t.new_string)
    else $parts[0] + $t.new_string + ($parts[1:] | join($t.old_string)) end'

if [ -f "$REAL" ]; then
  BEFORE=$(jq -S "$PKG_TEST_SECTIONS" "$REAL" 2>/dev/null) || deny "$REAL unreadable, can't check its test part."
else
  BEFORE=$(jq -nS "{} | $PKG_TEST_SECTIONS")
fi

if [ "$(jq -r '.tool_name' <<<"$HOOK_INPUT")" = Write ]; then
  AFTER=$(jq -r '.tool_input.content' <<<"$HOOK_INPUT" | jq -S "$PKG_TEST_SECTIONS" 2>/dev/null)
else
  AFTER=$(jq -r --rawfile cur "$REAL" "$APPLY_EDIT" <<<"$HOOK_INPUT" 2>/dev/null | jq -S "$PKG_TEST_SECTIONS" 2>/dev/null)
fi || deny "resulting package.json unreadable, can't check its test part."

[ "$BEFORE" = "$AFTER" ] || deny "$MESSAGE (package.json: jest/vitest config, test scripts or test dependencies)"

exit 0
