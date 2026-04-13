import type { VercelRequest, VercelResponse } from "@vercel/node";
import { hashPassword, generateToken } from "../_lib/auth.js";

const AUTH_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH || "";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // If no password configured, allow access
  if (!AUTH_PASSWORD_HASH) {
    res.json({ token: "dev-mode", message: "No password configured" });
    return;
  }

  const { password } = req.body || {};
  if (!password) {
    res.status(400).json({ error: "Password required" });
    return;
  }

  const hash = hashPassword(password);
  if (hash !== AUTH_PASSWORD_HASH) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  const token = generateToken(hash);
  res.json({ token });
}
