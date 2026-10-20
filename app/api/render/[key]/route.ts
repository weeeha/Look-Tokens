import { readFile } from "node:fs/promises";
import { diskCache, isRenderKey, renderDir } from "@/lib/render/cache";

// Read from disk on every request, never prerendered at build.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!isRenderKey(key)) return Response.json({ error: "Invalid render key" }, { status: 400 });

  const hit = await diskCache(renderDir()).find(key);
  if (!hit) return Response.json({ error: "Not cached" }, { status: 404 });

  const bytes = await readFile(hit.path);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": hit.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
