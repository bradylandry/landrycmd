import assert from "node:assert/strict";
import test from "node:test";
import { safeEqual } from "../src/lib/safe-compare.mjs";
import { sign, verifyAppsToken } from "../src/lib/apps-token.ts";
import { findApplication, type Application } from "../src/lib/private-config.mjs";

test("safeEqual accepts equal strings", () => {
  assert.equal(safeEqual("example-secret", "example-secret"), true);
});

test("safeEqual rejects unequal strings of the same length", () => {
  assert.equal(safeEqual("example-secret", "example-secreT"), false);
});

test("safeEqual rejects unequal strings of different length without throwing", () => {
  assert.equal(safeEqual("short", "a-much-longer-value"), false);
  assert.equal(safeEqual("example-secret", "example-secret-extra"), false);
});

test("safeEqual rejects empty inputs", () => {
  assert.equal(safeEqual("", ""), false);
  assert.equal(safeEqual("", "value"), false);
  assert.equal(safeEqual("value", ""), false);
});

test("safeEqual rejects non-string inputs", () => {
  assert.equal(safeEqual(null, "value"), false);
  assert.equal(safeEqual("value", undefined), false);
  assert.equal(safeEqual(123, "123"), false);
  assert.equal(safeEqual(undefined, undefined), false);
});

const SECRET = "example-signing-secret";

async function signedToken(expiresAt: number) {
  const payload = `apps:${Date.now()}:${expiresAt}`;
  return `${payload}.${await sign(payload, SECRET)}`;
}

test("verifyAppsToken accepts a valid signed token", async () => {
  const token = await signedToken(Date.now() + 60_000);
  assert.equal(await verifyAppsToken(token, SECRET), true);
});

test("verifyAppsToken rejects a tampered signature", async () => {
  const token = await signedToken(Date.now() + 60_000);
  const last = token.at(-1) === "A" ? "B" : "A";
  assert.equal(await verifyAppsToken(token.slice(0, -1) + last, SECRET), false);
  assert.equal(await verifyAppsToken(token + "x", SECRET), false);
});

test("verifyAppsToken rejects the wrong secret, an empty secret, and expired tokens", async () => {
  const token = await signedToken(Date.now() + 60_000);
  assert.equal(await verifyAppsToken(token, "other-secret"), false);
  assert.equal(await verifyAppsToken(token, ""), false);
  assert.equal(await verifyAppsToken(await signedToken(Date.now() - 1), SECRET), false);
});

const apps: Application[] = [
  { company: "No Token Co", role: "Role", sent: "2026-01-01", status: "applied" },
  { token: "example-aaa111", company: "Example Co", role: "Role", sent: "2026-01-01", status: "applied" },
  { token: "example-bbb222", company: "Other Co", role: "Role", sent: "2026-01-01", status: "held" },
];

test("findApplication matches by token", () => {
  assert.equal(findApplication("example-aaa111", apps)?.company, "Example Co");
  assert.equal(findApplication("example-bbb222", apps)?.company, "Other Co");
});

test("findApplication does not match a wrong, prefixed, or empty token", () => {
  assert.equal(findApplication("example-aaa112", apps), undefined);
  assert.equal(findApplication("example-aaa", apps), undefined);
  assert.equal(findApplication("", apps), undefined);
});
