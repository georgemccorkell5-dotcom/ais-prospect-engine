import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac, timingSafeEqual } from "crypto";

const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret";
const AUTH_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH || "";

export function hashPassword(password: string): string {
  return createHmac("sha256", "ais-prospect").update(password).digest("hex");
}

export function generateToken(passwordHash: string): string {
  const payload = `${passwordHash}:${Math.floor(Date.now() / 1000)}`;
  const sig = createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64");
}

export function verifyToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return false;

    const [storedHash, _timestamp, sig] = parts;
    const expectedSig = createHmac("sha256", SESSION_SECRET)
      .update(`${storedHash}:${_timestamp}`)
      .digest("hex");

    const sigBuffer = Buffer.from(sig, "hex");
    const expectedBuffer = Buffer.from(expectedSig, "hex");
    if (sigBuffer.length !== expectedBuffer.length) return false;

    if (!timingSafeEqual(sigBuffer, expectedBuffer)) return false;

    if (storedHash !== AUTH_PASSWORD_HASH) return false;

    return true;
  } catch {
    return false;
  }
}

export function requireAuth(req: VercelRequest, res: VercelResponse): boolean {
  if (!AUTH_PASSWORD_HASH) return true;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (verifyToken(token)) return true;
  }

  const cookies = req.headers.cookie || "";
  const tokenMatch = cookies.match(/ais_token=([^;]+)/);
  if (tokenMatch && verifyToken(tokenMatch[1])) return true;

  res.status(401).json({ error: "Unauthorized" });
  return false;
}
