import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = new URL("..", import.meta.url);

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git" || entry.name === ".astro" || entry.name === ".vercel") {
      continue;
    }
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (/\.(astro|ts|mjs|md|css|svg|json|html)$/.test(entry.name)) files.push(path);
  }
  return files;
}

test("the site does not name the MCP platform as a spider web", async () => {
  const files = await sourceFiles(new URL(".", root).pathname);
  const banned = /spider[\s-]*web|spiderweb|acadiana/i;
  const hits: string[] = [];
  for (const file of files) {
    if (file.endsWith(`${join("test", "case-study.test.ts")}`)) continue;
    const text = await readFile(file, "utf8");
    if (banned.test(text)) hits.push(file);
  }
  assert.deepEqual(hits, []);
});

test("the MCP case study is its own page and the firewall bullet is unchanged", async () => {
  const page = await readFile(
    new URL("./src/pages/work/ai-network-operations.astro", root),
    "utf8",
  );
  assert.match(page, /AI Network Operations Platform \(MCP\)/);
  assert.match(page, /28/);
  assert.match(page, /~573/);
  assert.match(page, /44/);
  assert.equal(/<a [^>]*role="tab"|role="tab"/i.test(page), false);

  const resume = await readFile(new URL("./src/lib/resume.ts", root), "utf8");
  assert.match(
    resume,
    /Redesigned the Firewall Rule Request workflow through process and systems analysis, reducing a critical operational backlog by 80 percent\./,
  );
  assert.equal(resume.includes("30–60"), false);
  assert.equal(resume.includes("3–5"), false);
});
