import { complete, provider, HANDOFF } from "./_lib/llm.js";
import { readJson, tooMany } from "./_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  if (!provider()) return res.status(503).json({ error: "AI is not configured" });
  if (tooMany(req, "chat", 30)) return res.status(429).json({ error: "Too many messages. Try again in a few minutes." });

  const body = await readJson(req);
  const raw = Array.isArray(body?.messages) ? body.messages : [];
  // Keep the last 12 turns, plain strings only, capped in length; must start and end on a user turn.
  let messages = raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return res.status(400).json({ error: "Send at least one user message" });
  // merge consecutive same-role turns (some providers reject them)
  messages = messages.reduce((acc, m) => {
    const prev = acc[acc.length - 1];
    if (prev && prev.role === m.role) prev.content += "\n\n" + m.content;
    else acc.push({ ...m });
    return acc;
  }, []);

  try {
    let text = (await complete(messages)).trim();
    const handoff = text.includes(HANDOFF);
    text = text.replaceAll(HANDOFF, "").trim();
    if (!text) text = "Divyansh should answer that one himself. I'll pass your message on.";
    return res.status(200).json({ reply: text, handoff });
  } catch (e) {
    console.error("chat error", e);
    return res.status(502).json({ error: "The assistant is unavailable right now" });
  }
}
