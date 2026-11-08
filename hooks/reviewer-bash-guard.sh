#!/usr/bin/env bash
# PreToolUse hook (Bash) of the rs-reviewer agent: it checks, it changes nothing.
# Allowlist of read-only commands, plus the check-only commands the project
# declares in .rs/checks; everything else is refused. Workable here because the
# reviewer needs few commands, all of them read-only.

source "$(dirname "$0")/_common.sh" 2>/dev/null || { echo "Blocked: _common.sh not found." >&2; exit 2; }

refuse() {
  deny "the reviewer checks, it changes nothing. $1 If a check fails, it's a \"Blocking\" item: not yours to fix."
}

# Check-only commands are declared by the project, one per line, in .rs/checks:
# the guard knows no package manager or runner of its own. A line allows the
# command and any extra arguments, never a different script ("npm test" allows
# "npm test -- auth", not "npm test:update").
# Read at the project root ($CLAUDE_PROJECT_DIR), whatever the command's cwd.
CHECKS_FILE=.rs/checks

LINT_HINT="Run the check-only lint command declared in $CHECKS_FILE."

# Runner options that write (snapshots, reports, fixes, config).
forbid_writing_flags() {
  local word
  for word in "$@"; do
    case "$word" in
      -u|--update*|--output*|-o|--init) refuse "Option $word writes files." ;;
    esac
  done
}

is_declared_check() {
  local segment=$1 line
  [ -f "$CHECKS_PATH" ] || return 1
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%%#*}
    # Words joined by single spaces, like the segment: spacing and CRLF don't matter.
    # shellcheck disable=SC2086
    set -f; set -- ${line//$'\r'/}; set +f
    line=$*
    [ -z "$line" ] && continue
    case "$segment " in "$line "*) return 0 ;; esac
  done <"$CHECKS_PATH"
  return 1
}

not_allowed() {
  if [ -f "$CHECKS_PATH" ]; then
    refuse "\"$1\" is neither a read-only command nor a check declared in $CHECKS_FILE."
  fi
  refuse "\"$1\" is not a read-only command, and the project has no $CHECKS_FILE. Declaring it isn't yours either: /rs-build writes it, one check-only command per line (e.g. \"npm test\"), and the user can edit it. Report the check you couldn't run."
}

check_segment() {
  set -f
  # shellcheck disable=SC2086
  set -- $1
  set +f
  [ $# -eq 0 ] && return 0
  if is_declared_check "$*"; then
    forbid_writing_flags "$@"
    return 0
  fi
  local cmd=$1 word
  shift
  case "$cmd" in
    cd|pwd|ls|cat|head|tail|wc|grep|diff|jq|echo|printf|true) ;;
    find)
      for word in "$@"; do
        case "$word" in
          -delete|-exec|-execdir|-ok|-okdir|-fprint|-fprint0|-fprintf|-fls) refuse "find $word modifies or executes." ;;
        esac
      done ;;
    git)
      while [ "${1:-}" = -C ] || [ "${1:-}" = --no-pager ]; do
        [ "$1" = -C ] && shift
        shift
      done
      case "${1:-}" in
        diff|log|show|status|rev-parse|ls-files|ls-tree|blame|merge-base|cat-file|grep|shortlog|describe|rev-list|name-rev) ;;
        *) refuse "git ${1:-} is not in the list of read-only subcommands." ;;
      esac
      for word in "$@"; do
        case "$word" in
          --output*|-O*|--open-files-in-pager*) refuse "git $word writes a file or launches a program." ;;
        esac
      done ;;
    *) not_allowed "$cmd${*:+ $*}" ;;
  esac
}

read_hook_payload
CHECKS_PATH="${CLAUDE_PROJECT_DIR:-${HOOK_CWD:-.}}/$CHECKS_FILE"
CMD=$(jq -er '.tool_input.command | select(type == "string" and length > 0)' <<<"$HOOK_INPUT" 2>/dev/null) \
  || deny "hook input without a command."

# Checks on the raw text, before any splitting.
case "$CMD" in *'`'*|*'$('*|*'<('*|*'>('*) refuse "No command substitution (\$(…), backticks, <(…))." ;; esac
case "$CMD" in *--fix*) refuse "No --fix. $LINT_HINT" ;; esac
case "$CMD" in *\"-*|*\'-*) refuse "No quoted options." ;; esac

# Quoted strings are arguments: neutralise them to analyse the structure.
BARE=$(printf '%s' "$CMD" | sed -e "s/'[^']*'/ARG/g" -e 's/"[^"]*"/ARG/g')
case "$BARE" in *\'*|*\"*|*\\*) refuse "Quotes or escapes that can't be analysed." ;; esac

# Only redirections to /dev/null and 2>&1 are allowed.
BARE=$(printf '%s' "$BARE" | sed -E -e 's/[0-9]*>&[0-9]//g' -e 's#(&|[0-9]*)>{1,2} */dev/null##g')
case "$BARE" in *'>'*) refuse "No redirection to a file." ;; esac

# Every link of a chain (;, &&, ||, |, &) must be in the list.
while IFS= read -r segment; do
  check_segment "$segment"
done < <(printf '%s\n' "$BARE" | tr ';|&' '\n\n\n')

exit 0
