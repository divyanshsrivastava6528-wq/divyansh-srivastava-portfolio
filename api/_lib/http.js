// Small helpers shared by the API routes.

export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body; // Vercel already parsed it
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return null; } }
  const chunks = [];
  let size = 0;
  for await (const c of req) { size += c.length; if (size > 100_000) return null; chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return null; }
}

// Best-effort per-IP rate limit (memory resets when the serverless instance restarts).
const buckets = new Map();
export function tooMany(req, key, limit, windowMs = 10 * 60 * 1000) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
  const id = key + ":" + ip, now = Date.now();
  const b = buckets.get(id) || { n: 0, t: now };
  if (now - b.t > windowMs) { b.n = 0; b.t = now; }
  b.n++; buckets.set(id, b);
  if (buckets.size > 5000) buckets.clear();
  return b.n > limit;
}
