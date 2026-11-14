import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { safeNext } from "../src/lib/safe-next.mjs";

const SITE = "https://landrycmd.com";

function nextOf(rawNext: string): string {
  return safeNext(rawNext, SITE);
}

function destination(rawNext: string): string {
  return new URL(nextOf(rawNext), `${SITE}/login`).href;
}

test("a next value stays only when it is a single-slash path", () => {
  assert.equal(nextOf("/applications"), "/applications");
  assert.equal(nextOf("/applications?x=1"), "/applications?x=1");
  assert.equal(nextOf("/notes/hello"), "/notes/hello");
  assert.equal(nextOf("/notes/hello?x=1#part"), "/notes/hello?x=1#part");
  assert.equal(destination("/applications"), `${SITE}/applications`);
  assert.equal(destination("/notes/hello"), `${SITE}/notes/hello`);
});

test("an off-site next falls back to /applications", () => {
  const rejected = [
    "",
    "https://evil.com",
    "//evil.com",
    "///evil.com",
    "/\\evil.com",
    "/\\\\evil.com",
    "\\\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r\\evil.com",
    "/\t\\evil.com",
  ];
  for (const rawNext of rejected) {
    assert.equal(nextOf(rawNext), "/applications", JSON.stringify(rawNext));
    assert.equal(destination(rawNext), `${SITE}/applications`, JSON.stringify(rawNext));
  }
});

test("the decoded login query /\\evil.com does not leave the site", () => {
  const raw = new URL(`${SITE}/login?next=%2F%5Cevil.com`).searchParams.get("next") || "";
  assert.equal(raw, "/\\evil.com");
  assert.equal(nextOf(raw), "/applications");
  assert.equal(new URL(nextOf(raw), `${SITE}/login`).origin, SITE);

  const kept = new URL(`${SITE}/login?next=%2Fapplications`).searchParams.get("next") || "";
  assert.equal(nextOf(kept), "/applications");
});

test("a tab in the decoded next query does not leave the site", () => {
  const raw = new URL(`${SITE}/login?next=%2F%09%2Fevil.com`).searchParams.get("next") || "";
  assert.equal(raw, "/\t/evil.com");
  assert.equal(nextOf(raw), "/applications");
  assert.equal(destination(raw), `${SITE}/applications`);
  assert.equal(new URL(nextOf(raw), `${SITE}/login`).origin, SITE);
});

test("the login page resolves next with safeNext", () => {
  const src = readFileSync(new URL("../src/pages/login.astro", import.meta.url), "utf8");
  assert.match(src, /import \{ safeNext \} from "\.\.\/lib\/safe-next\.mjs"/);
  assert.match(src, /safeNext\(rawNext, location\.origin\)/);
});
