---
name: rs-init
description: Set up a repository for rstack, once and idempotently — the state folder, the permissions the pilot's calls need, the Plane project of the pilot's next tickets — so that the pilot's `Lancer` is not refused and no config file is written by hand. Use when the user invokes /rs-init, or asks to "init rstack", "setup rstack" or "configure the pilot".
---

# rs-init

You set up the clone for rstack before its first ticket: the state folder, the permissions the pilot's calls need, the Plane project the pilot reads its next tickets from. Each step reads what is there first and changes only what is missing, so a second run changes nothing.

Output: `.rstack/` with its `.gitignore`, the pilot's tools allowed in `.claude/settings.local.json`, `.rstack/pilot.json` naming the Plane project. All of it at the clone's main checkout, none of it in git. Nothing else: no code, no commit, nothing created or changed in Plane.

## Talking to the user

- Speak the user's language. No intro, no restating the request, no pleasantries.
- A question is rare: the Plane project, nothing else. Use the host's question tool if it has one, with your recommendation. 3 questions at most, grouped.
- Report what happened and what's next. No narration.
- A message to the user is standard markdown: a bold title line, `- **Label:** value` bullets, paths and URLs as links. Never a code block or an indented block, which the app shows in monospace without wrapping, except a command to copy or a code excerpt. The template below is the source to write, shown in a fence: write its content, never the fence. Labels in the user's language.

## Root

The root is the clone's main checkout: the first `worktree` of `git worktree list --porcelain`. The pilot runs there and reads `.rstack/pilot.json` there, so every path below is relative to it, whichever worktree this session is in. Not in a git repository → stop and say so.

## 1. State folder

At the root:

1. `.rs/.gitignore` exists and contains `*`, and `.rstack/` doesn't exist → `mv .rs .rstack`, said in one line (the folder was `.rs/` in an earlier version). Both exist → leave `.rs/` alone, said in one line.
2. `.rstack/` doesn't exist → create it.
3. `.rstack/.gitignore` doesn't exist → create it, containing `*`.

## 2. Permissions

The pilot calls these tools itself (`$.tool.call`), and a call that no rule allows is refused:

- `mcp__ccd_session__start_session`
- `mcp__ccd_window__open_session_in`
- `mcp__ccd_session_mgmt__list_sessions`
- `mcp__ccd_session_mgmt__get_session`
- `mcp__plane__project`
- `mcp__plane__state`
- `mcp__plane__workitem`
- `mcp__plane__workitem_relation`

They go to `.claude/settings.local.json` at the root, `permissions.allow`: the file is local to the clone, never committed.

1. Read it. Absent → `{}`. Not valid JSON → skip this step, say so and what to fix, change nothing.
2. A tool is covered when a rule of `permissions.allow` is its exact name, `mcp__<server>` or `mcp__<server>__*` for its server (`ccd_session`, `ccd_window`, `ccd_session_mgmt`, `plane`). `deny` and `ask` are not read: a tool they hold is still added, the user's rules decide.
3. Append each tool no rule covers to `permissions.allow`, in the order above, creating `permissions` and `allow` if they are missing. Never remove nor reorder a rule, never touch `deny`, `ask` or any other key. Nothing to append → write nothing.
4. Write the JSON back with 2-space indentation and a final newline.
5. Tell the user, in the report, that a rule on an MCP tool covers every action of that tool, writes included: `mcp__plane__workitem` also lets the model create and change Plane work items without asking, in this repository.
6. `git check-ignore -q .claude/settings.local.json` fails (run at the root) → say in one line that the file is not ignored by git and must not be committed. Never commit, never change a `.gitignore` for it.

User settings (`~/.claude/settings.json`) and committed project settings (`.claude/settings.json`) are never written.

## 3. Plane project

The pilot lists the tickets to launch next from one Plane project, named by its identifier in `.rstack/pilot.json`:

```json
{ "plane": { "project": "<IDENTIFIER>" } }
```

1. The `mcp__plane__project` tool is not in this session (the Plane MCP is not connected) → skip, said in one line: the pilot's `À lancer` section stays empty until a later `/rs-init` with the MCP connected. Never ask the identifier by hand.
2. Read `.rstack/pilot.json` (absent → no config; not valid JSON → stop this step, say so, change nothing). Call `project list`.
3. The file holds `plane.project`:
   - it is the identifier of one of the listed projects → keep it, said in one line;
   - it is not → ask which project, as in 4.
4. No config → ask which project. One project listed → propose it. Several → recommend the one whose identifier the repository's instructions (`AGENTS.md`, `CLAUDE.md`) or the branch names (`git branch -a`, `<IDENTIFIER>-<n>`) use, and none when nothing points to one. No project listed → skip, said in one line.
5. Write `plane.project` with the chosen identifier (the project's `identifier`, not its name or id), keeping every other key of the file, 2-space indentation, final newline.

Plane is only read here: nothing is created or changed there.

## 4. Report

```markdown
**rs-init** — <root folder name>
- **State folder:** created | renamed from `.rs/` | already there
- **Permissions:** <n> rules added to `.claude/settings.local.json` | already allowed
- **Plane:** `<IDENTIFIER>` set | kept | skipped, <why>
- **Next:** `/pilot` in the main checkout's session; already open → close the pane and run `/pilot` again
```

- Add a bullet for each warning of the steps above: a rule on `mcp__plane__workitem` that also covers writes, a settings file git doesn't ignore, an `.rs/` left alone.
- A step that stopped (invalid JSON) → its bullet says why and what to fix, the other steps still ran.
- A rerun where nothing changed → one line, `Nothing to change: <root folder name> is already set up.`, instead of the bullets, with the warnings still listed.
