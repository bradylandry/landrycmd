import type { APIRoute } from "astro";
import { getRedis, VOTE_KEY, isVoter } from "../../../lib/redis";
import { verifyToken, COOKIE_NAME } from "../../../middleware";

export const prerender = false;

// POST /api/trips/vote
// body: { optionId: string, voter: string, action?: "toggle" | "set" | "unset" }
// returns { ok: true, voted: boolean }
export const POST: APIRoute = async ({ request, cookies }) => {
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
  // NOTE: `voter` is taken from the request body and is NOT bound to the auth
  // token. This is intentional. The app uses a single shared family PIN — there
  // is no per-user identity in the token to bind against. Any authenticated
  // family member can cast/clear a vote on behalf of any other family member
  // (brady, stacy, blake, karsyn, emrie). This is acceptable for a private
  // family trip-planning app where everyone shares the same credential. If
  // per-user identity is ever required, issue per-user tokens (encode the voter
  // name as a signed claim at login) and reject requests where body.voter does
  // not match the token claim.
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
    // Atomic toggle via Lua — eliminates TOCTOU between concurrent requests
    const result = await redis.eval(
      `local c = redis.call('HGET', KEYS[1], ARGV[1])
       if c == '1' then
         redis.call('HDEL', KEYS[1], ARGV[1])
         return 0
       else
         redis.call('HSET', KEYS[1], ARGV[1], '1')
         return 1
       end`,
      [VOTE_KEY],
      [field],
    ) as number;
    voted = result === 1;
  }

  return new Response(JSON.stringify({ ok: true, voted }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
