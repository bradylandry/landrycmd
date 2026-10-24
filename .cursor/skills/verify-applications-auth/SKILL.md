---
name: verify-applications-auth
description: "Formally check the applications auth cookie in src/middleware.ts (verifyToken, sign, signingSecret). Use when a change touches that cookie, the applications gate, or the payload minted by src/pages/api/auth.ts. A break lets a forged or expired cookie open the private job search."
---

# Verify applications auth

The applications cookie is accepted only when it is an unexpired HMAC-SHA256 (base64url, no padding) of `apps:<issuedAt>:<expiresAt>` under the configured signing secret. Accepting anything else shows the job search: which companies, which roles, and the private notes.

This is a property check on the real functions, not a hand model. No test in `npm test` calls `verifyToken`.

## When a change touches this

Run the check when a diff touches any of:

- `src/middleware.ts` (`signingSecret`, `sign`, `verifyToken`, `onRequest`)
- `src/pages/api/auth.ts` (the line that builds the payload, or the secret it signs with)

A pass does not cover the PIN or the rate limiter. Those files can still change without this check noticing, except for the two drift guards below.

## Check

From the repo root, with Node `>=22.6` (this repo's `engines` field). The run is local. It stubs `process.loadEnvFile` before loading middleware, so a gitignored `.env` is not read. It saves and restores `APPS_SECRET` and `TRIP_SECRET` and does not print their values.

```bash
node --experimental-strip-types --import ./.cursor/skills/verify-applications-auth/register.mjs ./.cursor/skills/verify-applications-auth/check.mjs
```

Exit 0 prints `ok verify-applications-auth` and the case count. Exit 1 prints one counterexample. `VERIFY_AUTH_SEED` (default `20261024`) and `VERIFY_AUTH_ROUNDS` (default `64`) repeat the random cases. The structured cases always run.

## Property

A cookie is accepted only when all of these hold:

1. The signing secret is non-empty. `APPS_SECRET` wins. If it is empty, `TRIP_SECRET` is the key. If both are empty, every cookie is rejected.
2. The bytes before the last `.` are the payload and the bytes after it are the signature. Both are non-empty.
3. An independent HMAC-SHA256 of the payload, keyed with that secret and encoded as base64url without padding (`node:crypto`), equals the signature.
4. The payload is exactly three colon-separated fields and the first field is `apps`.
5. `parseInt` of the third field is an integer greater than 0 and strictly greater than `Date.now()` at the call.

`sign` in `src/middleware.ts` has to match that same HMAC. `verifyToken` is what the gate calls.

## Coverage

Executed on every run:

- `signingSecret` in `src/middleware.ts` (which env var is the key)
- `sign` in `src/middleware.ts`
- `verifyToken` in `src/middleware.ts`

Drift guards, source text only, not a behavior proof:

- `onRequest` in `src/middleware.ts` still contains `await verifyToken(token)`
- `src/pages/api/auth.ts` still contains `` const payload = `apps:${issuedAt}:${expiresAt}`; ``

Sync commit: `fc5f068eb547c2142bce78469701d81df59d4418`

That commit is the tree of `src/middleware.ts` this check describes. Move the hash forward only after you re-read `signingSecret`, `sign`, and `verifyToken` at the new commit and confirm this file still describes them. A pass on a stale hash is not a pass on the new code.

## Bounds

The random cases are 64 canonical payloads of the form `apps:<integer>:<integer>` with a random ASCII secret, plus one signature mutation and one payload mutation each. The structured cases cover an expired expiry, a zero expiry, an expiry equal to the sampled millisecond, a non-numeric expiry, a scope other than `apps`, four colon fields, a missing signature, an empty token, a signature with an empty payload, a truncated signature, no secret, the wrong secret, `APPS_SECRET` winning over `TRIP_SECRET`, and the empty-`APPS_SECRET` fallthrough.

`verifyToken` does not cap lifetime at 30 days. It trusts the signed expiry. The 30-day cap is `TOKEN_TTL_MS` in `src/pages/api/auth.ts`, applied when the PIN is accepted. A far-future expiry that was signed with the secret is accepted. Secret theft is out of scope.

`issuedAt` is not range-checked. It is covered only as the middle field of a signed payload.

The third field is read with `parseInt`. The generated cases use canonical integers. A signed third field with trailing junk is not a separate case.

The MAC compare in `verifyToken` is ordinary string inequality. This check asserts the boolean result. It does not measure timing.

Not executed: `onRequest` (redirect to `/login`, and the 500 when the secret is missing), the PIN compare, `fallbackRateLimit`, `checkRateLimit`, cookie flags, Redis, `/resume/<token>`, and `findApplication`.

## Reading a failure

- `property:` is a product bug. The message names the cookie and whether `verifyToken` accepted or rejected it. Example, from a scratch edit that skipped the signature compare: a cookie whose payload was `apps:<issuedAt>:<future expiry>` and whose signature byte 24 had been replaced was accepted. The property says that cookie is rejected. Put the compare back. Do not weaken the predicate to make the check pass.
- `drift:` the source text moved. Re-read the named file and update the guard only if the new code still has the same gate and the same payload shape.
- `model:` the generator and the predicate inside `check.mjs` disagree. Fix the check. Do not treat it as a bug in `src/middleware.ts`.

A `property` failure whose text says `sign()` does not match `node:crypto` HMAC-SHA256 base64url means the hash or the encoding changed. Update `specMac` only when that change is intentional.

## Updating the check

When the new behavior is intentional, change the predicate or the drift guard so it describes the new code, run the command, and move the sync commit to the commit you confirmed. Keep the MAC computation in `node:crypto`. Do not point `specMac` at `sign()`.

## Helpers

The command above is the only one to run.

- `register.mjs` installs `loader.mjs` before the check starts (`node --import`).
- `loader.mjs` resolves `astro:middleware` to `astro-middleware-stub.mjs` so `src/middleware.ts` loads under plain Node.
- `astro-middleware-stub.mjs` returns the handler from `defineMiddleware`. The check never calls `onRequest`.
- `check.mjs` is the property check.

## Second target

The in-process PIN rate limit (`fallbackRateLimit` in `src/pages/api/auth.ts`) is the nearest unchecked promise. When Redis is unset, a break there lets a caller try `APPS_PIN` without the 5-per-minute cap, which is the other way into the same job search. It is not part of this check.

After edits that skip this skill, use `/maintain-formal-verification-skill`.
