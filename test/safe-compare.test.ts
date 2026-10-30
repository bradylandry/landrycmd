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

test("safeEqual rejects strings with a lone surrogate", () => {
  // Both encode to the same utf8 replacement bytes, so they must not match.
  assert.equal(safeEqual("key\uD800", "key\uDBFF"), false);
  assert.equal(safeEqual("key\uD800", "key\uD800"), false);
  assert.equal(safeEqual("\uDC00", "\uDC01"), false);
  assert.equal(safeEqual("key\uD800", "key\uFFFD"), false);
});

test("safeEqual still accepts equal well-formed non-ASCII strings", () => {
  assert.equal(safeEqual("caf\u00e9-\u{1F600}", "caf\u00e9-\u{1F600}"), true);
  assert.equal(safeEqual("caf\u00e9", "cafe\u0301"), false);
});

test("verifyAppsToken rejects malformed tokens", async () => {
  const good = await signedToken(Date.now() + 60_000);
  const sig = good.slice(good.lastIndexOf(".") + 1);
  const malformed = [
    "",
    "no-dot-at-all",
    ".",
    `.${sig}`,
    good.slice(0, good.lastIndexOf(".") + 1),
    "apps:1:2.",
    "apps:1:2.\uD800",
    good.replace(".", "\uD800."),
  ];
  for (const token of malformed) {
    assert.equal(await verifyAppsToken(token, SECRET), false, JSON.stringify(token));
  }
});

test("verifyAppsToken rejects a validly signed payload with the wrong shape", async () => {
  const later = Date.now() + 60_000;
  for (const payload of [
    `other:${Date.now()}:${later}`,
    `apps:${later}`,
    `apps:${Date.now()}:${later}:extra`,
    `apps:${Date.now()}:not-a-number`,
    `apps:${Date.now()}:0`,
  ]) {
    const token = `${payload}.${await sign(payload, SECRET)}`;
    assert.equal(await verifyAppsToken(token, SECRET), false, payload);
  }
});

test("findApplication rejects malformed tokens and non-string input", () => {
  assert.equal(findApplication("example-aaa111\uD800", apps), undefined);
  assert.equal(findApplication("\uD800", apps), undefined);
  assert.equal(findApplication(null as unknown as string, apps), undefined);
  assert.equal(findApplication(123 as unknown as string, apps), undefined);
  const malformedRows: Application[] = [
    { token: "\uD800", company: "Bad A", role: "Role", sent: "2026-01-01", status: "applied" },
  ];
  assert.equal(findApplication("\uDBFF", malformedRows), undefined);
});

test("findApplication returns the first entry when two share a token", () => {
  const dupes: Application[] = [
    { token: "example-ccc333", company: "First Co", role: "Role", sent: "2026-01-01", status: "applied" },
    { token: "example-ccc333", company: "Second Co", role: "Role", sent: "2026-01-01", status: "applied" },
  ];
  assert.equal(findApplication("example-ccc333", dupes)?.company, "First Co");
});
