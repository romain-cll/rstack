---
name: rs-explain
description: Explain something visually — a clean, airy diagram, schema or chart rendered as an artifact instead of more text. Use when the user invokes /rs-explain, asks for a diagram, schema, chart or visual explanation ("fais-moi un schéma", "explain it with a diagram"), or says a text explanation is hard to follow.
argument-hint: "[what to explain — defaults to the last explanation]"
---

# rs-explain

Text wasn't enough. You produce a visual that makes the point obvious at a glance, then you get out of the way.

## 1. Pin down the question

- The subject is whatever comes with the call. Nothing → the last thing you explained, or the point under discussion.
- Name, for yourself, the one question the visual answers. Several questions are really needed → several visuals stacked in the same page, one `.rs-section` each.
- Ground it. If it's about code, read the code first and use its real names (files, functions, tables, endpoints). Never invent structure to get a nicer picture.

## 2. Pick the form

| The question | The form |
|---|---|
| How does it unfold? | flow, top → bottom |
| Who calls whom, in what order? | sequence: actors as columns, messages going down |
| How is it organised? | stacked layers or nested groups |
| What states does it go through? | lifecycle, top → bottom |
| Which option? What changed? | side by side, or before → after |
| When? | vertical timeline |
| How much? | chart, honest axes, values labelled |
| Why this branch? | decision tree, top → bottom |

## 3. Content: only what's needed

- Every element earns its place by answering the question. If removing it loses nothing, remove it.
- Text in the user's language.
- Labels are a few words, never sentences. No paragraphs.
- Title: the question, or the takeaway. One optional subtitle line.
- A short note only where a label alone would mislead.
- One thing stands out (accent): the thing that matters. Everything else stays neutral.

## 4. Design

- **Vertical first.** The chat preview is a narrow column read by scrolling: flow top to bottom, stack sections. Go horizontal only for content that is side by side by nature (2–3 options compared, sequence actors) and keep it within ~640px.
- **Airy.** Generous space between elements, nothing cramped.
- One accent colour plus neutrals. The alert colour only for a stop, a human gate or a risk. No gradients, shadows, icons or decoration.
- Same shape = same kind of thing.
- Readable in light and dark.
- Start from [assets/base.html](assets/base.html): keep its `<style>` (tokens + components, listed in its header comment), replace the body. Extend the CSS with the same tokens when the form needs it; inline SVG for curves or arrows CSS can't draw.
- Self-contained: one HTML file, inline CSS and SVG, no external requests.

## 5. Render

1. The host has an artifact or HTML-render tool (Artifact in the Claude desktop app, artifacts on claude.ai, `html_render` in T3 Code…) → preview it if the host can, fix what reads badly, then publish it there. Follow the host's layout rules when it states some.
2. Otherwise → write `.rs/explain/<slug>.html` at the project root (`~/.rs/explain/` outside a project). If `.rs/explain/.gitignore` doesn't exist, create it containing `*`. Open the file: `open` (macOS), `xdg-open` (Linux), `start ""` (Windows). Remote or headless session → just give the path.
3. Neither is possible → a Mermaid diagram in the reply, same rules.

## 6. Reply

One or two lines at most: only what the visual doesn't say (a caveat, the obvious next question). Never describe or repeat it.
