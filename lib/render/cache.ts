import { randomUUID } from "node:crypto";
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface CachedRender {
  path: string;
  contentType: string;
}

export interface RenderCache {
  find(key: string): Promise<CachedRender | null>;
  write(key: string, bytes: Uint8Array, contentType: string, meta: object): Promise<void>;
}

// Where renders live: RENDER_DIR, else a gitignored folder in the project root.
// One definition, so the route that writes and the route that reads agree.
export function renderDir(): string {
  return process.env.RENDER_DIR ?? path.join(process.cwd(), ".renders");
}

// The key becomes a file name, so only the exact shape renderKey() produces is
// accepted: 64 lowercase hex characters. Nothing else reaches the file system.
const KEY = /^[0-9a-f]{64}$/;

export function isRenderKey(s: string): boolean {
  return KEY.test(s);
}

// `dir` is runtime configuration (RENDER_DIR), not a project path. The comment
// stops Turbopack from tracing the whole project into the server bundle for it.
const inDir = (dir: string, name: string) => path.join(/* turbopackIgnore: true */ dir, name);

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const TYPES = Object.entries(EXT_BY_TYPE);

// Stores {key}.png|jpg|webp plus {key}.json (the meta, as provenance) in `dir`.
export function diskCache(dir: string): RenderCache {
  return {
    async find(key) {
      if (!isRenderKey(key)) return null;
      for (const [contentType, ext] of TYPES) {
        const file = inDir(dir, `${key}.${ext}`);
        try {
          if ((await stat(file)).isFile()) return { path: file, contentType };
        } catch {
          // not this extension
        }
      }
      return null;
    },

    async write(key, bytes, contentType, meta) {
      if (!isRenderKey(key)) throw new Error("Invalid render key");
      const ext = EXT_BY_TYPE[contentType];
      if (!ext) throw new Error(`Unsupported image type: ${contentType}`);
      await mkdir(dir, { recursive: true });
      await writeFile(inDir(dir, `${key}.json`), JSON.stringify(meta, null, 2) + "\n");
      // The image lands last, and by rename, so find() never sees half a file.
      const file = inDir(dir, `${key}.${ext}`);
      const tmp = `${file}.${randomUUID()}.tmp`;
      await writeFile(tmp, bytes);
      await rename(tmp, file);
    },
  };
}
