// Tiny Upstash Redis client over its REST API (no packages needed).
// Works with the env names Vercel's Upstash/KV integration creates, or Upstash's own.
const URL_ = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const storeReady = () => !!(URL_() && TOKEN());

export async function pipeline(commands) {
  const r = await fetch(URL_().replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN()}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error("store " + r.status + ": " + (await r.text()).slice(0, 200));
  const out = await r.json();
  return out.map((x) => (x.error ? null : x.result));
}

// Day key in the owner's timezone (default India).
export function dayKey(d = new Date()) {
  const tz = process.env.ANALYTICS_TZ || "Asia/Kolkata";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function lastDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(new Date(Date.now() - i * 86400000)));
  return [...new Set(out)];
}
