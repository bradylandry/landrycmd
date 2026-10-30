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

test("a standalone lab page keeps its chrome and its links", async () => {
  const [embedJs, shellCss, slugs] = await Promise.all([
    read("./public/lab/embed.js"),
    read("./public/lab/lab-shell.css"),
    labSlugs(),
  ]);
  for (const slug of slugs) {
    const html = await read(`./public/lab/${slug}/index.html`);
    const dom = new JSDOM(html, { url: `http://localhost/lab/${slug}/`, runScripts: "outside-only" });
    const { window } = dom;
    const before = [...window.document.querySelectorAll("a[href]")].map((a) => a.getAttribute("target"));
    const style = window.document.createElement("style");
    style.textContent = shellCss;
    window.document.head.append(style);
    (window as unknown as { eval(code: string): void }).eval(embedJs);
    assert.equal(window.document.documentElement.classList.contains("lab-embed"), false, slug);
    const after = [...window.document.querySelectorAll("a[href]")].map((a) => a.getAttribute("target"));
    assert.deepEqual(after, before, slug);
    for (const chrome of window.document.querySelectorAll(".lab-header, .lab-footer")) {
      assert.notEqual(window.getComputedStyle(chrome).display, "none", `${slug} ${chrome.className}`);
    }
    window.close();
  }
});

test("the check fails on a lab without embed.js or with it above a link", async () => {
  const embedJs = await read("./public/lab/embed.js");
  const missing = embedProblems(`<a href="/">home</a>`, embedJs, "", embedUrl);
  assert.match(missing.join(), /does not load/);
  const early = embedProblems(`<script src="/lab/embed.js"></script><a href="/">home</a>`, embedJs, "", embedUrl);
  assert.match(early.join(), /before a link/);
});
