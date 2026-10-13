#!/usr/bin/env bash
# PreToolUse hook (Bash) of the rs-reviewer agent: it checks, it changes nothing.
# Allowlist of read-only commands, everything else is refused. Workable here
# because the reviewer needs few commands, all of them read-only.

source "$(dirname "$0")/_common.sh" 2>/dev/null || { echo "Blocked: _common.sh not found." >&2; exit 2; }

refuse() {
  deny "the reviewer checks, it changes nothing. $1 If a check fails, it's a \"Blocking\" item: not yours to fix."
}

LINT_HINT="Run the linter directly, without --fix (check-only lint commands from the project instructions)."

# Runner options that write (snapshots, reports, fixes, config).
forbid_writing_flags() {
  local word
  for word in "$@"; do
    case "$word" in
      -u|--update*|--output*|-o|--init) refuse "Option $word writes files." ;;
    esac
  done
}

check_tool() {
  local tool=$1
  shift
  forbid_writing_flags "$@"
  if [ "$tool" = tsc ]; then
    case " $* " in *" --noEmit "*) ;; *) refuse "tsc without --noEmit generates files." ;; esac
  fi
}

check_segment() {
  set -f
  # shellcheck disable=SC2086
  set -- $1
  set +f
  [ $# -eq 0 ] && return 0
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
    npm|pnpm)
      case "${1:-}" in run|exec) shift ;; esac
      case "${1:-}" in
        test|test:e2e|test:cov|typecheck) forbid_writing_flags "$@" ;;
        eslint|vitest|jest|tsc) [ "$cmd" = pnpm ] || refuse "npm ${1} is not in the list."; check_tool "$@" ;;
        lint*) refuse "No lint script through $cmd: it may pass --fix. $LINT_HINT" ;;
        *) refuse "\"$cmd ${1:-}\" is not in the list." ;;
      esac ;;
    npx)
      case "${1:-}" in
        eslint|vitest|jest|tsc) check_tool "$@" ;;
        expo) [ "${2:-}" = lint ] || refuse "\"npx expo ${2:-}\" is not in the list." ;;
        *) refuse "\"npx ${1:-}\" is not in the list." ;;
      esac ;;
    *) refuse "\"$cmd\" is not in the allowlist." ;;
  esac
}

read_hook_payload
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
