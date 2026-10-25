import { diskCache, renderDir } from "@/lib/render/cache";
import { handleRender, isJsonContentType } from "@/lib/render/handler";
import { generateStill, liveEnabled } from "@/lib/render/runway";

export async function POST(request: Request) {
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return Response.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const result = await handleRender(body, {
    cache: diskCache(renderDir()),
    live: liveEnabled(),
    generate: generateStill,
  });
  return Response.json(result.body, { status: result.status });
}
