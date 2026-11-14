import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

function text(path: string) {
  return readFile(new URL(path, root), "utf8");
}

// npm test imports jsdom. The old `>=22.6` floor still includes Node 22.6
// through 22.22.1, every 23.x, and Node 24.0 through 24.14, which jsdom 30
// refuses. CI installs the range this file checks, then runs the suite.
test("package engines and CI Node match the installed jsdom engines", async () => {
  const jsdom = JSON.parse(await text("node_modules/jsdom/package.json")) as {
    engines?: { node?: string };
  };
  const required = jsdom.engines?.node;
  assert.equal(typeof required, "string");

  const pkg = JSON.parse(await text("package.json")) as { engines: { node: string } };
  const lock = JSON.parse(await text("package-lock.json")) as {
    packages: { "": { engines: { node: string } } };
  };
  assert.equal(pkg.engines.node, required);
  assert.equal(lock.packages[""].engines.node, required);

  const ci = await text(".github/workflows/ci.yml");
  const verify = await text(".github/workflows/verify.yml");
  const skill = await text(".cursor/skills/verify-applications-auth/SKILL.md");
  assert.ok(ci.includes(`node-version: "${required}"`), "ci.yml node-version");
  assert.ok(verify.includes(`node-version: "${required}"`), "verify.yml node-version");
  assert.ok(
    ci.includes(`Node matches package.json engines (\`${required}\`).`),
    "ci.yml engines comment",
  );
  assert.ok(skill.includes(`Node \`${required}\``), "verify-applications-auth Node floor");
});
