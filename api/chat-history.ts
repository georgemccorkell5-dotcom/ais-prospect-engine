import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_lib/auth.js";
import { readJSON, writeJSON } from "./_lib/kvStore.js";
import { getSubPath } from "./_lib/routing.js";
import type { ChatSession } from "./_lib/types.js";

const KEY = "chat-history";

async function loadSessions(): Promise<ChatSession[]> {
  try { return await readJSON<ChatSession[]>(KEY); } catch { return []; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return;

  const parts = getSubPath(req);
  const id = parts[0] || "";
  const sessions = await loadSessions();

  if (!id) {
    if (req.method === "GET") {
      const summaries = sessions
        .map(({ id, title, productConfig, createdAt, updatedAt }) => ({ id, title, productConfig, createdAt, updatedAt }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      res.json(summaries); return;
    }
    if (req.method === "POST") {
      const now = new Date().toISOString();
      const session: ChatSession = {
        id: crypto.randomUUID(), title: req.body.title || "New Chat",
        messages: req.body.messages || [], productConfig: req.body.productConfig || "ais-mn",
        createdAt: now, updatedAt: now,
      };
      sessions.push(session);
      await writeJSON(KEY, sessions);
      res.status(201).json(session); return;
    }
    res.status(405).json({ error: "Method not allowed" }); return;
  }

  const idx = sessions.findIndex((s) => s.id === id);
  if (req.method === "GET") {
    if (idx === -1) { res.status(404).json({ error: "Session not found" }); return; }
    res.json(sessions[idx]); return;
  }
  if (req.method === "PUT") {
    if (idx === -1) { res.status(404).json({ error: "Session not found" }); return; }
    sessions[idx] = { ...sessions[idx], ...req.body, id: sessions[idx].id, createdAt: sessions[idx].createdAt, updatedAt: new Date().toISOString() };
    await writeJSON(KEY, sessions);
    res.json(sessions[idx]); return;
  }
  if (req.method === "DELETE") {
    if (idx === -1) { res.status(404).json({ error: "Session not found" }); return; }
    const removed = sessions.splice(idx, 1);
    await writeJSON(KEY, sessions);
    res.json(removed[0]); return;
  }
  res.status(405).json({ error: "Method not allowed" });
}
