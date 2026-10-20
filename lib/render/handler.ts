import { renderKey } from "../engine/key";
import type { RenderCache } from "./cache";
import { CREDITS_PER_IMAGE, MAX_PROMPT, RENDER_MODEL, RUNWAY_RATIO } from "./limits";

export type RenderMode = "cache" | "generate";

export interface RenderDeps {
  cache: RenderCache;
  live: boolean;
  generate(input: {
    prompt: string;
    seed: number;
    ratio: "1280:720";
  }): Promise<{ bytes: Uint8Array; contentType: string }>;
}

export interface RenderOk {
  key: string;
  url: string;
  cached: boolean;
  credits: number;
}

export interface RenderError {
  error: string;
}

export interface RenderResult {
  status: number;
  body: RenderOk | RenderError;
}

const MAX_SEED = 4294967295;

const fail = (status: number, error: string): RenderResult => ({ status, body: { error } });

function isRatio(s: unknown): s is keyof typeof RUNWAY_RATIO {
  return typeof s === "string" && Object.hasOwn(RUNWAY_RATIO, s);
}

// Order: validate, compute the key, check the cache, then (generate mode only)
// the live gate, then the provider. The image is on disk before we answer.
// A posted `key` is never read: the server derives it from the fields.
export async function handleRender(body: unknown, deps: RenderDeps): Promise<RenderResult> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return fail(400, "Body must be a JSON object");
  }
  const { prompt, ratio, seed, model, mode } = body as Record<string, unknown>;

  if (typeof prompt !== "string" || prompt.length === 0) {
    return fail(400, `prompt must be a string of 1 to ${MAX_PROMPT} characters`);
  }
  if (prompt.length > MAX_PROMPT) {
    return fail(400, `prompt is ${prompt.length} UTF-16 units, over the ${MAX_PROMPT} limit`);
  }
  if (!isRatio(ratio)) return fail(400, 'ratio must be "16:9"');
  if (typeof seed !== "number" || !Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) {
    return fail(400, `seed must be an integer from 0 to ${MAX_SEED}`);
  }
  if (model !== RENDER_MODEL) return fail(400, `model must be "${RENDER_MODEL}"`);
  if (mode !== "cache" && mode !== "generate") return fail(400, 'mode must be "cache" or "generate"');

  const key = renderKey({ model, ratio, seed, prompt });
  const url = `/api/render/${key}`;

  if (await deps.cache.find(key)) {
    return { status: 200, body: { key, url, cached: true, credits: 0 } };
  }
  if (mode === "cache") return fail(404, "Not cached");
  if (!deps.live) return fail(403, "Live rendering is off");

  let image: Awaited<ReturnType<RenderDeps["generate"]>>;
  try {
    image = await deps.generate({ prompt, seed, ratio: RUNWAY_RATIO[ratio] });
  } catch (err) {
    return fail(502, err instanceof Error ? err.message : "Render failed");
  }
  try {
    await deps.cache.write(key, image.bytes, image.contentType, {
      prompt,
      model,
      ratio,
      seed,
      credits: CREDITS_PER_IMAGE,
      at: new Date().toISOString(),
    });
  } catch {
    // The call was billed but the file did not land. The message stays generic
    // so a file-system error never leaks a local path into a response.
    return fail(502, "Rendered, but the image could not be stored");
  }
  return { status: 200, body: { key, url, cached: false, credits: CREDITS_PER_IMAGE } };
}
