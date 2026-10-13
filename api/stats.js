// Dashboard data. Protected by the ADMIN_KEY environment variable.
import { timingSafeEqual } from "node:crypto";
import { pipeline, storeReady, lastDays } from "./_lib/store.js";
import { tooMany } from "./_lib/http.js";

function authorized(req) {
  const want = process.env.ADMIN_KEY || "";
  const got = String(req.headers["x-admin-key"] || "");
  if (want.length < 8 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (tooMany(req, "stats", 60)) return res.status(429).json({ error: "Too many requests" });
  if (!process.env.ADMIN_KEY) return res.status(503).json({ error: "Set ADMIN_KEY in your Vercel environment variables to use the dashboard." });
  if (!authorized(req)) return res.status(401).json({ error: "Wrong dashboard password." });
  if (!storeReady()) return res.status(503).json({ error: "Connect an Upstash Redis database in Vercel (Storage tab) to start collecting data." });

  const url = new URL(req.url, "http://x");
  const n = Math.min(Math.max(parseInt(url.searchParams.get("days") || "30", 10) || 30, 1), 90);
  const days = lastDays(n);

  const cmds = [];
  for (const d of days) cmds.push(["HGETALL", `d:${d}`], ["PFCOUNT", `u:${d}`], ["PFCOUNT", `c:${d}`], ["HGETALL", `src:${d}`]);
  const keys = (p) => days.map((d) => `${p}:${d}`);
  cmds.push(["PFCOUNT", ...keys("u")], ["PFCOUNT", ...keys("o")], ["PFCOUNT", ...keys("c")], ["PFCOUNT", ...keys("m")]);
  cmds.push(["LRANGE", "ev", 0, 2999]);
  const out = await pipeline(cmds);

  const toObj = (arr) => {
    if (!arr) return {};
    if (!Array.isArray(arr)) return arr;
    const o = {};
    for (let i = 0; i < arr.length; i += 2) o[arr[i]] = Number(arr[i + 1]);
    return o;
  };
  const daily = [], sources = {}, totals = {};
  days.forEach((d, i) => {
    const h = toObj(out[i * 4]);
    daily.push({ day: d, visitors: Number(out[i * 4 + 1] || 0), chatters: Number(out[i * 4 + 2] || 0), visits: h.visits || 0, questions: h.questions || 0, messages: h.messages || 0 });
    for (const [k, v] of Object.entries(h)) totals[k] = (totals[k] || 0) + Number(v);
    for (const [k, v] of Object.entries(toObj(out[i * 4 + 3]))) sources[k] = (sources[k] || 0) + Number(v);
  });
  const base = days.length * 4;
  const funnel = { visitors: Number(out[base] || 0), opened: Number(out[base + 1] || 0), asked: Number(out[base + 2] || 0), messaged: Number(out[base + 3] || 0) };

  const since = Date.parse(days[0] + "T00:00:00+05:30");
  const events = (out[base + 4] || []).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter((e) => e && e.t >= since);

  // Group events into visits (sessions), newest first.
  const sessions = new Map();
  for (const e of events) {
    let s = sessions.get(e.sid);
    if (!s) { s = { sid: e.sid, start: e.t, last: e.t, src: "", city: "", country: "", device: "", returning: false, chat: 0, opened: false, clicks: [], contacted: null }; sessions.set(e.sid, s); }
    s.start = Math.min(s.start, e.t); s.last = Math.max(s.last, e.t);
    if (e.type === "visit") Object.assign(s, { src: e.src, city: e.city, country: e.country, device: e.device, returning: e.returning });
    else if (e.type === "chat_message") s.chat++;
    else if (e.type === "chat_open") s.opened = true;
    else if (e.type === "message_sent") s.contacted = { intent: e.intent, company: e.company, delivered: e.delivered };
    else if (!s.clicks.includes(e.type)) s.clicks.push(e.type);
  }
  const recent = [...sessions.values()].filter((s) => s.src).sort((a, b) => b.start - a.start).slice(0, 60);
  const questions = events.filter((e) => e.type === "chat_message" && e.q).slice(0, 60).map((e) => ({ t: e.t, q: e.q, handoff: e.handoff, by: e.by }));
  const contacts = events.filter((e) => e.type === "message_sent").slice(0, 30).map((e) => ({ t: e.t, intent: e.intent, company: e.company, from: e.from, delivered: e.delivered }));

  res.status(200).json({ days: n, daily, totals, sources, funnel, recent, questions, contacts, generatedAt: Date.now() });
}
