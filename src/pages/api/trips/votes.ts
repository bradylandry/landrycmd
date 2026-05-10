import type { APIRoute } from "astro";
import { getRedis, VOTE_KEY } from "../../../lib/redis";
import { verifyToken, COOKIE_NAME } from "../../../middleware";

export const prerender = false;

// GET /api/trips/votes
// returns { ok: true, votes: { [optionId]: [voter, voter, ...] } }
export const GET: APIRoute = async ({ cookies }) => {
  const token = cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return new Response(JSON.stringify({ ok: false, error: "Not authenticated" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const redis = getRedis();
  if (!redis) {
    return new Response(
      JSON.stringify({ ok: false, error: "Redis not configured" }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  // We store one Redis hash at VOTE_KEY where each field is `${optionId}:${voter}` => "1".
  // The @upstash/redis SDK auto-parses values that look like JSON, so the string "1" we wrote
  // comes back as the NUMBER 1 on read. Accept both forms in the filter — anything truthy is
  // a vote (we hdel when unvoting, so non-existent fields are the "no vote" state).
  const raw = (await redis.hgetall(VOTE_KEY)) as Record<string, unknown> | null;
  const votes: Record<string, string[]> = {};
  if (raw) {
    for (const [field, value] of Object.entries(raw)) {
      // Accept either "1" (string) or 1 (number) — Upstash type-coerces "1" → 1 on read
      if (value !== "1" && value !== 1) continue;
      const sep = field.lastIndexOf(":");
      if (sep < 0) continue;
      const optionId = field.slice(0, sep);
      const voter = field.slice(sep + 1);
      if (!votes[optionId]) votes[optionId] = [];
      votes[optionId].push(voter);
    }
  }

  return new Response(JSON.stringify({ ok: true, votes }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
};
