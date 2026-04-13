import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  let kvTest = "not tested";

  if (kvUrl && kvToken) {
    try {
      const redis = new Redis({ url: kvUrl, token: kvToken });
      const val = await redis.get("config:ais-mn");
      kvTest = `ok: ${JSON.stringify(val)}`;
    } catch (e) {
      kvTest = `error: ${String(e)}`;
    }
  } else {
    kvTest = `missing env: url=${!!kvUrl} token=${!!kvToken}`;
  }

  res.json({
    status: "ok",
    authRequired: !!process.env.AUTH_PASSWORD_HASH,
    kv: kvTest,
  });
}
