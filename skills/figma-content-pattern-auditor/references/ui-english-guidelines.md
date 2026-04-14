# Standard English UI Copy Guidelines

Use this reference when the project-specific content guide is missing, incomplete, or protected.

These rules are intentionally practical and product-focused. They are designed for fast audits of user-facing UI copy in English.

## Scope

Apply these rules to copy that appears in the actual designed experience:
- headings
- body copy
- buttons
- links
- labels
- helper text
- placeholders
- empty states
- banners
- toasts
- dialogs
- validation and error messages

Do not apply these rules to design annotations, spec notes, redlines, or internal review comments unless the user explicitly asks for that.

## Core principles

### 1. Be clear before being clever

- Prefer literal wording over brand jokes or wordplay in core flows.
- Say what the user can do, what happened, or what will happen next.
- Replace vague copy with precise nouns and verbs.

Examples:
- `Manage it here` -> `Manage billing settings`
- `Something happened` -> `We couldn't save your changes`

### 2. Use action-oriented CTAs

- Button labels should describe the result of clicking.
- Prefer strong verbs over generic labels.
- Avoid `Submit`, `OK`, `Yes`, and `Confirm` when a clearer alternative is possible.

Examples:
- `Submit` -> `Send request`
- `Confirm` -> `Delete file`
- `Continue` -> `Review order`

### 3. Keep UI copy short

- Remove filler and repeated context.
- Keep one idea per sentence where possible.
- If the title already gives context, the helper text should add new information.

Examples:
- `Please click the button below to continue with the next step of the process` -> `Continue to the next step`

### 4. Match the user's mental model

- Use terms the user would expect, not internal team terminology.
- Use the same term for the same concept throughout the flow.
- Avoid switching between synonyms like `workspace`, `space`, and `project` unless they mean different things.

### 5. Write helpful error messages

- Say what went wrong in plain language.
- Include the next step when possible.
- Avoid blame.
- Do not rely on error codes alone.

Good pattern:
- problem
- cause if known and useful
- next step

Examples:
- `Invalid input` -> `Enter a valid work email address`
- `Payment failed` -> `Your payment didn't go through. Try another card or contact your bank.`

### 6. Write useful empty states

- Explain what is missing.
- Explain why it matters if needed.
- Offer a next step.

Examples:
- `No data` -> `No invoices yet`
- `No invoices yet. Your paid invoices will appear here.` 

### 7. Make destructive actions explicit

- Say exactly what will be deleted, removed, or turned off.
- If the action is irreversible, say so.
- If the action can be undone, say that instead.

Examples:
- `Are you sure?` -> `Delete this workspace?`
- `Delete workspace`
- `This action can't be undone.`

### 8. Use placeholders only as examples

- A label should carry the main meaning.
- A placeholder can show a sample format, not essential instructions.
- Do not rely on placeholder text that disappears once typing starts.

Examples:
- label: `Email address`
- placeholder: `name@company.com`

### 9. Prefer direct, neutral tone

- Be calm and helpful.
- Avoid blaming the user.
- Avoid exaggerated exclamation points in functional UI.
- Avoid overly chatty copy in settings, billing, privacy, or security flows.

### 10. Be consistent with capitalization and punctuation

- Follow the product's existing pattern when it is consistent.
- In the absence of a product pattern, use sentence case for most UI labels and headings.
- End full-sentence helper text, descriptions, and messages with punctuation.
- Button labels usually do not need ending punctuation.

### 11. Make copy easy to localize

- Avoid idioms, slang, and cultural references.
- Avoid directional instructions that may break in responsive layouts.
- Prefer explicit nouns over pronouns when clarity matters.

### 12. Respect component constraints

- Write suggestions that fit the component.
- Buttons should usually stay short.
- Titles should be scannable.
- Toasts and banners should front-load the main point.

## Fast lint checks

Flag copy for review when you see:
- `Submit`
- `OK`
- `Confirm`
- `Please be advised`
- `Kindly`
- `Oops!`
- `Something went wrong`
- `Click here`
- `No data found`
- `Are you sure?`
- `This field is invalid`

These phrases are not always wrong, but they often signal a missed opportunity to be more specific.

## Annotation filtering hints

The following usually indicate non-UI annotation text and should be ignored:
- `8px`, `16px`, `24px`
- `padding`, `margin`, `radius`, `opacity`
- `hover`, `pressed`, `disabled`, `focus`
- `spec`, `redline`, `dev note`, `annotation`, `comment`
- text blocks outside main frames that describe behavior for reviewers
