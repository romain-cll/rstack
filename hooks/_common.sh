# Shared by the guard hooks (sourced, not executed).
# Every refusal exits with code 2: for Claude Code only exit 2 blocks the tool,
# any other non-zero code lets it through.

deny() {
  echo "Blocked: $1" >&2
  exit 2
}

# Reads the hook payload from stdin: HOOK_INPUT (raw JSON) and HOOK_CWD.
read_hook_payload() {
  command -v jq >/dev/null 2>&1 || deny "jq not found, the guard can't check anything."
  HOOK_INPUT=$(cat)
  jq -e 'type == "object"' <<<"$HOOK_INPUT" >/dev/null 2>&1 || deny "unreadable hook input."
  HOOK_CWD=$(jq -r '.cwd // empty' <<<"$HOOK_INPUT")
}

# Same, plus HOOK_FILE: the target of an Edit or a Write.
read_hook_input() {
  read_hook_payload
  HOOK_FILE=$(jq -er '.tool_input.file_path | select(type == "string" and length > 0)' <<<"$HOOK_INPUT" 2>/dev/null) \
    || deny "hook input without file_path."
}

# Absolute path with symlinks resolved, even for a file that doesn't exist yet:
# the OS resolves the deepest existing ancestor, the missing tail is appended as is.
# Rejects any ".." segment, which would allow leaving a directory while keeping its prefix.
canonical_path() {
  local path=$1 tail="" dir
  [[ $path == /* ]] || path="${HOOK_CWD:-$PWD}/$path"
  [[ /$path/ == */../* ]] && return 1
  dir=$path
  while [ ! -e "$dir" ] && [ ! -L "$dir" ]; do
    tail="/$(basename "$dir")$tail"
    dir=$(dirname "$dir")
  done
  dir=$(realpath "$dir" 2>/dev/null) || return 1
  printf '%s%s\n' "${dir%/}" "$tail"
}
