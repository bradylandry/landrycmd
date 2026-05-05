import { defineMiddleware } from "astro:middleware";

const COOKIE_NAME = "trip_auth";
const PROTECTED_PREFIX = "/trips/";
const LOGIN_PATH = "/trips/login";

const SECRET = import.meta.env.TRIP_SECRET || "dev-secret-change-me";

async function verifyToken(token: string): Promise<boolean> {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;

  try {
    const expected = await sign(payload, SECRET);
    return expected === sig;
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
  if (pathname.startsWith("/trips/api/")) return next();

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

// exported so the auth API route can reuse the same signing logic
export { sign, COOKIE_NAME };
