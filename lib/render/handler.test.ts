import { describe, expect, it, vi } from "vitest";
import { renderKey } from "../engine/key";
import type { CachedRender, RenderCache } from "./cache";
import { handleRender, isJsonContentType, type RenderDeps } from "./handler";

const VALID = {
  prompt: "Medium shot. A robot.",
  ratio: "16:9",
  seed: 7,
  model: "gen4_image",
  mode: "generate",
};
const VALID_KEY = renderKey({ model: "gen4_image", ratio: "16:9", seed: 7, prompt: "Medium shot. A robot." });

function memoryCache(seed: string[] = []): RenderCache {
  const store = new Map<string, CachedRender>(
    seed.map((k) => [k, { path: `/memory/${k}.png`, contentType: "image/png" }]),
  );
  return {
    async find(key) {
      return store.get(key) ?? null;
    },
    async write(key, _bytes, contentType) {
      store.set(key, { path: `/memory/${key}`, contentType });
    },
  };
}

function setup(over: Partial<RenderDeps> = {}) {
  const generate = vi.fn<RenderDeps["generate"]>(async () => ({
    bytes: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
  }));
  const cache = memoryCache();
  const deps: RenderDeps = { cache, live: true, generate, ...over };
  return { deps, generate, cache: deps.cache };
}

describe("handleRender", () => {
  it("computes the key on the server and ignores a posted key", async () => {
    const { deps } = setup();
    const res = await handleRender({ ...VALID, key: "f".repeat(64) }, deps);
    expect(res.status).toBe(200);
    expect((res.body as { key: string }).key).toBe(VALID_KEY);
  });

  it("answers a cache hit without calling the provider", async () => {
    const { deps, generate } = setup({ cache: memoryCache([VALID_KEY]) });
    const res = await handleRender(VALID, deps);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ key: VALID_KEY, url: `/api/render/${VALID_KEY}`, cached: true, credits: 0 });
    expect(generate).not.toHaveBeenCalled();
  });

  it("cache mode answers 404 on a miss", async () => {
    const { deps, generate } = setup({ live: true });
    const res = await handleRender({ ...VALID, mode: "cache" }, deps);
    expect(res.status).toBe(404);
    expect(generate).not.toHaveBeenCalled();
  });

  it("cache mode answers 404 on a miss when live is off, and never calls the provider", async () => {
    const { deps, generate } = setup({ live: false });
    const res = await handleRender({ ...VALID, mode: "cache" }, deps);
    expect(res.status).toBe(404);
    expect(generate).not.toHaveBeenCalled();
  });

  it("refuses to generate when live is off", async () => {
    const { deps, generate } = setup({ live: false });
    const res = await handleRender(VALID, deps);
    expect(res.status).toBe(403);
    expect(generate).not.toHaveBeenCalled();
  });

  it("generates, stores and returns the url when live", async () => {
    const { deps, generate, cache } = setup();
    const res = await handleRender(VALID, deps);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith({ prompt: "Medium shot. A robot.", seed: 7, ratio: "1280:720" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ key: VALID_KEY, url: `/api/render/${VALID_KEY}`, cached: false, credits: 5 });
    expect(await cache.find(VALID_KEY)).not.toBeNull();
  });

  it("returns 502 and caches nothing when generation throws", async () => {
    const generate = vi.fn<RenderDeps["generate"]>(async () => {
      throw new Error("Runway task failed: SAFETY.INPUT.TEXT");
    });
    const { deps, cache } = setup({ generate });
    const res = await handleRender(VALID, deps);
    expect(res.status).toBe(502);
    expect((res.body as { error: string }).error).toContain("SAFETY.INPUT.TEXT");
    expect(await cache.find(VALID_KEY)).toBeNull();
  });

  it("returns 502 without a file path when the image cannot be stored", async () => {
    const cache = memoryCache();
    cache.write = async () => {
      throw new Error("ENOENT: open '/Users/someone/.renders/x.png'");
    };
    const { deps } = setup({ cache });
    const res = await handleRender(VALID, deps);
    expect(res.status).toBe(502);
    expect((res.body as { error: string }).error).not.toContain("/Users");
  });

  it("rejects a prompt over 1000 UTF-16 units", async () => {
    const { deps, generate } = setup();
    const long = "🎬".repeat(501);
    expect(long.length).toBe(1002);
    const res = await handleRender({ ...VALID, prompt: long }, deps);
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toContain("1000");
    expect(generate).not.toHaveBeenCalled();
  });

  it("accepts a prompt of exactly 1000 UTF-16 units", async () => {
    const { deps, generate } = setup();
    const exact = "🎬".repeat(500);
    expect(exact.length).toBe(1000);
    const res = await handleRender({ ...VALID, prompt: exact }, deps);
    expect(res.status).toBe(200);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a model other than gen4_image", { model: "gen3a_turbo" }],
    ["a ratio other than 16:9", { ratio: "4:3" }],
    ["a seed below 0", { seed: -1 }],
    ["a seed above 4294967295", { seed: 4294967296 }],
    ["a non-integer seed", { seed: 1.5 }],
  ])("rejects %s", async (_label, patch) => {
    const { deps, generate } = setup();
    const res = await handleRender({ ...VALID, ...patch }, deps);
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toEqual(expect.any(String));
    expect(generate).not.toHaveBeenCalled();
  });

  it("accepts the seed bounds 0 and 4294967295", async () => {
    for (const seed of [0, 4294967295]) {
      const { deps } = setup();
      const res = await handleRender({ ...VALID, seed }, deps);
      expect(res.status).toBe(200);
    }
  });

  it("rejects a malformed body with 400", async () => {
    for (const body of [null, "x", 7, [], { ...VALID, prompt: "" }, { ...VALID, mode: "other" }]) {
      const { deps, generate } = setup();
      const res = await handleRender(body, deps);
      expect(res.status).toBe(400);
      expect(generate).not.toHaveBeenCalled();
    }
  });
});

describe("isJsonContentType", () => {
  it("accepts application/json, any case, with optional parameters", () => {
    expect(isJsonContentType("application/json")).toBe(true);
    expect(isJsonContentType("Application/JSON")).toBe(true);
    expect(isJsonContentType("application/json; charset=utf-8")).toBe(true);
    expect(isJsonContentType("application/json;charset=UTF-8")).toBe(true);
  });

  it("rejects null and the types a cross-site form or no-cors fetch can send", () => {
    expect(isJsonContentType(null)).toBe(false);
    expect(isJsonContentType("")).toBe(false);
    expect(isJsonContentType("text/plain")).toBe(false);
    expect(isJsonContentType("text/plain;charset=UTF-8")).toBe(false);
    expect(isJsonContentType("application/x-www-form-urlencoded")).toBe(false);
    expect(isJsonContentType("multipart/form-data; boundary=----x")).toBe(false);
  });

  it("rejects look-alike types", () => {
    expect(isJsonContentType("application/jsonp")).toBe(false);
    expect(isJsonContentType("text/json")).toBe(false);
  });
});
