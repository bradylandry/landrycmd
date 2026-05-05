import type { APIRoute } from "astro";
import { getRedis, VOTE_KEY } from "../../../lib/redis";

export const prerender = false;

// GET /api/trips/votes
// returns { ok: true, votes: { [optionId]: [voter, voter, ...] } }
export const GET: APIRoute = async () => {
  const redis = getRedis();
  if (!redis) {
    return new Response(
      JSON.stringify({ ok: false, error: "Redis not configured", votes: {} }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  // we store one Redis hash at VOTE_KEY where each field is `${optionId}:${voter}` => "1"
  // hgetall returns Record<string, string>
  const raw = (await redis.hgetall(VOTE_KEY)) as Record<string, string> | null;
  const votes: Record<string, string[]> = {};
  if (raw) {
    for (const [field, value] of Object.entries(raw)) {
      if (value !== "1") continue;
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
