import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());

// A stand-in SDK: no network, no key. It keeps the real class names so the
// provider's instanceof checks run against the same shapes.
vi.mock("@runwayml/sdk", () => {
  class TaskFailedError extends Error {
    constructor(public taskDetails: { failure?: string; failureCode?: string }) {
      super(taskDetails.failure ?? "Task cancelled");
    }
  }
  class TaskTimedOutError extends Error {
    taskDetails = {};
    constructor() {
      super("Task timed out");
    }
  }
  class RunwayML {
    textToImage = { create };
  }
  return { default: RunwayML, TaskFailedError, TaskTimedOutError };
});

import { TaskFailedError, TaskTimedOutError } from "@runwayml/sdk";
import { generateStill, liveEnabled } from "./runway";

const INPUT = { prompt: "Medium shot. A robot.", seed: 7, ratio: "1280:720" as const };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

function succeedWith(bytes: Uint8Array, init: ResponseInit = { status: 200 }) {
  const waitForTaskOutput = vi.fn(async () => ({ output: ["https://cdn.example/out"] }));
  create.mockReturnValue({ waitForTaskOutput });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes as BodyInit, init)));
  return waitForTaskOutput;
}

function failWith(err: Error) {
  create.mockReturnValue({
    waitForTaskOutput: async () => {
      throw err;
    },
  });
}

beforeEach(() => {
  create.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("liveEnabled", () => {
  it("needs RENDER_LIVE=1 and a non-empty key", () => {
    vi.stubEnv("RENDER_LIVE", "");
    vi.stubEnv("RUNWAYML_API_SECRET", "");
    expect(liveEnabled()).toBe(false);
    vi.stubEnv("RENDER_LIVE", "1");
    expect(liveEnabled()).toBe(false);
    vi.stubEnv("RUNWAYML_API_SECRET", "   ");
    expect(liveEnabled()).toBe(false);
    vi.stubEnv("RENDER_LIVE", "0");
    vi.stubEnv("RUNWAYML_API_SECRET", "key_test");
    expect(liveEnabled()).toBe(false);
    vi.stubEnv("RENDER_LIVE", "1");
    expect(liveEnabled()).toBe(true);
  });
});

describe("generateStill", () => {
  it("creates a gen4_image task without retry, waits 120 s, downloads and returns the bytes", async () => {
    const wait = succeedWith(PNG, { status: 200, headers: { "content-type": "application/octet-stream" } });
    const out = await generateStill(INPUT);
    expect(create).toHaveBeenCalledWith(
      { model: "gen4_image", promptText: "Medium shot. A robot.", ratio: "1280:720", seed: 7 },
      { maxRetries: 0 },
    );
    expect(wait).toHaveBeenCalledWith({ timeout: 120_000 });
    expect(out.contentType).toBe("image/png");
    expect(out.bytes).toEqual(PNG);
  });

  it("names jpeg and webp from the bytes", async () => {
    succeedWith(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]));
    expect((await generateStill(INPUT)).contentType).toBe("image/jpeg");
    const webp = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);
    succeedWith(webp);
    expect((await generateStill(INPUT)).contentType).toBe("image/webp");
  });

  it("maps a failed task to its reason and code", async () => {
    failWith(new TaskFailedError({ failure: "Blocked by moderation", failureCode: "SAFETY.INPUT.TEXT" } as never));
    await expect(generateStill(INPUT)).rejects.toThrow(
      "Runway task failed: Blocked by moderation (SAFETY.INPUT.TEXT)",
    );
  });

  it("maps a timeout", async () => {
    failWith(new TaskTimedOutError({} as never));
    await expect(generateStill(INPUT)).rejects.toThrow("Runway task timed out");
  });

  it("keeps the API secret out of any error it surfaces", async () => {
    vi.stubEnv("RUNWAYML_API_SECRET", "key_super_secret_value");
    failWith(new Error("401 bad credentials key_super_secret_value"));
    const err = await generateStill(INPUT).catch((e: Error) => e);
    expect((err as Error).message).toBe("401 bad credentials [redacted]");
  });

  it("fails on a bad download and on bytes that are not an image", async () => {
    succeedWith(PNG, { status: 403 });
    await expect(generateStill(INPUT)).rejects.toThrow("download failed: 403");
    succeedWith(new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c]));
    await expect(generateStill(INPUT)).rejects.toThrow("not a PNG, JPEG or WebP");
  });
});
