import { defineMiddleware } from "astro:middleware";
import { serverEnv } from "./lib/private-config.mjs";
import { sign, verifyAppsToken } from "./lib/apps-token";

/**
 * /applications exposes the job search: which companies, which roles, and the
 * private notes on each. The scope is signed into the token payload rather
 * than merely implied by the cookie name.
 */
const APPS_COOKIE = "apps_auth";
const LOGIN_PATH = "/login";

function signingSecret(): string {
  return serverEnv("APPS_SECRET") || serverEnv("TRIP_SECRET");
}

export async function verifyToken(token: string): Promise<boolean> {
  return verifyAppsToken(token, signingSecret());
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  if (!pathname.startsWith("/applications")) return next();

  const secret = signingSecret();
  if (!secret) {
    console.error("APPS_SECRET env var is required but not set");
    return new Response("Server misconfiguration", { status: 500 });
  }

  const token = context.cookies.get(APPS_COOKIE)?.value;
  if (!token || !(await verifyToken(token))) {
    return context.redirect(LOGIN_PATH + "?next=" + encodeURIComponent(pathname));
  }

  return next();
});

export { sign, APPS_COOKIE };
