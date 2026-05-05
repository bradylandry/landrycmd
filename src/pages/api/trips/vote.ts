import type { APIRoute } from "astro";
import { getRedis, VOTE_KEY, isVoter } from "../../../lib/redis";

export const prerender = false;

// POST /api/trips/vote
// body: { optionId: string, voter: string, action?: "toggle" | "set" | "unset" }
// returns { ok: true, voted: boolean }
export const POST: APIRoute = async ({ request }) => {
  const redis = getRedis();
  if (!redis) {
    return new Response(
      JSON.stringify({ ok: false, error: "Redis not configured" }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  let body: { optionId?: string; voter?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Bad request" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const optionId = (body.optionId || "").trim();
  const voter = (body.voter || "").trim().toLowerCase();
  const action = body.action || "toggle";

  // basic input validation — IDs are short slugs, no special chars
  if (!/^[a-z0-9-]{1,50}$/.test(optionId)) {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid optionId" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  if (!isVoter(voter)) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid voter" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const field = `${optionId}:${voter}`;
  let voted = false;

  if (action === "set") {
    await redis.hset(VOTE_KEY, { [field]: "1" });
    voted = true;
  } else if (action === "unset") {
    await redis.hdel(VOTE_KEY, field);
    voted = false;
  } else {
    // toggle
    const current = await redis.hget(VOTE_KEY, field);
    if (current === "1") {
      await redis.hdel(VOTE_KEY, field);
      voted = false;
    } else {
      await redis.hset(VOTE_KEY, { [field]: "1" });
      voted = true;
    }
  }

  return new Response(JSON.stringify({ ok: true, voted }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
