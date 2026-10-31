# Look Tokens

**Problem.** Prompt-based film work repeats a look as adjectives across many prompts, and the copies drift apart.

**Idea.** A film's look lives in one table of tokens. Shots reference tokens, a per-tool adapter composes each prompt at render time, and editing one value offers to re-render every shot that uses it, with the old value kept for rollback.

**Built.** A Next.js app with a pure TypeScript engine (no React, Next or I/O imports, enforced by ESLint), a token table, shot cards, an apply panel, before/after rows and a history drawer. The demo is Scene 15 of Post-Collapse Montreal, and a Runway `gen4_image` render route exists behind a server flag. 14 commits on 5 days, Sep 21 to Oct 30, 2026.

**Decision.** Renders are mocked by default, and real Runway renders run only where `RENDER_LIVE=1` is set on the server, so a public visitor never spends credits.

Cinematography as a design token system. A film's look lives in one table of tokens. Shots reference tokens instead of repeating adjectives, and each shot's prompt is composed at render time by a per-tool adapter. Edit one value and every shot that uses it re-renders, with the old value kept for rollback.

Demo content is Scene 15 of Post-Collapse Montreal, transcribed from the film's token file. Values tagged `proposed` have no citation in the source recordings.

## Run

```bash
pnpm install
pnpm dev
```

Tests: `pnpm test` · Types: `pnpm typecheck` · Lint: `pnpm lint`

Phase 1 needs no environment variables. Every render is a labeled mock (STUB).

## Design

- Spec: `docs/superpowers/specs/2026-09-26-look-tokens-design.md`
- Plan: `docs/superpowers/plans/2026-09-26-look-tokens-phase-1.md`
- `lib/engine/` is pure TypeScript with no React, Next or I/O imports. ESLint enforces it.

<!-- BEGIN:generation-family -->
## Related repos

These seventeen repos make Nick's films together, from story to sound. Each handles one stage, and the same table sits in every one of them.

| Stage | Repo | What it does |
|---|---|---|
| Story and worlds | My Films (private) | The film worlds: bibles, scenes, production plans and generated-image archives |
| Story and worlds | Storytelling Kit (private) | Storytelling cards with artwork editions |
| Story and worlds | Film Writer (private) | World-first film development with the screenplay grown from it |
| Craft and reference | film-craft (private) | Craft rules, measured film norms and dated tool tests |
| Craft and reference | Film Analyzer (private) | Frame-by-frame close reading of films |
| Craft and reference | [Look Tokens](https://github.com/weeeha/Look-Tokens) | A film's look as one token table that composes shot prompts |
| Images | [Film Design System](https://github.com/weeeha/Film-Design-System) | Keeps characters, props and settings consistent across image generations |
| Images | [Idea to Prop](https://github.com/weeeha/idea-to-prop) | Keeps one prop design connected from concept image to fabrication |
| 3D, previs and props | 3D Models (private) | Generates 3D models from text, with a viewer and gallery |
| 3D, previs and props | [Scene Builder 3D](https://github.com/weeeha/scene-builder-3d) | Blocks out shots in 3D before anything is generated |
| 3D, previs and props | [film-previz](https://github.com/weeeha/film-previz) | Walk a generated set and save camera shots (spec stage) |
| 3D, previs and props | [Location Lab](https://github.com/weeeha/location-lab) | Scout a real place and hand it to Seedance (design stage) |
| 3D, previs and props | film-props (private) | 3D-printed props and pre-vis sets |
| Video | [Video Generation Pipeline](https://github.com/weeeha/Video-Generation-Pipeline) | Seedance and Runway video generation with reusable reference packs |
| Video | Local Video Pipeline (private) | Wan 2.2 and MiniMax H3 video drafts on a local GPU |
| Video | Continuity Lab (private, in progress) | Finds and repairs inconsistencies between generated video shots |
| Sound | [Audio Generation Pipeline](https://github.com/weeeha/Audio-Generation-Pipeline) | Local speech, voice cloning and sound effects |
<!-- END:generation-family -->
