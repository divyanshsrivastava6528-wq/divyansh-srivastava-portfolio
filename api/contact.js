// Routes a visitor's message to Divyansh by email (Resend) and/or Telegram, whichever is configured.
import { readJson, tooMany } from "./_lib/http.js";

const s = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function channels() {
  return {
    email: !!(process.env.RESEND_API_KEY && process.env.CONTACT_TO_EMAIL),
    telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const ch = channels();
  if (!ch.email && !ch.telegram) return res.status(503).json({ error: "No delivery channel configured" });
  if (tooMany(req, "contact", 6)) return res.status(429).json({ error: "Too many messages. Try again later." });

  const b = (await readJson(req)) || {};
  if (s(b.website, 200)) return res.status(200).json({ ok: true }); // honeypot
  const msg = {
    name: s(b.name, 120), reply: s(b.reply, 160), message: s(b.message, 4000),
    intent: s(b.intentLabel, 60) || s(b.intent, 60) || "General", company: s(b.company, 160), role: s(b.role, 300),
    source: s(b.source, 40) || "website",
    transcript: Array.isArray(b.transcript) ? b.transcript.slice(-12).map((t) => ({ role: s(t?.role, 10), content: s(t?.content, 800) })) : [],
  };
  if (!msg.name || !msg.reply || !msg.message) return res.status(400).json({ error: "Name, contact and message are required" });

  const lines = [
    `New message from your portfolio (${msg.source === "assistant" ? "AI assistant hand-off" : "contact form"})`,
    "",
    `Reason: ${msg.intent}`,
    `Name: ${msg.name}`,
    `Reply to: ${msg.reply}`,
    msg.company ? `Company: ${msg.company}` : null,
    msg.role ? `Role: ${msg.role}` : null,
    "",
    msg.message,
  ].filter((l) => l !== null);
  if (msg.transcript.length) {
    lines.push("", "--- Chat transcript ---", ...msg.transcript.map((t) => `${t.role === "user" ? "Visitor" : "Assistant"}: ${t.content}`));
  }
  const text = lines.join("\n");
  const results = {};

  if (ch.email) {
    try {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(msg.reply);
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.CONTACT_FROM_EMAIL || "Portfolio <onboarding@resend.dev>",
          to: process.env.CONTACT_TO_EMAIL.split(",").map((x) => x.trim()),
          ...(isEmail ? { reply_to: msg.reply } : {}),
          subject: `[Portfolio] ${msg.intent}: ${msg.name}`,
          text,
          html: `<pre style="font:14px/1.5 -apple-system,Segoe UI,sans-serif;white-space:pre-wrap">${esc(text)}</pre>`,
        }),
      });
      results.email = r.ok;
      if (!r.ok) console.error("resend", r.status, await r.text());
    } catch (e) { console.error("resend", e); results.email = false; }
  }

  if (ch.telegram) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: text.slice(0, 4000), disable_web_page_preview: true }),
      });
      results.telegram = r.ok;
      if (!r.ok) console.error("telegram", r.status, await r.text());
    } catch (e) { console.error("telegram", e); results.telegram = false; }
  }

  const ok = Object.values(results).some(Boolean);
  return res.status(ok ? 200 : 502).json({ ok, results });
}
