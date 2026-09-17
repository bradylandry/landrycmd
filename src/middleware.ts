import { defineMiddleware } from "astro:middleware";

/**
 * Two separate gates, deliberately.
 *
 * `/trips/*` is shared with family — the PIN gets handed out freely.
 * `/applications` exposes the job search: which companies, which roles, and
 * the private notes on each. Those must not open with the same code that
 * unlocks trip voting, so each scope has its own cookie and its own PIN.
 *
 * The scope is signed into the token payload rather than merely implied by
 * the cookie name. Both cookies are signed with the same TRIP_SECRET, so
 * without that binding anyone holding a trip token could copy its value into
 * the applications cookie and walk straight in.
 */
export type Scope = "trips" | "apps";

const TRIP_COOKIE = "trip_auth";
const APPS_COOKIE = "apps_auth";

const LOGIN_PATH = "/trips/login";
const PUBLIC_TRIPS = ["/trips/starbase-2026"];

const SECRET = import.meta.env.TRIP_SECRET || "";

/** Which cookie carries the token for a given scope. */
export function cookieFor(scope: Scope): string {
  return scope === "apps" ? APPS_COOKIE : TRIP_COOKIE;
}

/** Route prefix -> the scope required to view it. Longest prefix wins. */
const GATES: ReadonlyArray<{ prefix: string; scope: Scope }> = [
  { prefix: "/applications", scope: "apps" },
  { prefix: "/trips/", scope: "trips" },
];

// exported so API routes can authenticate requests independently of middleware route-matching
export async function verifyToken(
  token: string,
  expectedScope: Scope = "trips",
): Promise<boolean> {
  // Guard independently of the middleware's SECRET check — callers (vote.ts,
  // votes.ts) import this directly. With an empty SECRET, sign(payload, "")
  // produces predictable signatures that could be forged externally.
  if (!SECRET) return false;
  // token format: `${scope}:${issuedAt}:${expiresAt}.${sig}`
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return false;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!payload || !sig) return false;

  try {
    const expected = await sign(payload, SECRET);
    if (expected !== sig) return false;

    const parts = payload.split(":");
    let scope: string;
    let expiresAt: number;
    if (parts.length === 3) {
      scope = parts[0];
      expiresAt = parseInt(parts[2] ?? "0", 10);
    } else if (parts.length === 2) {
      // Tokens issued before scoping existed. They live in the trip cookie and
      // are honoured for trips only, so an old family cookie never carries
      // over into the job-search dashboard.
      scope = "trips";
      expiresAt = parseInt(parts[1] ?? "0", 10);
    } else {
      return false;
    }

    if (scope !== expectedScope) return false;
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

  const gate = GATES.find((g) => pathname.startsWith(g.prefix));
  if (!gate) return next();
  if (pathname === LOGIN_PATH || pathname === LOGIN_PATH + "/") return next();
  if (PUBLIC_TRIPS.some((p) => pathname === p || pathname === p + "/")) return next();

  // Catch misconfigured deployments before auth logic runs
  if (!SECRET) {
    console.error("TRIP_SECRET env var is required but not set");
    return new Response("Server misconfiguration", { status: 500 });
  }

  const token = context.cookies.get(cookieFor(gate.scope))?.value;
  if (!token || !(await verifyToken(token, gate.scope))) {
    return context.redirect(LOGIN_PATH + "?next=" + encodeURIComponent(pathname));
  }

  return next();
});

export { sign, TRIP_COOKIE, APPS_COOKIE };
// Back-compat alias: existing imports expect the trip cookie under this name.
export { TRIP_COOKIE as COOKIE_NAME };
