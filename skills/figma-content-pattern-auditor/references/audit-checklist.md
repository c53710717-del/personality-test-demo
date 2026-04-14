# Audit Checklist

Canonical source:
`https://sites.google.com/zoom.us/design-system/principles-and-guidelines/content-guidelines/content-patterns`

## Important note

The canonical Zoom page may require Google authentication. This checklist is a practical fallback that reflects common content-design review patterns for product UI copy. If the protected page is available later, update this reference to mirror the exact guidance.

Review only user-facing product copy by default. Ignore canvas annotations, redlines, measurements, internal review notes, and handoff documentation unless the user explicitly asks to audit those too.

## Review categories

### 1. Clarity and specificity

- Prefer concrete nouns and verbs over vague language.
- Make the user action, object, or outcome explicit.
- Replace abstract phrases like "manage things" or "take action" with precise tasks.
- Avoid internal jargon unless the audience is expected to know it.

### 2. Brevity and scanability

- Use the shortest copy that preserves meaning.
- Keep headings and CTAs compact.
- Remove filler words, repeated context, and redundant labels.
- Prefer one idea per sentence in dense UI surfaces.

### 3. Action alignment

- CTA labels should describe the result of clicking.
- Avoid generic buttons like `Submit`, `Confirm`, or `OK` when a clearer verb is possible.
- Match button strength to the action: neutral, primary, destructive, or dismissive.

### 4. State-based messaging

- Empty states should explain what happened, why it matters, and what to do next.
- Success states should confirm the outcome without being noisy.
- Error states should explain the problem in plain language and give a next step.
- Destructive flows should state the consequence and whether the action is reversible.

### 5. Form content

- Labels should identify the field clearly without relying on placeholders.
- Helper text should answer the user's likely question before they get blocked.
- Validation text should describe how to fix the issue, not just that something is invalid.
- Placeholders should be examples, not essential instructions.

### 6. Tone and empathy

- Be direct and calm.
- Do not blame the user.
- Avoid alarmist or overly casual language in serious flows.
- Prefer supportive guidance over vague reassurance.

### 7. Consistency

- Use the same product term for the same concept everywhere.
- Keep capitalization and punctuation patterns consistent across similar components.
- Align wording with the visible UI state, selected option, or page title.

### 8. Accessibility and localization readiness

- Avoid culture-specific idioms and wordplay in core task flows.
- Prefer copy that is easy to translate.
- Avoid directional references like "click on the left" unless layout is fixed.
- Use numerals, dates, and units consistently.

## Finding severity

- `high`: misleading, blocked, unsafe, or materially unclear copy
- `medium`: understandable but weak, inconsistent, or missing context
- `low`: polish, tone, brevity, or consistency improvements

## Suggestion rules

- Preserve the original intent unless the UI itself is wrong.
- Suggest copy that fits the component length.
- When a shorter rewrite would lose important context, keep the longer version.
- If the correct rewrite depends on product behavior you cannot verify, mark it as an assumption.
