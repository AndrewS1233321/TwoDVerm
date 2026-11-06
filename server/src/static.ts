import { createReadStream, existsSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const CLIENT_DIST = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../client/dist");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".woff2": "font/woff2",
};

export function clientBuildExists(): boolean {
  return existsSync(join(CLIENT_DIST, "index.html"));
}

/** Serves the built client (production only). Unknown paths fall back to index.html. */
export function serveClient(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? "/", "http://localhost");
  let filePath = normalize(join(CLIENT_DIST, decodeURIComponent(url.pathname)));
  if (!filePath.startsWith(CLIENT_DIST + sep) && filePath !== CLIENT_DIST) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) filePath = join(CLIENT_DIST, "index.html");
  const type = MIME[extname(filePath)] ?? "application/octet-stream";
  const cache = filePath.includes(`${sep}assets${sep}`) ? "public, max-age=31536000, immutable" : "no-cache";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": cache });
  createReadStream(filePath).pipe(res);
}
