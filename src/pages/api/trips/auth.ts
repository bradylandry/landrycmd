import type { APIRoute } from "astro";
import { sign, COOKIE_NAME } from "../../../middleware";
import { getRedis } from "../../../lib/redis";

export const prerender = false;

const PIN = import.meta.env.TRIP_PIN || "";
const SECRET = import.meta.env.TRIP_SECRET || "";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds
const TOKEN_TTL_MS = COOKIE_MAX_AGE * 1000;
const MAX_ATTEMPTS = 5;
const WINDOW_SEC = 60;

// In-process fallback counter used when Redis is unavailable or erroring.
// Keyed by IP; value is { count, expiresAt }.
const fallbackCounts = new Map<string, { count: number; expiresAt: number }>();

function fallbackRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = fallbackCounts.get(ip);
  if (!entry || now > entry.expiresAt) {
    fallbackCounts.set(ip, { count: 1, expiresAt: now + WINDOW_SEC * 1000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_ATTEMPTS;
}

async function checkRateLimit(ip: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) {
    // Redis not configured — use in-process counter so rate limiting still applies.
    console.error("Rate limiter: Redis unavailable, using in-process fallback for", ip);
    return fallbackRateLimit(ip);
  }
  try {
    const key = `ratelimit:auth:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, WINDOW_SEC);
    return count <= MAX_ATTEMPTS;
  } catch (err) {
    // Redis is configured but erroring — fall back to in-process counter rather
    // than failing open, so a Redis outage cannot uncork brute-force attempts.
    console.error("Rate limiter: Redis request failed, using in-process fallback for", ip, err);
    return fallbackRateLimit(ip);
  }
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  if (!PIN || !SECRET) {
    console.error("TRIP_PIN or TRIP_SECRET env var is not set");
    return new Response(JSON.stringify({ ok: false, error: "Server misconfiguration" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  // Never collapse all clients into a shared sentinel key — that turns the
  // limiter into a DoS vector (5 requests lock everyone out) and a bypass
  // (rotate IPs while sharing one bucket). Fail the request instead.
  if (!clientAddress) {
    console.error("clientAddress not provided by adapter — cannot rate-limit");
    return new Response(JSON.stringify({ ok: false, error: "Server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  const ip = clientAddress;

  if (!(await checkRateLimit(ip))) {
    return new Response(
      JSON.stringify({ ok: false, error: "Too many attempts. Wait a minute." }),
      { status: 429, headers: { "content-type": "application/json" } },
    );
  }

  let body: { pin?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Bad request" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const pin = (body.pin || "").trim();
  if (pin !== PIN) {
    return new Response(JSON.stringify({ ok: false, error: "Wrong code" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const issuedAt = Date.now();
  const expiresAt = issuedAt + TOKEN_TTL_MS;
  const payload = `${issuedAt}:${expiresAt}`;
  const sig = await sign(payload, SECRET);
  const token = `${payload}.${sig}`;

  cookies.set(COOKIE_NAME, token, {
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
