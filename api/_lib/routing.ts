import type { VercelRequest } from "@vercel/node";

/**
 * Extract sub-path parts from a Vercel rewrite.
 * Rewrites like /api/configs/:path* pass the captured segments as req.query.path
 * For /api/configs/active → ["active"]
 * For /api/configs → []
 * For /api/prospects/3/synthesize → ["3", "synthesize"]
 */
export function getSubPath(req: VercelRequest): string[] {
  const p = req.query.path;
  if (Array.isArray(p)) return p.filter(Boolean);
  if (typeof p === "string" && p) return p.split("/").filter(Boolean);
  return [];
}
