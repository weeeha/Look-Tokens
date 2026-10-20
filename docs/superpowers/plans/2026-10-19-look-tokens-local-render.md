# Look Tokens local render route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real Runway `gen4_image` stills for the six Scene 15 shots on Nick's machine, so the Look Tokens film shows one token edit re-rendering real images, and rollback restoring them with no new render.

**Architecture:** A server route computes the render key itself, answers from a local disk cache, and calls Runway only when `RENDER_LIVE=1` and a key is set. The image is downloaded at once and served from the app. The browser keeps the mock path unchanged when live mode is off, so the public preview and every existing test behave as before. Vercel Blob (spec section 7) is deferred to the public preview; this plan replaces it with a gitignored `.renders/` folder.

**Tech Stack:** Next.js 16.3 route handlers (Node runtime), `@runwayml/sdk` 4.22.0, Vitest (node environment), existing engine (`renderKey`, `shotSeed`).

**Spec:** `docs/superpowers/specs/2026-09-26-look-tokens-design.md`, section 7 (Live route), section 9 Phase 2 steps 1 to 3 and 5, section 11.

**Out of scope:** Vercel Blob and the public cache (Phase 2 step 2, deferred to the public preview), the Seedance adapter (Phase 2 step 4), 1080p renders, reference images.

**Runs after:** Task 10 steps 3 to 5 (Nick's `compose()`), and Tasks 11 to 13 of the phase 1 plan. Tasks 1 and 2 below can run before `compose()` lands; Task 3 goes green only after it; Tasks 4 and 5 need the page to render, so they wait for it.

## Verified facts (Runway docs, read 2026-10-19)

Spec section 11's open items, answered. Source: `docs.dev.runwayml.com/openapi.json` (`POST /v1/text_to_image`, `gen4_image` variant) and `docs.dev.runwayml.com/guides/pricing`.

| Item | Answer |
|---|---|
| Credits per image | `gen4_image`: 5 credits per 720p image, 8 per 1080p. $0.01 per credit. |
| Prompt limit | `promptText` 1 to 1000 characters, "measured in UTF-16 code units", so JS `string.length` is the exact measure. |
| Seed | Accepted. Integer 0 to 4294967295. "Using the same seed integer for an identical request will produce similar results." `shotSeed()` already returns an unsigned 32-bit integer. |
| Ratio | Enum of pixel sizes. 16:9 options: `1280:720` (720p) and `1920:1080` (1080p). |
| Reference images | Optional, up to 3 (not used in this build). |
| Negative prompt | No such field. `world/*` `antiUse` values stay documentation. |
| Required fields | `promptText`, `ratio`, `model`. |
| Lifecycle | Create returns `{ id }`; poll until `SUCCEEDED`, `FAILED` or `CANCELLED`; output URLs are temporary, so download at once. |
| Failed or moderated tasks | Pricing page says nothing. `ai-context.md` (Oct 17 read) says moderated generations cost the same as successful ones. Treat every call as billed. |

Consequence: spec section 9 Phase 2 step 5 (weighted budget trim) is cut unless Task 3's test fails. The spec estimates `s15-pour-medium` at about 600 characters.

## Global Constraints

- Never modify, stage or commit `lib/engine/adapters/image-gen.ts` or `lib/engine/adapters/image-gen.test.ts`; they are Nick's [HAND] files.
- Stage explicit paths only, never `git add -A` (phase 1 ledger Ruling R8). Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Read the relevant guide in `node_modules/next/dist/docs/` before writing a route handler (AGENTS.md). Node runtime only; no `runtime = 'edge'`.
- The server computes `renderKey` from the posted fields and ignores any posted key (spec section 7.1).
- Runway is called only when `RENDER_LIVE === "1"` and `RUNWAYML_API_SECRET` is set (spec decision 4). The secret is never logged, returned or written to disk.
- No automatic retry of a failed render; retry is a button (spec section 7, failures are billed).
- Model `gen4_image`, Runway ratio `1280:720` for the engine ratio `16:9`, 5 credits per image. These three values live in one file, `lib/render/limits.ts`.
- UI copy and styling follow `docs/ui-constraints.md`. Docs prose has no em dashes.

## Review Focus

1. **A provider failure** (moderation, timeout, network) answers 502 with the failure text and writes nothing to the cache; the shot keeps its previous image with an error badge and a Retry button. Pinned in Task 1 (`returns 502 and caches nothing when generation throws`) and Task 4 (manual).
2. **A token edit that pushes the prompt past 1000 UTF-16 units** (long text, accents, emoji) gets a 400 naming the limit, not a Runway error after the call is billed. Pinned in Task 1 (`rejects a prompt over 1000 UTF-16 units`).
3. **A crafted key on the image route** (`../`, wrong length, uppercase) never reads outside `.renders/`. Pinned in Task 1 (`isRenderKey accepts only 64 lowercase hex`).
4. **The public preview, with no keys and no cache folder,** behaves exactly like phase 1: cache misses answer 404, generate answers 403, the provider is never called, and mocks keep their STUB badge. Pinned in Task 1 (`refuses to generate when live is off`).
5. **A second Apply or an edit while renders are in flight** must not record a stale result as fresh. Apply is disabled while rendering, and results are recorded by render key. Pinned in Task 4 (manual step 6).

---

### Task 1: Disk cache and the render request handler

**Files:**
- Create: `lib/render/limits.ts`, `lib/render/cache.ts`, `lib/render/handler.ts`
- Test: `lib/render/cache.test.ts`, `lib/render/handler.test.ts`

**Interfaces:**
- Consumes: `renderKey(input: RenderKeyInput): string` from `lib/engine/key.ts`.
- Produces:
  - `limits.ts`: `RENDER_MODEL = "gen4_image"`, `RUNWAY_RATIO: Record<"16:9", "1280:720">`, `CREDITS_PER_IMAGE = 5`, `MAX_PROMPT = 1000`, each with a one-line source comment citing the table above.
  - `cache.ts`: `isRenderKey(s: string): boolean`; `interface RenderCache { find(key: string): Promise<{ path: string; contentType: string } | null>; write(key: string, bytes: Uint8Array, contentType: string, meta: object): Promise<void> }`; `diskCache(dir: string): RenderCache`. Files are `{key}.png|jpg|webp` by content type, plus `{key}.json` holding `meta` (prompt, model, ratio, seed, credits, at) as provenance.
  - `handler.ts`: `type RenderMode = "cache" | "generate"`; `interface RenderDeps { cache: RenderCache; live: boolean; generate(input: { prompt: string; seed: number; ratio: "1280:720" }): Promise<{ bytes: Uint8Array; contentType: string }> }`; `handleRender(body: unknown, deps: RenderDeps): Promise<{ status: number; body: RenderOk | RenderError }>` with `RenderOk = { key: string; url: string; cached: boolean; credits: number }` and `RenderError = { error: string }`. `url` is `/api/render/${key}`.

- [ ] **Step 1: Write the failing tests**

`cache.test.ts` (each test gets a fresh `mkdtemp` folder):
- `isRenderKey accepts only 64 lowercase hex`: true for `"a".repeat(64)`; false for `"A".repeat(64)`, `"a".repeat(63)`, `"../" + "a".repeat(61)`, `"config"`.
- `write then find returns the file and its content type`: write `image/png` bytes, `find` returns a path ending `.png` and `contentType: "image/png"`; the `.json` sidecar parses and holds the meta.
- `find returns null for a missing key`.

`handler.test.ts`, with an in-memory `RenderCache` and a `generate` spy. Valid body: `{ prompt: "Medium shot. A robot.", ratio: "16:9", seed: 7, model: "gen4_image", mode: "generate" }`.
- `computes the key on the server and ignores a posted key`: posting `key: "f".repeat(64)` returns `body.key === renderKey({ model: "gen4_image", ratio: "16:9", seed: 7, prompt: "Medium shot. A robot." })`.
- `answers a cache hit without calling the provider`: pre-seeded cache; status 200, `cached: true`, `credits: 0`, spy not called.
- `cache mode answers 404 on a miss`: `mode: "cache"`, empty cache, live true; status 404; spy not called.
- `refuses to generate when live is off`: live false, empty cache; status 403; spy not called.
- `generates, stores and returns the url when live`: live true; spy called once with `{ prompt, seed: 7, ratio: "1280:720" }`; status 200, `cached: false`, `credits: 5`, `url: "/api/render/<key>"`; the cache now finds the key.
- `returns 502 and caches nothing when generation throws`: spy rejects with `Error("Runway task failed: SAFETY.INPUT.TEXT")`; status 502, `error` contains `SAFETY.INPUT.TEXT`; cache still misses.
- `rejects a prompt over 1000 UTF-16 units`: prompt `"🎬".repeat(501)` (length 1002); status 400, `error` mentions `1000`; spy not called. A prompt of exactly 1000 units is accepted.
- `rejects any model other than gen4_image, any ratio other than 16:9, and a seed outside 0 to 4294967295`: three cases, each 400, spy not called.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run lib/render`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `limits.ts`, `cache.ts` and `handler.ts`**

`handleRender` order: validate, compute the key, check the cache, then (generate mode only) the live gate, then call the provider and write the file before answering. A malformed body is 400 with the first problem named.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run lib/render && pnpm typecheck && pnpm lint`
Expected: both files pass; no output from `tsc` or `eslint`.

- [ ] **Step 5: Commit**

```bash
git add lib/render/limits.ts lib/render/cache.ts lib/render/handler.ts lib/render/cache.test.ts lib/render/handler.test.ts
git commit -m "Add render cache and request handler with the live gate"
```

---

### Task 2: Runway provider and the three routes

**Files:**
- Create: `lib/render/runway.ts`, `app/api/render/route.ts`, `app/api/render/[key]/route.ts`, `app/api/render/config/route.ts`, `.env.local.example`
- Modify: `package.json` and `pnpm-lock.yaml` (dependency), `.gitignore` (add `.renders/`)

**Interfaces:**
- Consumes: `handleRender`, `RenderDeps`, `diskCache`, `isRenderKey`, the `limits.ts` constants.
- Produces:
  - `runway.ts`: `generateStill(input: { prompt: string; seed: number; ratio: "1280:720" }): Promise<{ bytes: Uint8Array; contentType: string }>`; `liveEnabled(): boolean` (true only when `RENDER_LIVE === "1"` and `RUNWAYML_API_SECRET` is non-empty).
  - `POST /api/render`: body as in Task 1, answers `handleRender`'s status and body.
  - `GET /api/render/{key}`: the cached image with its content type and `Cache-Control: public, max-age=31536000, immutable`; 400 for a key that fails `isRenderKey`, 404 for a miss.
  - `GET /api/render/config`: `{ live: boolean, creditsPerImage: 5 }`.

- [ ] **Step 1: Add the SDK**

Run: `pnpm add @runwayml/sdk@4.22.0`
Expected: `package.json` lists it under dependencies.

- [ ] **Step 2: Implement `generateStill` in `lib/render/runway.ts`**

Follow Flow Builder's pattern (`../Flow Builder/app/api/generate/video/route.ts:88-138`): `new RunwayML()` reads the secret; `client.textToImage.create({ model: RENDER_MODEL, promptText, ratio, seed })`, then `.waitForTaskOutput({ timeout: 120_000 })`; fetch `output[0]` at once and return its bytes and content type. Map `TaskFailedError` to `Error("Runway task failed: <failure>")` and `TaskTimedOutError` to `Error("Runway task timed out")`.

- [ ] **Step 3: Implement the three route files**

The cache folder is `process.env.RENDER_DIR ?? path.join(process.cwd(), ".renders")`. Check the dynamic-params signature for `[key]` against the Next 16 docs. Add `.renders/` to `.gitignore`. Write `.env.local.example` with two lines, `RUNWAYML_API_SECRET=` and `RENDER_LIVE=1`, and nothing else.

- [ ] **Step 4: Verify with live mode off**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: clean; the build lists `/` as Static and the three `/api/render` routes as Dynamic.

Then, with `pnpm dev` running and no `.env.local`:
- `curl -s localhost:3000/api/render/config` gives `{"live":false,"creditsPerImage":5}`.
- `curl -s -o /dev/null -w '%{http_code}' -X POST localhost:3000/api/render -H 'content-type: application/json' -d '{"prompt":"x","ratio":"16:9","seed":1,"model":"gen4_image","mode":"generate"}'` gives `403`.
- `curl -s -o /dev/null -w '%{http_code}' localhost:3000/api/render/..%2F..%2Fpackage.json` gives `400`.

- [ ] **Step 5: Commit**

```bash
git add lib/render/runway.ts app/api/render .env.local.example .gitignore package.json pnpm-lock.yaml
git commit -m "Add Runway gen4_image provider and render routes behind RENDER_LIVE"
```

---

### Task 3: Prompt length guard for every shot

**Files:**
- Test: `lib/render/prompt-limit.test.ts`

**Interfaces:**
- Consumes: `seed` (`lib/seed.ts`), `resolve`, `applyEdits`, `makeEdit`, `imageGen`, `MAX_PROMPT`.

- [ ] **Step 1: Write the test**

`every shot's composed prompt fits gen4_image`: for all six seed shots, `imageGen.compose(shot, resolve(shot, groups).groups).prompt.length <= MAX_PROMPT`, twice: with the seed groups, and with the demo edit applied (`look/overgrown-interior.light` set to `"sodium streetlight through the windows at dusk"`, spec section 9 demo script).

- [ ] **Step 2: Run it**

Run: `pnpm vitest run lib/render/prompt-limit.test.ts`
Expected before Nick's `compose()`: FAIL with the [HAND] stub's error. Expected after: PASS. If it fails on length instead, stop: spec Phase 2 step 5 (budget trim) comes back into scope.

- [ ] **Step 3: Commit**

```bash
git add lib/render/prompt-limit.test.ts
git commit -m "Guard composed prompts against gen4_image's 1000-unit limit"
```

---

### Task 4: Live renders in the page

**Files:**
- Create: `lib/render/client.ts`
- Modify: `lib/session.ts` (one helper), `lib/session.test.ts`, `components/useLookTokens.ts`, `components/EditPanel.tsx`, `components/ShotCard.tsx`, `components/Toolbar.tsx`, `components/LookTokensApp.tsx` (props only)

**Interfaces:**
- Consumes: `POST /api/render`, `GET /api/render/config`, `recordRenders`, `normalize`, `ShotView`, `RenderEntry`.
- Produces:
  - `session.ts`: `mockShown(views: ShotView[]): ShotView[]`, the views whose `display?.kind === "mock"` and whose `key` is not null.
  - `client.ts`: `fetchRenderConfig(): Promise<{ live: boolean; creditsPerImage: number }>` (resolves `{ live: false, creditsPerImage: 5 }` on any network error); `requestRender(view: ShotView, mode: "cache" | "generate"): Promise<{ ok: true; entry: RenderEntry } | { ok: false; status: number; error: string }>`, where `entry` is `{ kind: "live", url, prompt: view.composition.prompt, at }`. The posted body carries `view.shot.ratio`, `shotSeed(view.shot.id)` and `imageGen.target.model`.
  - The hook additionally returns `live: boolean`, `creditsPerImage: number`, `rendering: string[]` (shot ids in flight), `errors: Record<string, string>` (shot id to message, not persisted), `mockCount: number`, `renderLive(): void`, `retry(shotId: string): void`.

- [ ] **Step 1: Write the failing test**

In `lib/session.test.ts`: `mockShown lists only shots whose shown render is a mock`, with three views (mock with key, live with key, mock with `key: null`); expect only the first shot's id.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run lib/session.test.ts`
Expected: FAIL, `mockShown` is not exported.

- [ ] **Step 3: Implement `mockShown`, `client.ts` and the hook changes**

Hook behaviour:
- **Load.** After the stored session loads, fetch the config; then ask the cache (`mode: "cache"`) for every `mockShown` view and record hits with `recordRenders(..., { apply: false })` through `normalize`. This never spends credits.
- **Apply, live off.** The existing mock path, unchanged.
- **Apply, live on.** Request `generate` for every stale view in parallel. Record the successes in one `recordRenders(..., { apply: true })` call, so the before/after rows hold them. Put failures in `errors`. While requests are in flight, `rendering` holds their shot ids.
- **renderLive.** Request `generate` for every `mockShown` view and record with `apply: false`.
- **retry(shotId).** Request `generate` for that one shot, record with `apply: false`, and clear its error. A retried shot does not join the last Apply's before/after rows; that is accepted.

UI copy and slots follow `docs/ui-constraints.md`:
- `EditPanel`: with live on, the button reads `Apply to {n} shots · {n × 5} credits`. While rendering it is disabled and reads `Rendering {n} shots`.
- `ShotCard`: in the reserved badge slot, `Rendering` (neutral) while in flight, or `Render failed` (error tone) with a `Retry render` button. The message goes in the button's `title`.
- `Toolbar`: with live on and `mockCount > 0`, a `Render {mockCount} shots live · {mockCount × 5} credits` button.

- [ ] **Step 4: Run the tests and checks**

Run: `pnpm vitest run --exclude lib/engine/adapters/image-gen.test.ts && pnpm typecheck && pnpm lint && pnpm build`
Expected: all pass, including the new `mockShown` test; the build stays clean.

- [ ] **Step 5: Verify live off in the browser**

Needs Nick's `compose()`. Start the preview, front the tab, and set the viewport to 1920 × 1080. Run the spec section 9 demo script. Expected: identical to phase 1. Mocks show STUB, no live controls appear, and there are no console errors.

- [ ] **Step 6: Verify the in-flight guard by reading the code path**

Confirm that Apply is disabled while `rendering` is non-empty, and that results are recorded under the key they were requested with. A shot edited mid-render therefore shows Stale against its new key and never shows the old image as fresh. Ledger the check.

- [ ] **Step 7: Commit**

```bash
git add lib/render/client.ts lib/session.ts lib/session.test.ts components/useLookTokens.ts components/EditPanel.tsx components/ShotCard.tsx components/Toolbar.tsx components/LookTokensApp.tsx
git commit -m "Render live through the local route, with cache-first load and retry"
```

---

### Task 5: First real batch (Nick's key, about 60 credits)

**Files:** none committed. `.renders/` is gitignored.

- [ ] **Step 1: Nick sets the environment**

Nick copies `.env.local.example` to `.env.local` and pastes his own `RUNWAYML_API_SECRET`. The agent never types, reads or prints the key. Nick confirms the project balance on dev.runwayml.com covers 150 credits, which is the cap for this task.

- [ ] **Step 2: One render**

Restart `pnpm dev`. `GET /api/render/config` gives `live: true`. In the page, click `Render 6 shots live · 30 credits`. Expected: six images replace the six STUB frames; `.renders/` holds six images and six `.json` sidecars, each with `credits: 5`.

- [ ] **Step 3: Read the six stills before spending more**

Open each still. If a shot misreads the scene (wrong subject, text artifacts, a living diner), stop and report to Nick with the shot id and its prompt. A prompt or token fix comes before any re-roll.

- [ ] **Step 4: The demo edit, live**

Edit `look/overgrown-interior.light` to `sodium streetlight through the windows at dusk`, then click `Apply to 6 shots · 30 credits`. Expected: six new stills and filled before/after rows. Then roll back from the history drawer. Expected: the first six return at once and `.renders/` gains no files.

- [ ] **Step 5: Record the totals**

Write one ledger line with the images rendered, the credits spent (from the sidecars), the wall time of the six-shot Apply, and any failures. The film's caption uses these numbers, so they must be the real ones.
