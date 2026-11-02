---
name: rs-diagnose
description: Investigate one subject before planning — a problem whose cause must be found (a failing test, a bug, a slowdown) or an area whose state, risks and open questions must be laid out (a module, a dependency, a practice) — and deliver an evidenced report, without fixing anything. Ends on a single gate, in the chat — dig further, or /rs-plan from the report. Use when the user invokes /rs-diagnose, or asks to find the cause of a problem or to assess an area before deciding what to build.
argument-hint: "<subject> [ticket id, links to logs, CI runs, issues]"
---

# rs-diagnose

You investigate one subject and deliver a complete, evidenced study of it. Two kinds of subject:

- a **problem**: a symptom (a failing test, a bug, a slowdown) whose cause must be found;
- an **area**: a module, a dependency, a practice, whose current state, risks and open questions must be laid out.

You never fix anything. A fix, a refactor, a policy decision belong to `/rs-plan`, which starts from your report.

Output: the report, `<diagnoses>/<slug>.md` (section 1), and the instrumentation's patch next to it if you instrumented. Nothing else stays behind: no code change, no branch, no commit, on the working branch or anywhere else.

## Talking to the user

- Speak the user's language. The report is written in English.
- Questions only at the start, to pin down the subject and its scope (section 2): grouped, 3 at most per round, with options and your recommendation. Use the host's question tool if it has one. Never ask to choose a solution: that's `/rs-plan`.
- Once the subject is pinned down, you work alone until the report. Report findings, no narration.

## Evidence

The rules of the whole investigation.

- **Facts and hypotheses are kept apart.** A fact is something observed: a file and line (`path:line`), a log line, a run link, a command and its output, a commit. A hypothesis is an explanation not proven yet.
- **Every claim cites its evidence.** No evidence → it's a hypothesis, and it says so.
- **A hypothesis is never presented as a cause until it is proven.**
- **Every conclusion carries a confidence**:
  - `proven`: the evidence shows it, and its order of events explains every occurrence observed;
  - `likely`: the evidence points to it, a named gap remains;
  - `unknown`: not enough evidence either way.
- **The project's rules on what can run apply**: what may run locally (no stress loop on a shared machine…), on CI, against which environment. No rule for something heavy, shared or outward-facing → don't run it: it's an unknown, with what it would take.
- **You change nothing outside your throwaway branch** (section 5): no data, no deployed environment, no ticket, no setting.

## 1. Start

- Read the project instructions (`AGENTS.md`, `CLAUDE.md`…): what can run where, test commands, environments.
- A ticket id or links (logs, CI runs, issues) → read them, with the host's tools or the forge's CLI (`gh`, `glab`). One can't be read → say so; if it matters, it's an unknown.
- **`<diagnoses>`** is `.rs/diagnoses/` in the clone's main checkout: the first `worktree` of `git worktree list --porcelain` (a `bare` one → the current workspace's root instead). Shared by every workspace of the clone, a report outlives the workspace it was written in. `.rs/.gitignore` missing there → create it containing `*`: diagnoses stay out of git.
- Slug: short, kebab-case, from the subject. `<diagnoses>/<slug>.md` exists → ask: continue that diagnosis, or start a new one under another slug.

## 2. Pin down the subject

Before collecting anything, settle:

- the kind: problem or area;
- the subject, in one sentence: for a problem, the symptom as observed (what, where, how often, since when); for an area, what it covers;
- the scope: what's in, what's out, which environments;
- where you may run things, when the project instructions don't say: locally, on CI through a throwaway branch (section 5).

Anything unclear → ask (Talking to the user). Then no more questions until the gate.

## 3. Collect the facts

Gather before explaining:

- **Symptoms and occurrences**: error messages, failing tests, timings, frequency, first and last seen.
- **Where it happens, where it doesn't**: environments, platforms, configurations, versions, data. The difference between the two often holds the cause.
- **Code paths**: read, never guessed.
- **History**: `git log` and `git blame` on those paths, the change that brought it. A known good point, a known bad one and a check that runs within the project's rules → `git bisect`.
- **For an area**: its structure, how the codebase uses it, its tests, its dependencies (versions, maintenance, known issues, from official sources only), its known problems.

Each fact goes in your notes with its evidence.

## 4. Hypotheses

1. List every hypothesis that would explain the facts; for an area, every risk or open question worth checking.
2. For each one, what would prove it and what would disprove it.
3. Look for that evidence, the cheapest first: the code and its history, then running existing tests or commands, then instrumentation (section 5).
4. Each ends `proven`, `ruled out` (with the evidence that rules it out), or open with its confidence (`likely`, `unknown`).
5. A proven cause comes with its mechanism: the code path, the order of events, why it shows where it does and not elsewhere.

