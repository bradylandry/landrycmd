import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function loadNextCheck(): (rawNext: string) => string {
  const src = readFileSync(new URL("../src/pages/login.astro", import.meta.url), "utf8");
  const line = src.split("\n").find((entry) => entry.includes("const next ="));
  assert.ok(line, "login next check missing");
  const expr = line.trim().replace(/^const next = /, "").replace(/;$/, "");
  return new Function("rawNext", `return (${expr});`) as (rawNext: string) => string;
}

const nextOf = loadNextCheck();
const SITE = "https://landrycmd.com";

function destination(rawNext: string): string {
  return new URL(nextOf(rawNext), `${SITE}/login`).href;
}

test("a next value stays only when it is a single-slash path", () => {
  assert.equal(nextOf("/applications"), "/applications");
  assert.equal(nextOf("/applications?x=1"), "/applications?x=1");
  assert.equal(nextOf("/notes/hello"), "/notes/hello");
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
