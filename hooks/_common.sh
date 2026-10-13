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

# True if the (absolute) path touches tests: test files, test support (setup, mocks,
# fixtures, helpers), runner config, guards that run the tests.
# Case-insensitive: macOS volumes are, FOO.SPEC.TS is foo.spec.ts.
is_test_path() {
  local path
  path=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  case "$path" in
    # Test files
    */test/*|*/tests/*|*/__tests__/*|*.test.*|*.spec.*|*-spec.*|*_test.go|*/test_*.py|*_test.py|*.snap) return 0 ;;
    # Support: setup, helpers, mocks, fixtures
    */__mocks__/*|*/__fixtures__/*|*/__snapshots__/*|*/fixtures/*|*/testing/*|*/test-utils*|*/testutils*|*/setuptests.*|*/conftest.py) return 0 ;;
    # Runner config
    */jest.*|*/jest-*|*/vitest.*|*/playwright.config.*|*/cypress.config.*|*/cypress/*|*/e2e/*|*/pytest.ini|*/tsconfig.spec.json|*/tsconfig.test.json) return 0 ;;
    # Guards that run the tests
    */.husky/*|*/.gitlab-ci.yml|*/.github/workflows/*) return 0 ;;
  esac
  return 1
}

# jq filter: the test part of a package.json (jest/vitest config, test scripts,
# test dependencies). package.json mixes dependencies and test config: only this part
# is compared before and after, the rest of the file stays editable.
PKG_TEST_SECTIONS='{
  jest, vitest,
  scripts: (.scripts // {} | with_entries(select(.key | test("test|spec|e2e|cov|jest|vitest"; "i")))),
  deps: ([.dependencies, .devDependencies] | map(. // {}) | add
    | with_entries(select(.key | test("jest|vitest|testing-library|supertest|playwright|cypress|msw"; "i"))))
}'
