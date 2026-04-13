import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    });
  }
  return _redis;
}

export async function readJSON<T>(key: string): Promise<T> {
  const data = await getRedis().get<T>(key);
  if (data === null || data === undefined) {
    throw new Error(`Key not found: ${key}`);
  }
  return data;
}

export async function writeJSON<T>(key: string, data: T): Promise<void> {
  await getRedis().set(key, data);
}

export async function readText(key: string): Promise<string> {
  const data = await getRedis().get<string>(key);
  if (data === null || data === undefined) {
    throw new Error(`Key not found: ${key}`);
  }
  return data;
}

export async function writeText(key: string, content: string): Promise<void> {
  await getRedis().set(key, content);
}

export async function listKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = 0;
  do {
    const [nextCursor, batch] = await getRedis().scan(cursor, { match: pattern, count: 100 });
    cursor = Number(nextCursor);
    keys.push(...(batch as string[]));
  } while (cursor !== 0);
  return keys;
}
