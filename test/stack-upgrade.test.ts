import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

type Version = [number, number, number];

function readText(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function readJson(rel: string) {
  return JSON.parse(readText(rel));
}

function parseVersion(version: string): Version {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, version);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compare(left: Version, right: Version) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function floorOf(range: string): Version {
  const match = range.match(/^(?:\^|>=)(\d+)\.(\d+)(?:\.(\d+))?$/);
  assert.ok(match, range);
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
}

function satisfies(version: string, range: string) {
  const parsed = parseVersion(version);
  if (range.startsWith("^")) {
    const floor = floorOf(range);
    if (compare(parsed, floor) < 0) return false;
    if (floor[0] > 0) return parsed[0] === floor[0];
    if (floor[1] > 0) return parsed[1] === floor[1];
    return parsed[2] === floor[2];
  }
  if (range.startsWith(">=")) {
    return compare(parsed, floorOf(range)) >= 0;
  }
  throw new Error(`unsupported range ${range}`);
}

function lockPackage(name: string) {
  const lock = readJson("package-lock.json");
  const entry = lock.packages[`node_modules/${name}`];
  assert.ok(entry, name);
  return entry;
}

test("astro 7, mdx, and vite resolve together", () => {
  const manifest = readJson("package.json");
  const astroVersion = lockPackage("astro").version as string;
  const viteVersion = lockPackage("vite").version as string;
  const vercelPeer = lockPackage("@astrojs/vercel").peerDependencies.astro as string;
  const mdxPeer = lockPackage("@astrojs/mdx").peerDependencies.astro as string;
  const astroVite = lockPackage("astro").dependencies.vite as string;

  assert.equal(floorOf(manifest.dependencies.astro)[0], 7);
  assert.equal(floorOf(manifest.dependencies["@astrojs/mdx"])[0], 8);
  assert.equal(floorOf(manifest.devDependencies.vite)[0], 8);
  assert.equal(parseVersion(astroVersion)[0], 7);
  assert.equal(satisfies(astroVersion, vercelPeer), true, `${astroVersion} vs ${vercelPeer}`);
  assert.equal(satisfies(astroVersion, mdxPeer), true, `${astroVersion} vs ${mdxPeer}`);
  assert.equal(satisfies(viteVersion, astroVite), true, `${viteVersion} vs ${astroVite}`);
  assert.equal(parseVersion(viteVersion)[0], floorOf(astroVite)[0]);
});

test("astro config loads the vercel adapter and static output", async () => {
  const config = (await import("../astro.config.mjs")).default;
  const source = readText("astro.config.mjs");
  assert.equal(config.output, "static");
  assert.equal(config.adapter?.name, "@astrojs/vercel");
  assert.doesNotMatch(source, /@astrojs\/vercel\/serverless/);
  assert.doesNotMatch(source, /output:\s*"hybrid"/);
});

test("content collections use the content layer loader", () => {
  assert.equal(existsSync(join(root, "src/content/config.ts")), false);
  const source = readText("src/content.config.ts");
  assert.match(source, /from "astro\/loaders"/);
  assert.match(source, /base:\s*"\.\/src\/content\/writing"/);
  assert.match(source, /base:\s*"\.\/src\/content\/notes"/);
  assert.match(source, /pattern:\s*"\*\*\/\*\.\{md,mdx\}"/);
  assert.doesNotMatch(source, /type:\s*"content"/);
});

test("collection pages render with entry ids", () => {
  const writing = readText("src/pages/writing/[...slug].astro");
  assert.match(writing, /import \{ getCollection, render \} from "astro:content"/);
  assert.match(writing, /params:\s*\{\s*slug:\s*post\.id\s*\}/);
  assert.match(writing, /await render\(post\)/);
  assert.doesNotMatch(writing, /post\.slug/);
  assert.doesNotMatch(writing, /post\.render\(/);

  const notes = readText("src/pages/notes/[...slug].astro");
  assert.match(notes, /import \{ getCollection, render \} from "astro:content"/);
  assert.match(notes, /params:\s*\{\s*slug:\s*note\.id\s*\}/);
  assert.match(notes, /await render\(note\)/);
  assert.doesNotMatch(notes, /note\.slug/);
  assert.doesNotMatch(notes, /note\.render\(/);

  const writingIndex = readText("src/pages/writing/index.astro");
  assert.match(writingIndex, /\/writing\/\$\{post\.id\}\//);
  assert.doesNotMatch(writingIndex, /post\.slug/);

  const notesIndex = readText("src/pages/notes/index.astro");
  assert.match(notesIndex, /\/notes\/\$\{note\.id\}\//);
  assert.doesNotMatch(notesIndex, /note\.slug/);

  const home = readText("src/pages/index.astro");
  assert.match(home, /\/writing\/\$\{post\.id\}\//);
  assert.doesNotMatch(home, /post\.slug/);
  assert.match(home, /p\.slug/);

  const rss = readText("src/pages/rss.xml.ts");
  assert.match(rss, /\/writing\/\$\{post\.id\}\//);
  assert.doesNotMatch(rss, /post\.slug/);
});

test("engines reject Node versions that cannot load the adapter bundler", () => {
  const manifest = readJson("package.json");
  const range = manifest.engines.node as string;
  const astroRange = lockPackage("astro").engines.node as string;
  for (const version of ["22.6.0", "22.11.0", "22.11.9"]) {
    assert.equal(satisfies(version, range), false, version);
  }
  assert.ok(compare(floorOf(range), [22, 12, 0]) >= 0);
  assert.ok(compare(floorOf(range), floorOf(astroRange)) >= 0);
  assert.equal(satisfies(process.versions.node, range), true);

  for (const workflow of [".github/workflows/ci.yml", ".github/workflows/verify.yml"]) {
    const source = readText(workflow);
    const match = source.match(/node-version:\s*"([^"]+)"/);
    assert.ok(match, workflow);
    assert.equal(satisfies("22.6.0", match[1]), false, workflow);
    assert.equal(satisfies("22.11.0", match[1]), false, workflow);
  }
});

test("post-build rewrites retired Node function runtimes to nodejs24.x", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vc-runtime-"));
  const cases = [
    ["nodejs18.x", "nodejs24.x"],
    ["nodejs20.x", "nodejs24.x"],
    ["nodejs22.x", "nodejs24.x"],
    ["nodejs24.x", "nodejs24.x"],
    ["edge", "edge"],
  ] as const;
  try {
    for (const [runtime] of cases) {
      const configPath = join(dir, ".vercel/output/functions", runtime, ".vc-config.json");
      await mkdir(dirname(configPath), { recursive: true });
      await writeFile(
        configPath,
        `${JSON.stringify({ runtime, handler: "index.mjs" }, null, "\t")}\n`,
      );
    }
    const result = spawnSync(process.execPath, [join(root, "scripts/vercel-node-runtime.mjs")], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    for (const [runtime, expected] of cases) {
      const configPath = join(dir, ".vercel/output/functions", runtime, ".vc-config.json");
      const config = JSON.parse(await readFile(configPath, "utf8"));
      assert.equal(config.runtime, expected, runtime);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("readme documents Astro 7 static output", () => {
  const readme = readText("README.md");
  assert.match(readme, /\[Astro\]\(https:\/\/astro\.build\) 7\.x, `static` output/);
  assert.doesNotMatch(readme, /hybrid/);
  assert.doesNotMatch(readme, /4\.x/);
});
