import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { diskCache, isRenderKey } from "./cache";

const KEY = "a".repeat(64);
const BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const META = {
  prompt: "Medium shot. A robot.",
  model: "gen4_image",
  ratio: "16:9",
  seed: 7,
  credits: 5,
  at: "2026-10-20T10:00:00.000Z",
};

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "render-cache-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("isRenderKey", () => {
  it("accepts only 64 lowercase hex", () => {
    expect(isRenderKey("a".repeat(64))).toBe(true);
    expect(isRenderKey("A".repeat(64))).toBe(false);
    expect(isRenderKey("a".repeat(63))).toBe(false);
    expect(isRenderKey("../" + "a".repeat(61))).toBe(false);
    expect(isRenderKey("config")).toBe(false);
  });
});

describe("diskCache", () => {
  it("write then find returns the file and its content type", async () => {
    const cache = diskCache(dir);
    await cache.write(KEY, BYTES, "image/png", META);

    const hit = await cache.find(KEY);
    expect(hit).not.toBeNull();
    expect(hit?.path.endsWith(".png")).toBe(true);
    expect(hit?.contentType).toBe("image/png");
    expect(new Uint8Array(await readFile(hit!.path))).toEqual(BYTES);

    const sidecar = JSON.parse(await readFile(path.join(dir, `${KEY}.json`), "utf8"));
    expect(sidecar).toEqual(META);
  });

  it("find returns null for a missing key", async () => {
    const cache = diskCache(dir);
    expect(await cache.find(KEY)).toBeNull();
  });

  it("find refuses a traversal key, even when the file it points at exists", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "render-parent-"));
    try {
      const inner = path.join(parent, "cache");
      await mkdir(inner);
      await writeFile(path.join(parent, "x.png"), BYTES);
      expect(await diskCache(inner).find("../x")).toBeNull();
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("write rejects a traversal key and writes nothing outside the cache folder", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "render-parent-"));
    try {
      const cache = diskCache(path.join(parent, "cache"));
      await expect(cache.write("../x", BYTES, "image/png", {})).rejects.toThrow();
      await expect(cache.write("../" + "a".repeat(61), BYTES, "image/png", {})).rejects.toThrow();
      expect(await readdir(parent)).toEqual([]);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });
});
