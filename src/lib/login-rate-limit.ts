// Login try counter. Kept out of the Astro route so tests can drive it with a
// fake Redis client. No network.

const MAX_ATTEMPTS = 5;
const WINDOW_SEC = 60;

const fallbackCounts = new Map<string, { count: number; expiresAt: number }>();

function fallbackRateLimit(bucket: string): boolean {
  const now = Date.now();
  const entry = fallbackCounts.get(bucket);
  if (!entry || now > entry.expiresAt) {
    fallbackCounts.set(bucket, { count: 1, expiresAt: now + WINDOW_SEC * 1000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_ATTEMPTS;
}

export type RateLimitRedis = {
  set(
    key: string,
    value: string,
    opts: { nx: true; ex: number },
  ): Promise<"OK" | string | null>;
  incr(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
};

export async function checkRateLimit(ip: string, redis: RateLimitRedis | null): Promise<boolean> {
  const bucket = `apps:${ip}`;
  if (!redis) {
    console.error("Rate limiter: Redis unavailable, using in-process fallback for", bucket);
    return fallbackRateLimit(bucket);
  }
  try {
    const key = `ratelimit:auth:${bucket}`;
    // SET NX EX stores the first count and the minute in one command. INCR
    // cannot attach a TTL, and setting it only when the count was 1 left the
    // key with no expiry when that EXPIRE threw.
    const created = await redis.set(key, "1", { nx: true, ex: WINDOW_SEC });
    if (created === "OK") return true;
    const count = await redis.incr(key);
    try {
      // A key left behind with no TTL (an earlier EXPIRE threw) gets a minute
      // on a later try. A repair failure must not skip the count check.
      if ((await redis.ttl(key)) < 0) await redis.expire(key, WINDOW_SEC);
    } catch (err) {
      console.error("Rate limiter: failed to set TTL for", bucket, err);
    }
    return count <= MAX_ATTEMPTS;
  } catch (err) {
    console.error("Rate limiter: Redis request failed, using in-process fallback for", bucket, err);
    return fallbackRateLimit(bucket);
  }
}
