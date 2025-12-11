import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;
const redis = redisUrl ? new Redis(redisUrl) : null;
const MEMORY_SET = new Map<string, NodeJS.Timeout>();
const TTL_SECONDS = Number(process.env.DEDUP_TTL_SECONDS || 300);

async function setWithTtl(key: string) {
  if (redis) {
    await redis.setex(`dedup:${key}`, TTL_SECONDS, "1");
    return;
  }
  if (MEMORY_SET.has(key)) {
    clearTimeout(MEMORY_SET.get(key));
  }
  const timeout = setTimeout(() => MEMORY_SET.delete(key), TTL_SECONDS * 1000);
  MEMORY_SET.set(key, timeout);
}

async function exists(key: string): Promise<boolean> {
  if (redis) {
    const val = await redis.get(`dedup:${key}`);
    return Boolean(val);
  }
  return MEMORY_SET.has(key);
}

export async function isDuplicate(messageSid?: string): Promise<boolean> {
  if (!messageSid) return false;
  const dup = await exists(messageSid);
  if (!dup) {
    await setWithTtl(messageSid);
  }
  return dup;
}

