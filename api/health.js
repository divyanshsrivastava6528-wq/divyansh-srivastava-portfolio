import { provider } from "./_lib/llm.js";
import { channels } from "./contact.js";
import { storeReady } from "./_lib/store.js";

export default function handler(req, res) {
  const ch = channels();
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ chat: !!provider(), contact: ch.email || ch.telegram, track: storeReady(), ai: provider(), channels: ch });
}
