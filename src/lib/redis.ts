import { Redis } from "@upstash/redis";

// Vercel's Upstash integration injects vars under either KV_* or UPSTASH_REDIS_* names depending
// on which marketplace flow was used. Prefer UPSTASH_* — when migrating from Vercel KV to
// Upstash, the old KV_* vars often stay set in the Vercel project env pointing at a deprecated
// instance that silently accepts writes but never persists. UPSTASH_* always tracks the live
// integration.
const url =
  import.meta.env.UPSTASH_REDIS_REST_URL ||
  import.meta.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_REST_API_URL;

const token =
  import.meta.env.UPSTASH_REDIS_REST_TOKEN ||
  import.meta.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_TOKEN;

let _redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!url || !token) return null;
  if (!_redis) {
    _redis = new Redis({ url, token });
  }
  return _redis;
}

export const VOTE_KEY = "trip:nyc-2026:votes";
export const VOTERS = ["brady", "stacy", "blake", "karsyn", "emrie"] as const;
export type Voter = (typeof VOTERS)[number];

export function isVoter(v: string): v is Voter {
  return (VOTERS as readonly string[]).includes(v);
}
