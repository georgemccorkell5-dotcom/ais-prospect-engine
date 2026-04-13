import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "./_lib/auth.js";
import { readText } from "./_lib/kvStore.js";
import { getSubPath } from "./_lib/routing.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return;

  const parts = getSubPath(req);
  const sub = parts[0] || "";

  // GET /api/configs/active
  if (sub === "active" && req.method === "GET") {
    try {
      const name = "ais-mn";
      let content = "";
      try { content = await readText(`config:${name}`); } catch {}
      res.json({ name, content });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
    return;
  }

  // POST /api/configs/switch — no-op for single-config app
  if (sub === "switch" && req.method === "POST") {
    res.json({ active: "ais-mn" });
    return;
  }

  // GET /api/configs — list
  if (sub === "" && req.method === "GET") {
    res.json(["ais-mn"]);
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
