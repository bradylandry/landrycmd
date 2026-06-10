import { defineMiddleware } from "astro:middleware";

const COOKIE_NAME = "trip_auth";
const PROTECTED_PREFIX = "/trips/";
const LOGIN_PATH = "/trips/login";
const PUBLIC_TRIPS = ["/trips/starbase-2026"];

const SECRET = import.meta.env.TRIP_SECRET || "";

// exported so API routes can authenticate requests independently of middleware route-matching
export async function verifyToken(token: string): Promise<boolean> {
  // Guard independently of the middleware's SECRET check — callers (vote.ts,
  // votes.ts) import this directly. With an empty SECRET, sign(payload, "")
  // produces predictable signatures that could be forged externally.
  if (!SECRET) return false;
  // token format: `${issuedAt}:${expiresAt}.${sig}`
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return false;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!payload || !sig) return false;

  try {
    const expected = await sign(payload, SECRET);
    if (expected !== sig) return false;
    const expiresAt = parseInt(payload.split(":")[1] ?? "0", 10);
    return expiresAt > 0 && Date.now() < expiresAt;
  } catch {
    return false;
  }
}

async function sign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // only gate /trips/* routes (excluding the login page itself)
  if (!pathname.startsWith(PROTECTED_PREFIX)) return next();
  if (pathname === LOGIN_PATH || pathname === LOGIN_PATH + "/") return next();
  if (PUBLIC_TRIPS.some(p => pathname === p || pathname === p + "/")) return next();

  // Catch misconfigured deployments before auth logic runs
  if (!SECRET) {
    console.error("TRIP_SECRET env var is required but not set");
    return new Response("Server misconfiguration", { status: 500 });
  }
  const token = context.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return context.redirect(LOGIN_PATH + "?next=" + encodeURIComponent(pathname));
  }

  const ok = await verifyToken(token);
  if (!ok) {
    return context.redirect(LOGIN_PATH + "?next=" + encodeURIComponent(pathname));
  }

  return next();
});

export { sign, COOKIE_NAME };
