import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);

function read(path: string) {
  return readFileSync(new URL(path, root), "utf8");
}

function major(spec: string) {
  const match = /(\d+)/.exec(spec);
  assert.ok(match, spec);
  return Number(match[1]);
}

test("@types/node matches the engines floor and stays within the Vercel runtime", () => {
  const pkg = JSON.parse(read("package.json"));
  const lock = JSON.parse(read("package-lock.json"));
  const floor = major(pkg.engines.node);
  const declared = pkg.devDependencies["@types/node"];
  const locked = lock.packages["node_modules/@types/node"];
  const undiciTypes = lock.packages["node_modules/undici-types"].version;

  assert.equal(major(declared), floor);
  assert.equal(lock.packages[""].devDependencies["@types/node"], declared);
  assert.equal(major(locked.version), floor);

  const runtime = /const runtime = "nodejs(\d+)\.x"/.exec(read("scripts/vercel-node-runtime.mjs"));
  assert.ok(runtime);
  assert.ok(
    major(locked.version) <= Number(runtime[1]),
    `@types/node ${locked.version} is ahead of nodejs${runtime[1]}.x`,
  );

  assert.equal(major(locked.dependencies["undici-types"]), major(undiciTypes));

  for (const file of [".github/workflows/ci.yml", ".github/workflows/verify.yml"]) {
    const nodeVersion = /node-version:\s*"([^"]+)"/.exec(read(file));
    assert.ok(nodeVersion, file);
    assert.equal(nodeVersion[1], pkg.engines.node);
  }
});
