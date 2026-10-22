---
name: rs-plan
description: Turn a feature request into a ready-to-build spec — user story, testable acceptance criteria, scope, technical plan — validated by the user in a single gate, whose ok starts /rs-build. Use when the user invokes /rs-plan or asks to spec or plan a feature before building it.
argument-hint: "<feature description>"
---

# rs-plan

You turn a feature request into a spec that `/rs-build` can execute without asking anyone anything. You work with the user until the spec is ready, then hand it to `/rs-build`.

Output: `.rs/features/<slug>.md` with `status: ready`. Nothing else: no code, no tests, no branch, no commit. Building is `/rs-build`'s job, started by the user's ok.

## Talking to the user

- Speak the user's language. No intro, no restating the request, no pleasantries.
- Questions come grouped, 3 at most per round, with options and your recommendation when there are options. Use the host's question tool if it has one.
- Closed question → one line. Open question → 5 bullets at most.

## 1. Understand

- Read the project instructions (`AGENTS.md`, `CLAUDE.md`): conventions, test and lint commands, Definition of Done.
- Explore the code just enough to ask the right questions: where the feature lives, a similar feature already built, the patterns in place.
- Clarify with the user: who, what, why, edge cases, what's out. Stop asking when every criterion can be written as Given / When / Then.

## 2. Write the spec

- Slug: short, kebab-case. If `.rs/features/<slug>.md` already exists → ask.
- `.rs/` stays out of git: if `.rs/.gitignore` doesn't exist, create it containing `*`.
- Write it from the template below, `status: draft`.
- The spec is written in English, whatever language you speak with the user. Frontmatter keys and status values stay exactly as in the template: tools read them.

## 3. Design the technical plan

You are now the architect. Read-only: you change nothing but the spec.

- Explore the code: structure, patterns, naming, the closest existing feature.
- Design the smallest solution that satisfies every criterion.
- Follow the existing architecture. Reuse the patterns already there rather than introducing new ones.
- No abstraction "for later". If no criterion requires it, it doesn't exist.
- A new dependency is an open decision, always with the dependency-free alternative.
- Designing reveals a hole in the spec → back to the user. Never guess.
- Web lookups only for the official docs of a library or an API.
- Test each criterion at the lowest level that can observe its result: unit before integration, integration before e2e. e2e only for what only the whole path shows.
- One mode — a way the code is launched: environment, platform, configuration. Several only for a criterion whose result differs between them, and only those.
- Fill the "Technical plan" section of the spec.

## 4. Definition of Ready

The spec is ready when:

- every criterion is testable: Given / When / Then with an observable result, no vague word ("fast", "intuitive", "user-friendly"…);
- out of scope is explicit;
- every criterion is covered by at least one task and has a test level, the lowest that observes it, in one mode unless its result depends on the mode;
- every open decision has options and a recommendation;
- nothing else is left open.

Fix whatever fails before the gate.

## 5. Gate

Present the spec in this shape, nothing more:

    <Title> — .rs/features/<slug>.md

    Story       As a …, I want …, so that …
    Criteria    AC1 — …
                AC2 — …
    Out         …
    Approach    3 lines max
    Size        n tasks, n files
    Tests       n unit · n integration · n e2e, one mode   (or the modes, and the criteria that need them)
    Decide      <question> — recommended: <option>, because …   (or "nothing")
    Risks       …   (or "none")
    On ok       the spec goes ready and /rs-build starts here, without you

Wait for an explicit ok. Changes requested → update the spec, check the DoR again, present only what changed.

On ok:

1. Move each open decision, as settled, to "Decisions" with today's date; remove "Open decisions".
2. Set `status: ready`.
3. Run `/rs-build <slug>`, here. From then on its instructions apply, not these: the user has left.

An ok that holds the build back ("ok, not now") → stop after 2, with `/rs-build <slug>` as the next step, in one line.

## Spec template

    ---
    status: draft
    owner: <git config user.name>
    created: <YYYY-MM-DD>
    ---

    # <Title>

    ## User story
    As a <role>, I want <action>, so that <benefit>.

    ## Acceptance criteria
    - [ ] AC1 — Given <context>, when <action>, then <observable result>

    ## Out of scope
    - …

    ## Constraints
    - … (or "None")

    ## Technical plan

    ### Approach
    3 lines max.

    ### Files
    - created: path — role
    - modified: path — what changes

    ### Tasks (ordered)
    1. <task> — covers AC1, AC2

    ### Test strategy
    - AC1 → unit | integration | e2e — what is checked   (integration, e2e: why a lower level can't see it)
    - Modes: one   (or <modes> for AC2, AC5 — how the result differs between them)

    ### Open decisions
    - <question> — options: A / B — recommended: A, because …

    ### Risks
    - … (or "None")

    ## Decisions
    - <YYYY-MM-DD> — <decision> (validated by <owner>)
