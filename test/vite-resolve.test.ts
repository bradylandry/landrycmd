import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

// Astro 4 imports vite from files inside its own package. When the direct
// dependency is another major, npm nests Astro's vite and dev, build, and
// preview keep using that nested copy. loadEnv in tests must be the same one.
const require = createRequire(import.meta.url);

type Semver = [number, number, number];

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function parseSemver(text: string): Semver {
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(text.trim());
  assert.ok(match, `not a version: ${text}`);
  return [Number(match[1]), Number(match[2]), match[3] ? Number(match[3]) : 0];
}

function compareSemver(left: Semver, right: Semver) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function nodeFloor(range: string): Semver {
  const match = /^>=(\d+)\.(\d+)(?:\.(\d+))?$/.exec(range.trim());
  assert.ok(match, `expected a >= floor, got ${range}`);
  return [Number(match[1]), Number(match[2]), match[3] ? Number(match[3]) : 0];
}

function satisfiesEngines(version: Semver, engines: string) {
  return engines.split("||").some((part) => {
    const alt = part.trim();
    if (alt.startsWith(">=")) {
      return compareSemver(version, parseSemver(alt.slice(2))) >= 0;
    }
    if (alt.startsWith("^")) {
      const base = parseSemver(alt.slice(1));
      const nextMajor: Semver = [base[0] + 1, 0, 0];
      return compareSemver(version, base) >= 0 && compareSemver(version, nextMajor) < 0;
    }
    assert.fail(`unsupported node engines alternative: ${alt}`);
  });
}

function rangeMajor(spec: string) {
  const match = /(\d+)\./.exec(spec);
  assert.ok(match, spec);
  return match[1];
}

function packageKeys(lock: { packages: Record<string, unknown> }, name: string) {
  return Object.keys(lock.packages).filter(
    (key) => key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`),
  );
}

test("astro loads the same vite package as loadEnv", () => {
  assert.equal(typeof loadEnv, "function");
  const directPath = require.resolve("vite/package.json");
  const astroPkgPath = require.resolve("astro/package.json");
  const astroVitePath = createRequire(astroPkgPath).resolve("vite/package.json");
  assert.equal(directPath, astroVitePath);

  const direct = readJson(directPath);
  const astroPkg = readJson(astroPkgPath);
  const rootPkg = readJson(fileURLToPath(new URL("../package.json", import.meta.url)));
  assert.equal(direct.version, readJson(astroVitePath).version);
  assert.equal(rangeMajor(rootPkg.devDependencies.vite), direct.version.split(".")[0]);
  assert.equal(rangeMajor(astroPkg.dependencies.vite), direct.version.split(".")[0]);

  const lockPath = fileURLToPath(new URL("../package-lock.json", import.meta.url));
  const lock = readJson(lockPath);
  assert.deepEqual(packageKeys(lock, "vite"), ["node_modules/vite"]);
  assert.equal(lock.packages["node_modules/vite"].version, direct.version);

  const binPath = fileURLToPath(new URL("../node_modules/.bin/vite", import.meta.url));
  assert.equal(dirname(dirname(realpathSync(binPath))), dirname(astroVitePath));
});

test("declared Node floor satisfies the vite install", () => {
  const vitePkg = readJson(require.resolve("vite/package.json"));
  const rootPkg = readJson(fileURLToPath(new URL("../package.json", import.meta.url)));
  const floor = rootPkg.engines.node as string;
  assert.equal(satisfiesEngines(nodeFloor(floor), vitePkg.engines.node), true);

  const escaped = floor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`node-version:\\s*"${escaped}"`);
  const ci = readFileSync(fileURLToPath(new URL("../.github/workflows/ci.yml", import.meta.url)), "utf8");
  const verify = readFileSync(
    fileURLToPath(new URL("../.github/workflows/verify.yml", import.meta.url)),
    "utf8",
  );
  assert.match(ci, pattern);
  assert.match(verify, pattern);
});

test("lockfile keeps one hoisted esbuild on vite 5's postcss range", () => {
  const lock = readJson(fileURLToPath(new URL("../package-lock.json", import.meta.url)));
  const viteEntry = lock.packages["node_modules/vite"];
  assert.ok(viteEntry);
  assert.match(viteEntry.version, /^5\./);
  assert.match(viteEntry.dependencies.postcss, /^\^8\.4\./);
  assert.deepEqual(packageKeys(lock, "esbuild"), ["node_modules/esbuild"]);
});
