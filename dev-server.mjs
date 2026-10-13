// Local preview: `npm run dev`, then open http://localhost:3000
// Serves the static site and runs the /api functions the same way Vercel does.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";

if (existsSync(".env")) for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const types = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".pdf": "application/pdf", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };
const root = process.cwd();
const port = Number(process.env.PORT || 3000);

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); return res; };
  try {
    const api = url.pathname.match(/^\/api\/([a-z-]+)$/);
    if (api) {
      const file = join(root, "api", api[1] + ".js");
      if (!existsSync(file)) return res.status(404).json({ error: "Not found" });
      const mod = await import(file);
      return await mod.default(req, res);
    }
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    if (p.endsWith("/")) p += "index.html";
    const full = join(root, p);
    if (!full.startsWith(root) || p.includes("/api/_lib") || p.includes(".env")) return res.status(403).end();
    const data = await readFile(full);
    res.setHeader("Content-Type", types[extname(full)] || "application/octet-stream");
    res.end(data);
  } catch (e) {
    if (e.code === "ENOENT") return res.status(404).end("Not found");
    console.error(e); res.status(500).end("Server error");
  }
}).listen(port, () => console.log(`Portfolio running at http://localhost:${port}`));
