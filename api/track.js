// Records anonymous visit, chat and click events for the dashboard.
import { readJson, tooMany } from "./_lib/http.js";
import { pipeline, storeReady, dayKey } from "./_lib/store.js";

const TYPES = new Set(["visit", "chat_open", "chat_message", "message_sent", "resume", "whatsapp", "linkedin", "copy_email", "copy_phone"]);
const COUNTER = { visit: "visits", chat_open: "chat_opens", chat_message: "questions", message_sent: "messages", resume: "resume", whatsapp: "whatsapp", linkedin: "linkedin", copy_email: "copy_email", copy_phone: "copy_phone" };
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|lighthouse|headless|curl|wget|python|axios/i;
const s = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const id = (v) => (typeof v === "string" && /^[a-z0-9]{6,32}$/i.test(v) ? v : "");

function device(ua) {
  if (/ipad|tablet/i.test(ua)) return "Tablet";
  if (/mobi|android|iphone/i.test(ua)) return "Mobile";
  return "Desktop";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  if (!storeReady()) return res.status(204).end();
  const ua = String(req.headers["user-agent"] || "");
  if (BOT.test(ua)) return res.status(204).end();
  if (tooMany(req, "track", 150)) return res.status(204).end();

  const b = (await readJson(req)) || {};
  const type = s(b.type, 30);
  const sid = id(b.sid), vid = id(b.vid);
  if (!TYPES.has(type) || !sid || !vid) return res.status(400).json({ error: "Bad event" });

  const day = dayKey();
  const h = req.headers;
  const ev = { t: Date.now(), type, sid, vid };
  if (type === "visit") {
    Object.assign(ev, {
      src: s(b.src, 40) || "Direct",
      ref: s(b.ref, 120),
      returning: !!b.returning,
      device: device(ua),
      city: decodeURIComponent(String(h["x-vercel-ip-city"] || "")).slice(0, 60),
      region: String(h["x-vercel-ip-country-region"] || "").slice(0, 10),
      country: String(h["x-vercel-ip-country"] || "").slice(0, 4),
    });
  }
  if (type === "chat_message") Object.assign(ev, { q: s(b.q, 300), by: s(b.by, 10), handoff: !!b.handoff });
  if (type === "message_sent") Object.assign(ev, { intent: s(b.intent, 40), company: s(b.company, 80), from: s(b.from, 20), delivered: !!b.delivered });

  const cmds = [
    ["HINCRBY", `d:${day}`, COUNTER[type], 1],
    ["EXPIRE", `d:${day}`, 60 * 60 * 24 * 400],
    ["LPUSH", "ev", JSON.stringify(ev)],
    ["LTRIM", "ev", 0, 2999],
  ];
  if (type === "visit") {
    cmds.push(["PFADD", `u:${day}`, vid], ["EXPIRE", `u:${day}`, 60 * 60 * 24 * 400]);
    cmds.push(["HINCRBY", `src:${day}`, ev.src, 1], ["EXPIRE", `src:${day}`, 60 * 60 * 24 * 400]);
  }
  if (type === "chat_message") cmds.push(["PFADD", `c:${day}`, vid], ["EXPIRE", `c:${day}`, 60 * 60 * 24 * 400]);
  if (type === "chat_open") cmds.push(["PFADD", `o:${day}`, vid], ["EXPIRE", `o:${day}`, 60 * 60 * 24 * 400]);
  if (type === "message_sent") cmds.push(["PFADD", `m:${day}`, vid], ["EXPIRE", `m:${day}`, 60 * 60 * 24 * 400]);

  try { await pipeline(cmds); } catch (e) { console.error("track", e); }
  return res.status(204).end();
}
