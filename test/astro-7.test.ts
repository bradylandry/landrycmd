import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { markdownToHtml } from "satteri";

const root = fileURLToPath(new URL("..", import.meta.url));

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function readJson(path: string): any {
  return JSON.parse(read(path));
}

function parts(version: string): number[] {
  return version.split(".").slice(0, 3).map((part) => Number(part));
}

function compare(left: number[], right: number[]): number {
  for (let i = 0; i < 3; i += 1) {
    const a = left[i] ?? 0;
    const b = right[i] ?? 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

function satisfies(range: string, version: string): boolean {
  const have = parts(version);
  return range.split("||").some((piece) => {
    const token = piece.trim();
    const caret = token.match(/^\^(\d+)\.(\d+)\.(\d+)$/);
    if (caret) {
      const want = [Number(caret[1]), Number(caret[2]), Number(caret[3])];
      if (have[0] !== want[0]) return false;
      return compare(have, want) >= 0;
    }
    const atLeast = token.match(/^>=(\d+)\.(\d+)\.(\d+)$/);
    if (atLeast) {
      const want = [Number(atLeast[1]), Number(atLeast[2]), Number(atLeast[3])];
      return compare(have, want) >= 0;
    }
    return false;
  });
}

function frontmatter(text: string): Record<string, string> {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, "entry is missing frontmatter");
  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    data[kv[1]] = kv[2].trim();
  }
  return data;
}

function publishedIds(dir: string): string[] {
  return readdirSync(join(root, dir))
    .filter((name) => name.endsWith(".md") || name.endsWith(".mdx"))
    .filter((name) => frontmatter(read(join(dir, name))).draft !== "true")
    .map((name) => name.replace(/\.(md|mdx)$/, ""))
    .sort();
}

test("astro integrations declare a peer range that accepts this astro", () => {
  const manifest = readJson("package.json");
  const astroVersion = readJson("node_modules/astro/package.json").version as string;
  assert.match(manifest.dependencies["@astrojs/mdx"], /^\^8\./);
  assert.match(manifest.dependencies["@astrojs/vercel"], /^\^11\./);
  for (const name of ["@astrojs/mdx", "@astrojs/vercel"]) {
    const peer = readJson(`node_modules/${name}/package.json`).peerDependencies.astro as string;
    assert.equal(
      satisfies(peer, astroVersion),
      true,
      `${name} peer ${peer} does not accept astro ${astroVersion}`,
    );
  }
  const lock = readJson("package-lock.json");
  assert.equal(lock.packages[""].dependencies["@astrojs/mdx"], manifest.dependencies["@astrojs/mdx"]);
  assert.equal(lock.packages[""].dependencies["@astrojs/vercel"], manifest.dependencies["@astrojs/vercel"]);
});

