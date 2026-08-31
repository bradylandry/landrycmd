import type { APIRoute } from "astro";
import {
  findApplication,
  recordHit,
  looksAutomated,
} from "../../lib/applications";

export const prerender = false;

/**
 * Engagement beacon endpoint. Called by /r/[token] once the page has held
 * foreground focus long enough (or the visitor scrolled). Always returns 204
 * so a tracking failure is never visible to the person reading the résumé.
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const noContent = new Response(null, { status: 204 });

  try {
    const body = await request.json().catch(() => null);
    const token = body && typeof body.token === "string" ? body.token : null;
    if (!token) return noContent;

    // Only accept tokens we actually issued, so this can't be used to write
    // arbitrary keys into Redis.
    const app = findApplication(token);
    if (!app) return noContent;

    const ua = request.headers.get("user-agent") ?? undefined;

    await recordHit(app.token, {
      at: Date.now(),
      kind: "engaged",
      ip: clientAddress,
      ua,
      ref: request.headers.get("referer") ?? undefined,
      country: request.headers.get("x-vercel-ip-country") ?? undefined,
      bot: looksAutomated(ua),
    });
  } catch (err) {
    console.error("track beacon failed (non-fatal):", err);
  }

  return noContent;
};
