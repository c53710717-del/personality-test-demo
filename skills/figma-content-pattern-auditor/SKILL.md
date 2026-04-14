---
name: figma-content-pattern-auditor
description: Audit Figma copy against a content-design standard after the user links Figma. Use this skill when the task is to review UI copy in Figma, produce a document with the original text, issues, suggested replacements, and clickable edit links, or optionally apply approved copy updates through a writable Figma integration.
---

# Figma Content Pattern Auditor

## Overview

Use this skill to do a fast v1 audit of product copy inside Figma, then return a simple report with the original copy, the issue, a suggested rewrite, and a link back to the Figma node.

The canonical reference for this skill is the Zoom content-patterns page:
`https://sites.google.com/zoom.us/design-system/principles-and-guidelines/content-guidelines/content-patterns`

That page may require Google authentication. If the page contents are not directly readable, use the baseline checklist in [references/audit-checklist.md](references/audit-checklist.md) and the practical UI copy rules in [references/ui-english-guidelines.md](references/ui-english-guidelines.md), clearly note that the checklist is a fallback interpretation, and ask the user to paste the protected guidance if they want a stricter audit.

## When To Use This Skill

- A user wants to review copy in Figma after connecting the Figma app or connector.
- A user wants a quick scan and quick fixes, not a full content-strategy review.
- A user wants clickable links back to the exact Figma nodes that need editing.
- A user wants a simple patch payload they can apply or copy.

## V1 Scope

This first version is intentionally narrow.

Do:
- scan selected Figma copy
- flag obvious clarity, CTA, error-state, tone, and consistency issues
- suggest short rewrites
- generate a markdown report
- generate a lightweight patch payload
- focus on user-facing copy inside the designed experience, not design annotations

Do not overreach:
- do not pretend to fully enforce the protected Zoom page if it is not readable
- do not do a full UX-writing strategy review unless the user explicitly asks
- do not auto-apply changes unless writable Figma tooling is clearly available
- do not spend time reviewing redlines, measurements, handoff notes, or reviewer comments unless the user explicitly asks

## Workflow

1. Confirm the source material.
   If Figma tools are available, load the file, page, or selection the user wants reviewed. Prefer the narrowest scope that matches the request.

2. Build a text inventory.
   Extract text nodes together with:
   - file key or file URL
   - page name
   - frame or section name
   - node id
   - node name
   - original text

3. Filter out noise.
   Ignore lorem ipsum, repeated placeholder tokens, hidden layers, or decorative text that is clearly not product copy.
   Also ignore annotation-heavy text such as:
   - redline labels
   - spacing and measurement notes
   - developer handoff notes
   - review comments pasted onto the canvas
   - spec text like `H1 32px`, `8pt grid`, `padding 16`, `TODO`, `Note:`, `hover`, `disabled`, `default`
   - layer groups or pages clearly named `spec`, `annotate`, `handoff`, `redlines`, `notes`, or `dev`

4. Separate design-surface copy from support text.
   Prioritize text that a real end user would see in the shipped UI:
   - page titles
   - section headers
   - CTA buttons
   - form labels
   - helper text
   - placeholders
   - table empty states
   - success, error, warning, and confirmation messages
   - dialogs, toasts, banners, menus, and settings descriptions

   De-prioritize or skip:
   - component documentation on the canvas
   - examples meant only for design review
   - token names
   - accessibility notes written for designers
   - duplicated reference text outside the actual screen frame

5. Audit each text string.
   Use the checklist in [references/audit-checklist.md](references/audit-checklist.md) and [references/ui-english-guidelines.md](references/ui-english-guidelines.md). For each issue, capture:
   - severity: `high`, `medium`, or `low`
   - problem
   - suggested rewrite
   - guideline anchor or category

6. Generate the report document.
   Produce a JSON findings payload matching [references/report-schema.md](references/report-schema.md), then render it with:

   ```bash
   python3 scripts/render_report.py --input findings.json --output report.md
   ```

7. Offer quick fixes.
   If the active Figma toolchain can update text nodes, propose a patch set and ask for confirmation before applying. If the integration is read-only, return the markdown report and the structured patch payload for manual use.

## Audit Rules

Use the checklist categories in [references/audit-checklist.md](references/audit-checklist.md) and [references/ui-english-guidelines.md](references/ui-english-guidelines.md). Focus on user-facing copy quality, not pixel-perfect design review or handoff annotation quality.

Prioritize:
- clarity and specificity
- action-oriented CTAs
- consistency with UI state and user intent
- concise, scannable messaging
- helpful error, empty, success, and destructive-action copy
- avoiding jargon, blame, and dead-end instructions
- standard English UI wording and punctuation

## Fast Review Heuristics

When time is short, check these first:

- buttons labeled `Submit`, `Continue`, `Confirm`, or `OK`
- error messages that state the problem but not the next step
- placeholders being used as instructions
- destructive actions without outcome language
- headings and helper text that repeat the same idea
- inconsistent product terms for the same concept
- labels or helper text written like internal notes instead of product copy
- annotation text accidentally mixed into the actual screen frame

## Reporting Requirements

The final report should be easy to skim and immediately useful for editing.

Each finding row must include:
- original copy
- issue summary
- suggested copy
- Figma link

Also include:
- report scope
- checklist source
- summary counts by severity
- optional patch payload for automated updates

If the user asked for a document, prefer markdown. The helper script outputs markdown by default.

## Figma Links

When you have a `file_key` and `node_id`, create a deep link in this shape:

`https://www.figma.com/file/<file_key>/<file_slug>?node-id=<encoded_node_id>`

If a source `file_url` already exists, preserve its slug and replace or append the `node-id` query parameter.

## Auto-Apply Policy

Automatic text replacement is optional and must be gated.

- Only offer it when the connected Figma tool is clearly writable.
- Show the exact node ids and replacement text before applying.
- Ask for explicit confirmation before edits.
- Never overwrite text when the suggestion meaning is ambiguous.

When writes are not available, include a machine-friendly patch section in the report:

```json
[
  {
    "node_id": "123:456",
    "original_text": "Old copy",
    "suggested_text": "New copy"
  }
]
```

## Protected Or Partial Guidelines

If the Zoom page is not readable because it is protected, do not pretend that you verified it. State that you used the fallback checklist and call out the gap in the report intro.

## Suggested Invocation

Use prompts like:

- `Use $figma-content-pattern-auditor to scan this Figma page and give me quick copy fixes.`
- `Use $figma-content-pattern-auditor to review the selected frames, then return a markdown report with edit links.`
- `Use $figma-content-pattern-auditor to suggest short rewrites for weak CTAs and errors in this file.`
