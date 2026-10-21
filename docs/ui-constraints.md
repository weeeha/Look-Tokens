# UI constraints

Written 2026-10-19 by the `me:unslop` constraint phase (Task 11), before any UI code. Inputs: the board wireframe (FigJam `f4RmKqEECb90gfNdsGJOt7`, node `5-2`), spec section 8, and the component list in Tasks 12 and 13.

Tasks 12 and 13 own structure, props and behaviour. Their Tailwind classes are a starting point; where a class breaks a rule below, the rule wins. Task 14 audits against this file.

## What the screen is for

One job, shown in about 20 seconds of screen recording: a look lives in one table, shots point at it, and one edit re-renders every shot that uses it. The stills are the subject. The chrome stays neutral and quiet so the images carry the colour.

## System (Phase 0 bindings)

This repo has no token file of its own. These are the decisions, and nothing outside them enters a component.

- **Theme.** Light only in phase 1. Remove the scaffold's `prefers-color-scheme: dark` block from `app/globals.css` and set `color-scheme: light` on `:root`. One theme halves the contrast audit, and the film is recorded once. A dark theme later is a token change, not a component change.
- **Fonts.** Geist Sans for UI (`font-sans`, wired in `globals.css` by Task 12). Geist Mono for token paths, values in the table, composed prompts and render keys. No other family.
- **Type scale.** `text-xs` (12px), `text-sm` (14px), `text-base` (16px), `text-xl` (20px, the page title only). Arbitrary sizes are banned: `text-[10px]` and `text-[11px]` become `text-xs`, `text-[13px]` becomes `text-sm`.
- **Weights.** 400 and 500 (`font-normal`, `font-medium`). `font-semibold` is allowed once, on the page title.
- **Neutral ramp (Tailwind zinc), steps in use.**
  - `zinc-900`: primary text and the one filled button.
  - `zinc-600`: secondary text where `zinc-500` is too light on a tinted surface.
  - `zinc-500`: secondary text on white (4.8:1).
  - `zinc-300`: input and control borders.
  - `zinc-200`: hairlines.
  - `zinc-100`: chip fill and the surface tint.
  - `white`: page and card background.
  - `zinc-400` is banned for text (2.6:1 on white). Doc-only values (`prompt: false`) use `zinc-500` plus a "doc" label instead of a lighter grey.
- **Accent.** One accent, `sky-700` on white and `sky-50` as its tint. It marks focus rings, the USED BY highlight, and the chip and row that are highlighted together. No violet or indigo anywhere.
- **Status colours** (semantic, not accents): stale is `amber-800` text on `amber-50`; error is `red-700` text on `red-50`; STUB is `zinc-600` text on white with a `zinc-300` border.
- **Radii.** `rounded-md` for controls, cards and images; `rounded-full` for reference chips only.
- **Elevation.** One shadow, `shadow-xl`, on the history drawer. Nothing else has a shadow.
- **Icons.** None needed. Arrows and the close mark are text (`→`, `×`) with accessible names on their buttons. No emoji.

## Layout

- Two columns at `lg` and up, after the wireframe: token table left, shots right. Below `lg` they stack, table first.
- **Recording frame.** At 1920 × 1080 the token table, all six shots and the edit panel are visible without scrolling. The before/after rows may scroll at 1440 × 900 but not at 1920 × 1080. Check both in the Browser pane at those exact sizes.
- Separation ladder: spacing, then a `zinc-200` hairline, then the `zinc-100` tint, then a card. Shot cards are the only cards. The table is not a card and nothing nests inside a shot card's border.
- The shots are the dominant element: the shot grid gets more width than the table, and images keep 16:9.
- Before/after are two labeled rows (spec section 8), never a slider or drag.
- Layout does not move on state change. Highlight, hover, focus and selected states change background, ring or text colour only. Badge slots (stale, stub, error) are reserved at rest so a badge appearing never pushes the card. The history drawer is the declared overlay and does not reflow the page.

## Copy

- Labels are verb plus object: "Apply to 6 shots", "Roll back", "Reset to seed", "Export JSON", "Retry render".
- Column headers TOKEN, VALUE, USED BY are the only uppercase text (`text-xs`, `tracking-wide`, `zinc-500`). Tier section labels and BEFORE/AFTER are sentence case: "Before", "After".
- USED BY reads "6 shots", "1 shot", "0 shots".
- No exclamation marks, no marketing register, no invented numbers. Credit estimates are labeled "estimate" until verified (spec section 7).

## States

- **Loading** (`ready` false): a skeleton in the shape of the table rows and six 16:9 blocks, no spinner.
- **Mock renders** always carry the STUB badge, so a mock is never shown as a real render.
- **Stale** shots keep their last image with the stale badge.
- **Error** shots keep their previous image with an error badge and a "Retry render" button.
- **Unresolved** refs show an "unresolved" chip, and the shot shows no composed prompt.
- **No history** for a value: one sentence, "No earlier values."
- **Storage unavailable**: the toolbar line from spec section 7, "Edits will not persist in this window."
- **Spoiler rows**: "director-only", not expandable, no cursor change.

## Motion

- Only on state change. When a shot's image swaps, it may fade over 150 ms (opacity only). The drawer may slide in on `transform` over 200 ms, ease-out.
- No `transition-all`, no idle animation, no skeleton shimmer.
- Every transition sits behind `motion-safe:`, so reduced-motion users get instant changes.

## Accessibility

- Every control is a `button`, `input` or `a`. Never an `onClick` on a `div` or a `tr`.
- Visible focus everywhere: `focus-visible:ring-2 ring-sky-700 ring-offset-2`.
- Contrast is at least 4.5:1 for all text on its actual surface, badges included.
- Images use the spec's alt text: "{shotSize}, {label}: {look id}".
- The drawer traps focus while open, closes on Escape, and returns focus to the button that opened it.

## 375 px

- No horizontal page scroll. The table's VALUE column wraps, and token paths break at `/` and `.` (`break-words` on the mono cell).
- Tap targets are at least 24 px. Rollback and Retry are visible buttons, never hover-only.
- Shots go to one column; before/after rows become two columns of three.
