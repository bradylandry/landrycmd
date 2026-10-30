import type { APIRoute } from "astro";
import { getRedis } from "../../lib/redis";
import { serverEnv } from "../../lib/private-config.mjs";
import { safeEqual } from "../../lib/safe-compare.mjs";
import { APPS_COOKIE, sign } from "../../middleware";

export const prerender = false;

function appsPin(): string {
  return serverEnv("APPS_PIN");
}

function signingSecret(): string {
  return serverEnv("APPS_SECRET") || serverEnv("TRIP_SECRET");
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds
const TOKEN_TTL_MS = COOKIE_MAX_AGE * 1000;
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

async function checkRateLimit(ip: string): Promise<boolean> {
  const bucket = `apps:${ip}`;
  const redis = getRedis();
  if (!redis) {
    console.error("Rate limiter: Redis unavailable, using in-process fallback for", bucket);
    return fallbackRateLimit(bucket);
  }
  try {
    const key = `ratelimit:auth:${bucket}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, WINDOW_SEC);
    return count <= MAX_ATTEMPTS;
  } catch (err) {
    console.error("Rate limiter: Redis request failed, using in-process fallback for", bucket, err);
    return fallbackRateLimit(bucket);
  }
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const pinExpected = appsPin();
  const secret = signingSecret();
  if (!pinExpected || !secret) {
    console.error("APPS_PIN or APPS_SECRET env var is not set");
    return new Response(JSON.stringify({ ok: false, error: "Server misconfiguration" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  if (!clientAddress) {
    console.error("clientAddress not provided by adapter — cannot rate-limit");
    return new Response(JSON.stringify({ ok: false, error: "Server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  const ip = clientAddress;

  let body: { pin?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Bad request" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!(await checkRateLimit(ip))) {
    return new Response(
      JSON.stringify({ ok: false, error: "Too many attempts. Wait a minute." }),
      { status: 429, headers: { "content-type": "application/json" } },
    );
  }

  const pin = (body.pin || "").trim();
  if (!safeEqual(pin, pinExpected)) {
    return new Response(JSON.stringify({ ok: false, error: "Wrong code" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const issuedAt = Date.now();
  const expiresAt = issuedAt + TOKEN_TTL_MS;
  const payload = `apps:${issuedAt}:${expiresAt}`;
  const sig = await sign(payload, secret);
  const token = `${payload}.${sig}`;

  cookies.set(APPS_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
