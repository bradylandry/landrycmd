import { Redis } from "@upstash/redis";

// Vercel's Upstash integration injects vars under either KV_* or UPSTASH_REDIS_* names depending
// on which marketplace flow was used. Prefer UPSTASH_* — when migrating from Vercel KV to
// Upstash, the old KV_* vars often stay set in the Vercel project env pointing at a deprecated
// instance that silently accepts writes but never persists. UPSTASH_* always tracks the live
// integration.
// Read at request time. Astro 5 and later inline private import.meta.env
// values into the server bundle at build time.
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;

const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

let _redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!url || !token) return null;
  if (!_redis) {
    _redis = new Redis({ url, token });
  }
  return _redis;
}
