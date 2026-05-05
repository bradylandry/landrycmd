import type { APIRoute } from "astro";
import { sign, COOKIE_NAME } from "../../../middleware";

export const prerender = false;

const PIN = import.meta.env.TRIP_PIN || "0000";
const SECRET = import.meta.env.TRIP_SECRET || "dev-secret-change-me";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// in-memory rate limit (resets when serverless instance recycles)
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count += 1;
  return true;
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const ip = clientAddress || "unknown";

  if (!checkRateLimit(ip)) {
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

  const issued = Date.now().toString();
  const sig = await sign(issued, SECRET);
  const token = `${issued}.${sig}`;

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
