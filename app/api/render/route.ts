import { diskCache, renderDir } from "@/lib/render/cache";
import { handleRender } from "@/lib/render/handler";
import { generateStill, liveEnabled } from "@/lib/render/runway";

export async function POST(request: Request) {
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
