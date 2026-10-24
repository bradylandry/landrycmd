#!/usr/bin/env node
/**
 * Property check for the applications cookie.
 *
 * A cookie is accepted only when it is an unexpired HMAC-SHA256 (base64url,
 * no padding) of the payload apps:<issuedAt>:<expiresAt> under the configured
 * signing secret. The MAC is computed with node:crypto, not with sign(), so a
 * break in src/middleware.ts is visible.
 *
 * One command:
 *   node --experimental-strip-types --import .cursor/skills/verify-applications-auth/register.mjs .cursor/skills/verify-applications-auth/check.mjs
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";

const savedEnv = {
  APPS_SECRET: process.env.APPS_SECRET,
  TRIP_SECRET: process.env.TRIP_SECRET,
};

// private-config calls loadEnvFile on first serverEnv read. A local .env can
// hold a real signing secret. This run must not read it.
process.loadEnvFile = () => {};

const seed = Number(process.env.VERIFY_AUTH_SEED ?? 20261024);
const rounds = Number(process.env.VERIFY_AUTH_ROUNDS ?? 64);
const root = new URL("../../../", import.meta.url);

const { verifyToken, sign } = await import(new URL("./src/middleware.ts", root).href);

const failures = [];
let cases = 0;

function restoreEnv() {
  for (const name of ["APPS_SECRET", "TRIP_SECRET"]) {
    const value = savedEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

function fail(kind, message) {
  failures.push({ kind, message });
}

function mulberry32(start) {
  let a = start >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(seed);
const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const macAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function randomSecret() {
  const len = 8 + Math.floor(rng() * 24);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(rng() * alphabet.length)];
  return out;
}

function specMac(payload, secret) {
  return createHmac("sha256", Buffer.from(secret, "utf8")).update(Buffer.from(payload, "utf8")).digest("base64url");
}

function macsEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function specAccepts(token, secret, now) {
  if (!secret) return false;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return false;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!payload || !sig) return false;
  if (!macsEqual(specMac(payload, secret), sig)) return false;
  const parts = payload.split(":");
  if (parts.length !== 3 || parts[0] !== "apps") return false;
  const expiresAt = parseInt(parts[2] ?? "0", 10);
  return expiresAt > 0 && now < expiresAt;
}

function useSecrets(apps, trip) {
  if (apps === undefined) delete process.env.APPS_SECRET;
  else process.env.APPS_SECRET = apps;
  if (trip === undefined) delete process.env.TRIP_SECRET;
  else process.env.TRIP_SECRET = trip;
}

function activeSecret(apps, trip) {
  return apps || trip || "";
}

async function expect(label, token, apps, trip, now, wanted) {
  if (failures.length) return;
  cases += 1;
  useSecrets(apps, trip);
  let got;
  try {
    got = await verifyToken(token);
  } catch (err) {
    fail("property", `${label}: verifyToken threw ${err instanceof Error ? err.name : "a non-error"}`);
    return;
  }
  const secret = activeSecret(apps, trip);
  const spec = specAccepts(token, secret, now);
  if (spec !== wanted) {
    fail(
      "model",
      `${label}: the spec predicate returned ${spec} but this case expected ${wanted}. The generator and the predicate disagree, so this is a modeling error, not a product bug.`,
    );
    return;
  }
  if (got !== wanted) {
    const verdict = got ? "accepted" : "rejected";
    const ought = wanted ? "accepted" : "rejected";
    const dot = token.lastIndexOf(".");
    const payload = dot < 0 ? token : token.slice(0, dot);
    fail(
      "property",
      `${label}. verifyToken ${verdict} this cookie. The property says it is ${ought}. Payload before the last dot: ${JSON.stringify(payload)}. Signing secret: ${apps ? "APPS_SECRET" : trip ? "TRIP_SECRET" : "unset"}.`,
    );
  }
}

function drift(rel, needle, why) {
  const text = readFileSync(new URL(rel, root), "utf8");
  if (!text.includes(needle)) fail("drift", why);
}

try {
  drift(
    "src/middleware.ts",
    "await verifyToken(token)",
    "src/middleware.ts onRequest no longer calls verifyToken. This check only executes verifyToken, so the gate could be open while the check still passes. Re-read onRequest and update the check before trusting it.",
  );
  drift(
    "src/pages/api/auth.ts",
    "const payload = `apps:${issuedAt}:${expiresAt}`;",
    "src/pages/api/auth.ts no longer builds apps:<issuedAt>:<expiresAt>. The accept set is that shape. Re-read the issuer and update the check before trusting it.",
  );

  const sampleSecret = "sample-secret";
  const samplePayload = "apps:1700000000000:9999999999999";
  const signed = await sign(samplePayload, sampleSecret);
  const independent = specMac(samplePayload, sampleSecret);
  cases += 1;
  if (signed !== independent) {
    fail(
      "property",
      `sign() does not match node:crypto HMAC-SHA256 base64url for payload ${samplePayload}. verifyToken calls sign(), so a standard HMAC-SHA256 cookie would not verify. If you changed the hash or the encoding on purpose, update specMac in check.mjs. If you did not, this is a bug.`,
    );
  }

  const now = Date.now();
  for (let i = 0; i < rounds; i++) {
    const secret = randomSecret();
    const issued = now - Math.floor(rng() * 86_400_000);
    const exp = now + 60_000 + Math.floor(rng() * 86_400_000 * 30);
    const payload = `apps:${issued}:${exp}`;
    const mac = specMac(payload, secret);
    const token = `${payload}.${mac}`;
    await expect(`valid cookie ${i}`, token, secret, undefined, now, true);

    const chars = mac.split("");
    const index = Math.floor(rng() * chars.length);
    const replacement = macAlphabet[Math.floor(rng() * macAlphabet.length)];
    if (replacement !== chars[index]) {
      chars[index] = replacement;
      await expect(
        `signature byte ${index} of cookie ${i} was replaced`,
        `${payload}.${chars.join("")}`,
        secret,
        undefined,
        now,
        false,
      );
    }

    const payloadChars = payload.split("");
    const payloadIndex = Math.floor(rng() * payloadChars.length);
    const payloadReplacement = payloadChars[payloadIndex] === "a" ? "b" : "a";
    payloadChars[payloadIndex] = payloadReplacement;
    await expect(
      `payload character ${payloadIndex} of cookie ${i} was changed and the old signature kept`,
      `${payloadChars.join("")}.${mac}`,
      secret,
      undefined,
      now,
      false,
    );
    if (failures.length) break;
  }

  if (!failures.length) {

  const secret = randomSecret();
  const other = randomSecret();
  const future = now + 3_600_000;
  const past = now - 3_600_000;
  const futurePayload = `apps:${now}:${future}`;
  const futureToken = `${futurePayload}.${specMac(futurePayload, secret)}`;

  await expect("expired expiry", `apps:${past}:${past}.${specMac(`apps:${past}:${past}`, secret)}`, secret, undefined, now, false);
  await expect("zero expiry", `apps:${now}:0.${specMac(`apps:${now}:0`, secret)}`, secret, undefined, now, false);
  await expect(
    "expiry equal to the current millisecond is already too late",
    `apps:${now}:${now}.${specMac(`apps:${now}:${now}`, secret)}`,
    secret,
    undefined,
    now,
    false,
  );
  await expect("non-numeric expiry", `apps:${now}:nope.${specMac(`apps:${now}:nope`, secret)}`, secret, undefined, now, false);
  await expect("scope is not apps", `user:${now}:${future}.${specMac(`user:${now}:${future}`, secret)}`, secret, undefined, now, false);
  await expect(
    "four colon fields",
    `apps:${now}:${future}:extra.${specMac(`apps:${now}:${future}:extra`, secret)}`,
    secret,
    undefined,
    now,
    false,
  );
  await expect("missing signature", futurePayload, secret, undefined, now, false);
  await expect("empty token", "", secret, undefined, now, false);
  await expect("signature only", `.${specMac(futurePayload, secret)}`, secret, undefined, now, false);
  await expect("truncated signature", `${futurePayload}.${specMac(futurePayload, secret).slice(0, 8)}`, secret, undefined, now, false);
  await expect("no signing secret", futureToken, undefined, undefined, now, false);
  await expect("signed with a different secret", futureToken, other, undefined, now, false);
  await expect("APPS_SECRET wins over TRIP_SECRET", futureToken, secret, other, now, true);
  const tripToken = `${futurePayload}.${specMac(futurePayload, other)}`;
  await expect("TRIP_SECRET is ignored while APPS_SECRET is set", tripToken, secret, other, now, false);
  await expect("empty APPS_SECRET falls through to TRIP_SECRET", tripToken, "", other, now, true);
  await expect("empty APPS_SECRET does not accept an APPS_SECRET signature", futureToken, "", other, now, false);

  const fromSign = `${futurePayload}.${await sign(futurePayload, secret)}`;
  await expect("cookie produced by sign()", fromSign, secret, undefined, now, true);
  }
} finally {
  restoreEnv();
}

if (failures.length) {
  console.error(`fail verify-applications-auth seed=${seed} cases=${cases} failures=${failures.length}`);
  for (const item of failures) console.error(`${item.kind}: ${item.message}`);
  process.exit(1);
}

console.log(`ok verify-applications-auth seed=${seed} cases=${cases}`);
console.log("sign() matches node:crypto HMAC-SHA256 base64url");