test("astro config drops hybrid output and the serverless entry", () => {
  const config = read("astro.config.mjs");
  assert.match(config, /from "@astrojs\/vercel"/);
  assert.doesNotMatch(config, /@astrojs\/vercel\/serverless/);
  assert.match(config, /adapter:\s*vercel\(\)/);
  assert.doesNotMatch(config, /output:\s*["']hybrid["']/);
  assert.doesNotMatch(config, /output:\s*["']server["']/);
});

test("content collections use the glob loader and keep draft defaults", () => {
  assert.equal(existsSync(join(root, "src/content/config.ts")), false);
  const config = read("src/content.config.ts");
  assert.match(config, /from "astro\/zod"/);
  assert.match(config, /from "astro\/loaders"/);
  assert.match(config, /loader:\s*glob\(/);
  assert.match(config, /base:\s*"\.\/src\/content\/writing"/);
  assert.match(config, /base:\s*"\.\/src\/content\/notes"/);
  assert.match(config, /z\.coerce\.date\(\)/);
  assert.match(config, /draft:\s*z\.boolean\(\)\.default\(false\)/);
  assert.match(config, /tags:\s*z\.array\(z\.string\(\)\)\.default\(\[\]\)/);
  assert.doesNotMatch(config, /type:\s*["']content["']/);

  const writing = z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  });
  const hello = writing.parse({
    title: "Hello: what this is",
    description: "A brief note",
    date: "2026-04-24",
    tags: ["meta"],
  });
  assert.equal(hello.draft, false);
  assert.ok(hello.date instanceof Date);

  const notes = z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  });
  const bare = notes.parse({ title: "Note", date: new Date("2026-04-24T00:00:00.000Z") });
  assert.equal(bare.draft, false);
  assert.deepEqual(bare.tags, []);
  assert.equal(bare.description, undefined);
});

test("collection pages use entry id and render()", () => {
  const writingEntry = read("src/pages/writing/[...slug].astro");
  const notesEntry = read("src/pages/notes/[...slug].astro");
  for (const source of [writingEntry, notesEntry]) {
    assert.match(source, /import \{[^}]*\brender\b[^}]*\} from "astro:content"/);
    assert.doesNotMatch(source, /\.render\(\)/);
    assert.doesNotMatch(source, /\.slug\b/);
  }
  assert.match(writingEntry, /params:\s*\{\s*slug:\s*post\.id\s*\}/);
  assert.match(writingEntry, /await render\(post\)/);
  assert.match(notesEntry, /params:\s*\{\s*slug:\s*note\.id\s*\}/);
  assert.match(notesEntry, /await render\(note\)/);

  const writingIndex = read("src/pages/writing/index.astro");
  const notesIndex = read("src/pages/notes/index.astro");
  const home = read("src/pages/index.astro");
  const rss = read("src/pages/rss.xml.ts");
  assert.match(writingIndex, /\/writing\/\$\{post\.id\}\//);
  assert.match(notesIndex, /\/notes\/\$\{note\.id\}\//);
  assert.match(home, /\/writing\/\$\{post\.id\}\//);
  assert.match(rss, /\/writing\/\$\{post\.id\}\//);
  for (const source of [writingIndex, notesIndex, home, rss]) {
    assert.match(source, /!\s*data\.draft/);
    assert.doesNotMatch(source, /post\.slug|note\.slug/);
  }
  assert.match(home, /p\.slug/);
});

test("writing ids keep the public urls and drafts stay unpublished", () => {
  assert.deepEqual(publishedIds("src/content/writing"), [
    "hello",
    "second-brain-for-my-ai",
    "shipping-on-claude-pro",
  ]);
  const drafts = ["ai-network-operations-platform", "airtap-mpls-bgp-build", "automation-lineage"];
  const published = new Set(publishedIds("src/content/writing"));
  for (const id of drafts) {
    assert.equal(published.has(id), false);
  }
  assert.deepEqual(publishedIds("src/content/notes"), []);
});

test("the shipping post table still renders as a table", () => {
  const text = read("src/content/writing/shipping-on-claude-pro.md");
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.startsWith("| Provider"));
  assert.ok(start >= 0);
  const table: string[] = [];
  for (let i = start; i < lines.length; i += 1) {
    if (!lines[i].startsWith("|")) break;
    table.push(lines[i]);
  }
  const { html } = markdownToHtml(table.join("\n"));
  assert.match(html, /<table>/);
  assert.match(html, /<th>Provider<\/th>/);
  assert.match(html, /Groq/);
  assert.match(html, /Cerebras/);
});

test("node floor is 22.23.4 and CI pins Node 24", () => {
  const manifest = readJson("package.json");
  const lock = readJson("package-lock.json");
  assert.equal(manifest.engines.node, ">=22.23.4");
  assert.equal(lock.packages[""].engines.node, ">=22.23.4");
  for (const path of [".github/workflows/ci.yml", ".github/workflows/verify.yml"]) {
    const workflow = read(path);
    assert.match(workflow, /node-version:\s*"24"/);
    assert.doesNotMatch(workflow, /22\.6/);
  }
});

test("one Vite 8 is installed and typescript is a direct devDependency", () => {
  const manifest = readJson("package.json");
  assert.match(manifest.devDependencies.vite, /^\^8\./);
  assert.match(manifest.devDependencies.typescript, /^\^5\.|^5\.|^\^6\.|^6\./);
  const vite = readJson("node_modules/vite/package.json");
  assert.equal(String(vite.version).startsWith("8."), true);
  assert.equal(existsSync(join(root, "node_modules/astro/node_modules/vite")), false);
  const typescript = readJson("node_modules/typescript/package.json");
  const major = Number(String(typescript.version).split(".")[0]);
  assert.ok(major === 5 || major === 6);
  const check = readJson("node_modules/@astrojs/check/package.json");
  assert.equal(satisfies(check.peerDependencies.typescript, typescript.version), true);
});

test("README describes Astro 7 static output", () => {
  const readme = read("README.md");
  assert.match(readme, /astro\.build\) 7\.x, static by default/);
  assert.doesNotMatch(readme, /Astro 4/);
  assert.doesNotMatch(readme, /hybrid/);
});

async function rewriteRuntimes(runtimes: Record<string, string>) {
  const dir = await mkdtemp(join(tmpdir(), "vc-runtime-"));
  try {
    for (const [name, runtime] of Object.entries(runtimes)) {
      const folder = join(dir, ".vercel/output/functions", name);
      await mkdir(folder, { recursive: true });
      await writeFile(
        join(folder, ".vc-config.json"),
        JSON.stringify({ runtime, handler: "entry.mjs", extra: true }),
      );
    }
    const result = spawnSync(process.execPath, [join(root, "scripts/vercel-node-runtime.mjs")], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const written: Record<string, { runtime: string; handler: string; extra: boolean }> = {};
    for (const name of Object.keys(runtimes)) {
      written[name] = JSON.parse(
        await readFile(join(dir, ".vercel/output/functions", name, ".vc-config.json"), "utf8"),
      );
    }
    return written;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("vercel runtime rewrite sends nodejs22.x functions to nodejs24.x", async () => {
  const written = await rewriteRuntimes({ "api/auth.func": "nodejs22.x" });
  assert.equal(written["api/auth.func"].runtime, "nodejs24.x");
  assert.equal(written["api/auth.func"].handler, "entry.mjs");
  assert.equal(written["api/auth.func"].extra, true);
});

test("vercel runtime rewrite still rewrites 18 and 20 and leaves 24 and edge", async () => {
  const written = await rewriteRuntimes({
    "old18.func": "nodejs18.x",
    "old20.func": "nodejs20.x",
    "current.func": "nodejs24.x",
    "edge.func": "edge",
  });
  assert.equal(written["old18.func"].runtime, "nodejs24.x");
  assert.equal(written["old20.func"].runtime, "nodejs24.x");
  assert.equal(written["current.func"].runtime, "nodejs24.x");
  assert.equal(written["edge.func"].runtime, "edge");
});

test("on-demand routes still fail closed and the adapter supplies clientAddress", () => {
  const applications = read("src/pages/applications.astro");
  const resume = read("src/pages/resume/[token].astro");
  const middleware = read("src/middleware.ts");
  const auth = read("src/pages/api/auth.ts");
  const publish = read("src/pages/api/publish-note.ts");
  for (const source of [applications, resume, auth, publish]) {
    assert.match(source, /prerender = false/);
  }
  assert.match(applications, /if \(!loaded\.ok\)/);
  assert.match(applications, /status: 500/);
  assert.match(resume, /if \(!loaded\.ok\)/);
  assert.match(resume, /status: 500/);
  assert.match(resume, /Astro\.clientAddress/);
  assert.match(middleware, /if \(!secret\)/);
  assert.match(middleware, /status: 500/);
  assert.match(auth, /if \(!pinExpected \|\| !secret\)/);
  assert.match(auth, /if \(!clientAddress\)/);
  assert.match(auth, /httpOnly:\s*true/);
  assert.match(auth, /sameSite:\s*"lax"/);
  assert.match(publish, /const GITHUB_TOKEN = import\.meta\.env\.GITHUB_TOKEN/);
  assert.match(publish, /if \(!GITHUB_TOKEN\)/);
  assert.match(publish, /if \(!PUBLISH_API_KEY/);
  assert.doesNotMatch(publish, /ghp_[A-Za-z0-9]/);
  assert.doesNotMatch(publish, /github_pat_/);
  const entry = read("node_modules/@astrojs/vercel/dist/serverless/entrypoint.js");
  assert.match(entry, /clientAddress/);
});
