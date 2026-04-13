import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_lib/auth.js";
import { readJSON, writeJSON } from "./_lib/kvStore.js";
import { getSubPath } from "./_lib/routing.js";
import type { Draft } from "./_lib/types.js";

const KEY = "drafts";

async function loadDrafts(): Promise<Draft[]> {
  try { return await readJSON<Draft[]>(KEY); } catch { return []; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return;

  const parts = getSubPath(req);
  const id = parts[0] || "";
  const drafts = await loadDrafts();

  if (!id) {
    if (req.method === "GET") { res.json(drafts); return; }
    if (req.method === "POST") {
      const now = new Date().toISOString();
      const draft: Draft = { id: crypto.randomUUID(), ...req.body, createdAt: now, updatedAt: now };
      drafts.push(draft);
      await writeJSON(KEY, drafts);
      res.status(201).json(draft);
      return;
    }
    res.status(405).json({ error: "Method not allowed" }); return;
  }

  const idx = drafts.findIndex((d) => d.id === id);
  if (req.method === "GET") {
    if (idx === -1) { res.status(404).json({ error: "Draft not found" }); return; }
    res.json(drafts[idx]); return;
  }
  if (req.method === "PUT") {
    if (idx === -1) { res.status(404).json({ error: "Draft not found" }); return; }
    drafts[idx] = { ...drafts[idx], ...req.body, updatedAt: new Date().toISOString() };
    await writeJSON(KEY, drafts);
    res.json(drafts[idx]); return;
  }
  if (req.method === "DELETE") {
    if (idx === -1) { res.status(404).json({ error: "Draft not found" }); return; }
    const removed = drafts.splice(idx, 1);
    await writeJSON(KEY, drafts);
    res.json(removed[0]); return;
  }
  res.status(405).json({ error: "Method not allowed" });
}