One cause rarely explains everything: a fact a cause doesn't explain is another finding, or an unknown.

## 5. Instrumentation

Only when the evidence is missing and only running the code can give it.

1. The working tree is clean (`git status --porcelain` is empty). Not clean → no instrumentation: those changes are someone's work. It's an unknown, with what it would take.
2. Note the current branch and `HEAD`, then `git switch -c diag/<slug>`.
3. Add the temporary instrumentation (logs, traces, counters, timings), only what the open hypotheses need. No fix, even an obvious one.
4. Commit it on `diag/<slug>`, then run it where the problem happens:
   - locally, within the project's rules;
   - on CI, if the project instructions allow it or the user agreed in section 2: pushing a branch is outward-facing, it runs pipelines and others see it. `git push -u origin diag/<slug>`, wait for the run, read its logs;
   - anywhere you can't reach (a deployed environment, a device, a user's machine) → don't. The patch and the steps to run it go in the unknowns: the user can run it and bring back the output.
5. Record what it showed, with the run link or the command and its output.
6. Save the instrumentation next to the report: `git diff <noted HEAD> diag/<slug> > <diagnoses>/<slug>.patch`. Anyone can apply it again.
7. Drop the branch: `git switch <noted branch>`, `git branch -D diag/<slug>`, and if it was pushed, `git push origin --delete diag/<slug>`. Check: `HEAD` is the noted one, `git status --porcelain` is empty.

## 6. When to stop

Stop when every observed fact is explained by a proven cause (a problem), or every part of the scope is laid out (an area), or when what's left is named in the unknowns, each with what it would take to resolve it: a run, an access, more occurrences, data, someone's knowledge.

Never stop on the first plausible cause while some fact remains unexplained.

## 7. Report

Write `<diagnoses>/<slug>.md` from the template below. Continuing a diagnosis → update it in place and set `updated:`.

## 8. Gate

Present, in the user's language:

    <Subject> — <diagnoses>/<slug>.md

    Kind       problem | area
    Summary    the causes, or the state, 3 lines max
    Findings   F1 — one line — proven | likely | unknown
               F2 — …
    Ruled out  H1, H3 — one line each   (or "none")
    Unknowns   … — to resolve: …   (or "none")
    Options    A — one line · B — one line   (for /rs-plan, not chosen)
    On plan    /rs-plan starts here, from this report

    Dig further, or plan it?

The question in plain text at the end, never through a question tool. Then wait for the user's answer. By answer:

- **Dig further** on a point, or new facts (the output of a run they made) → back to section 3 or 4 on that point, update the report, then the gate again with only what changed.
- **Plan it**, an option named or not → run `/rs-plan <diagnoses>/<slug>.md`, with the option the user named, here. From then on its instructions apply, not these.
- **Nothing to plan, or not now** → stop, with the report's path in one line.

## Report template

    ---
    kind: problem | area
    owner: <git config user.name>
    created: <YYYY-MM-DD>
    updated: <YYYY-MM-DD>
    branch: <branch investigated>
    commit: <short sha of HEAD investigated>   # the path:line references hold at this commit
    ---

    # <Subject>

    ## Subject and scope
    <the subject, one sentence>
    - Occurs: <where, how often, since when>   (a problem)
    - Doesn't occur: <where>   (a problem)
    - In: …
    - Out: …
    - Sources: <ticket, links>   (or drop)

    ## Summary
    <the causes, or the state, in a few lines>

    ## Findings

    ### F1 — <title>
    - What happens: …
    - Cause: the code path (`path:line` → `path:line`) and the order of events:
      1. …
      2. …
    - Evidence: `path:line`, log lines, <run link>, `command` → output
    - Why it shows where it does: … and not elsewhere: …
    - Confidence: proven | likely — missing: … | unknown

    An area's finding: what it is, its state, the risk or the open question, the evidence, the confidence.

    ## Ruled out
    - H1 — <hypothesis> — ruled out by <evidence>
    (or "None")

    ## Unknowns
    - <what isn't known> — to resolve: <what it would take>
    (or "None")

    ## Options for /rs-plan
    - A — <direction> — addresses F1, F2 — + … / − …
    - B — …
    Not chosen here: /rs-plan decides with the user.

    ## Instrumentation
    - <what was added, where it ran, run link> — patch: <slug>.patch
    (or "None")
