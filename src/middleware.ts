import { defineMiddleware } from "astro:middleware";

/**
 * /applications exposes the job search: which companies, which roles, and the
 * private notes on each. The scope is signed into the token payload rather
 * than merely implied by the cookie name.
 */
const APPS_COOKIE = "apps_auth";
const LOGIN_PATH = "/login";

const SECRET = process.env.TRIP_SECRET || import.meta.env.TRIP_SECRET || "";

export async function verifyToken(token: string): Promise<boolean> {
  if (!SECRET) return false;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return false;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!payload || !sig) return false;

  try {
    const expected = await sign(payload, SECRET);
    if (expected !== sig) return false;

    const parts = payload.split(":");
    if (parts.length !== 3 || parts[0] !== "apps") return false;
    const expiresAt = parseInt(parts[2] ?? "0", 10);
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
  if (!pathname.startsWith("/applications")) return next();

  if (!SECRET) {
    console.error("TRIP_SECRET env var is required but not set");
    return new Response("Server misconfiguration", { status: 500 });
  }

  const token = context.cookies.get(APPS_COOKIE)?.value;
  if (!token || !(await verifyToken(token))) {
    return context.redirect(LOGIN_PATH + "?next=" + encodeURIComponent(pathname));
  }

  return next();
});

export { sign, APPS_COOKIE };
