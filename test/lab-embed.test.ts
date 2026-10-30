import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";
import { embedProblems } from "./lab-embed.ts";

const root = new URL("..", import.meta.url);
const read = (rel: string) => readFile(new URL(rel, root), "utf8");
const embedUrl = "http://localhost/lab/x/?embed=1";

async function labSlugs() {
  const entries = await readdir(new URL("./public/lab/", root), { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

test("every lab page hides its chrome and targets the top window when embedded", async () => {
  const [embedJs, shellCss, slugs] = await Promise.all([
    read("./public/lab/embed.js"),
    read("./public/lab/lab-shell.css"),
    labSlugs(),
  ]);
  assert.ok(slugs.length >= 5);
  for (const slug of slugs) {
    const html = await read(`./public/lab/${slug}/index.html`);
    const problems = embedProblems(html, embedJs, shellCss, `http://localhost/lab/${slug}/?embed=1`);
    assert.deepEqual(problems, [], slug);
  }
});

test("a standalone lab page keeps its chrome", async () => {
  const embedJs = await read("./public/lab/embed.js");
  const dom = new JSDOM("<html></html>", { url: "http://localhost/lab/x/", runScripts: "outside-only" });
  (dom.window as unknown as { eval(code: string): void }).eval(embedJs);
  assert.equal(dom.window.document.documentElement.classList.contains("lab-embed"), false);
  dom.window.close();
});

test("the check fails on a lab without embed.js or with it above a link", async () => {
  const embedJs = await read("./public/lab/embed.js");
  const missing = embedProblems(`<a href="/">home</a>`, embedJs, "", embedUrl);
  assert.match(missing.join(), /does not load/);
  const early = embedProblems(`<script src="/lab/embed.js"></script><a href="/">home</a>`, embedJs, "", embedUrl);
  assert.match(early.join(), /before a link/);
});
