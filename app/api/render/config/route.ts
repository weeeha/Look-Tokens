import { CREDITS_PER_IMAGE } from "@/lib/render/limits";
import { liveEnabled } from "@/lib/render/runway";

// Reads process.env, so it must run per request. Prerendered, it would freeze
// live:false into the build.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { live: liveEnabled(), creditsPerImage: CREDITS_PER_IMAGE },
    { headers: { "Cache-Control": "no-store" } },
  );
}
