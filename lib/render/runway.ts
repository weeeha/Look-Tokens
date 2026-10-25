import RunwayML, { TaskFailedError, TaskTimedOutError } from "@runwayml/sdk";
import { RENDER_MODEL } from "./limits";

// Live rendering needs both switches: RENDER_LIVE=1 and a non-empty key.
// The key is read only by the SDK (RUNWAYML_API_SECRET); it is never logged or returned.
export function liveEnabled(): boolean {
  return process.env.RENDER_LIVE === "1" && (process.env.RUNWAYML_API_SECRET ?? "").trim() !== "";
}

// Content types the cache stores. The bytes decide, not the CDN's header,
// which is often application/octet-stream for signed storage URLs.
function sniffImageType(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  const tag = (from: number) => String.fromCharCode(...b.slice(from, from + 4));
  if (tag(0) === "RIFF" && tag(8) === "WEBP") return "image/webp";
  return null;
}

function describe(err: unknown): Error {
  if (err instanceof TaskFailedError) {
    const d = err.taskDetails as { failure?: string; failureCode?: string };
    const reason = d.failure ?? err.message;
    return new Error(`Runway task failed: ${reason}${d.failureCode ? ` (${d.failureCode})` : ""}`);
  }
  if (err instanceof TaskTimedOutError) return new Error("Runway task timed out");
  const text = err instanceof Error ? err.message : String(err);
  const secret = process.env.RUNWAYML_API_SECRET;
  return new Error(secret ? text.split(secret).join("[redacted]") : text);
}

// One billed gen4_image call. No retry of the create: a retried POST after a
// dropped response could bill twice. Polling reads keep the SDK's default retries.
export async function generateStill(input: {
  prompt: string;
  seed: number;
  ratio: "1280:720";
}): Promise<{ bytes: Uint8Array; contentType: string }> {
  try {
    const client = new RunwayML(); // reads RUNWAYML_API_SECRET
    const task = await client.textToImage
      .create(
        { model: RENDER_MODEL, promptText: input.prompt, ratio: input.ratio, seed: input.seed },
        { maxRetries: 0 },
      )
      .waitForTaskOutput({ timeout: 120_000 });

    // Output URLs are temporary, so download at once.
    const url = task.output[0];
    if (!url) throw new Error("Runway task succeeded but returned no output");
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`Runway output download failed: ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const contentType = sniffImageType(bytes);
    if (!contentType) throw new Error("Runway output is not a PNG, JPEG or WebP image");
    return { bytes, contentType };
  } catch (err) {
    throw describe(err);
  }
}
