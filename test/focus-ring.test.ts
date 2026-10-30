import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { findFocusViolations, readSources } from "./focus-ring.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

function selectorsFlagged(css: string, markup = "") {
  return findFocusViolations([
    { path: "a.css", text: css },
    { path: "a.astro", text: markup },
  ]).map((violation) => violation.selector);
}

test("no shipped CSS removes or clips the focus ring", () => {
  const violations = findFocusViolations(readSources(root));
  assert.deepEqual(
    violations.map((v) => `${v.file}:${v.line}  ${v.selector}  ${v.reason}`),
    [],
  );
});

test("a site-wide :focus-visible ring does not excuse a more specific outline: none", () => {
  const css = `:focus-visible { outline: 2px solid red; }
.open:focus-visible { outline: none; }`;
  assert.deepEqual(selectorsFlagged(css), [".open:focus-visible"]);
});

test("a site-wide ring restores outline: none on a plain element", () => {
  const css = `:focus-visible { outline: 2px solid red; }
button { outline: 0; }`;
  assert.deepEqual(selectorsFlagged(css), []);
});

test("a ring on the same selector or a child restores the outline", () => {
  const link = `<a class="x" href="/"><span class="inner">x</span></a>`;
  assert.deepEqual(selectorsFlagged(".x { outline: none; }", link), [".x"]);
  assert.deepEqual(selectorsFlagged(".x { outline: none; } .x:focus-visible { box-shadow: 0 0 0 2px red; }", link), []);
  assert.deepEqual(selectorsFlagged(".x:focus-visible { outline: none; box-shadow: 0 0 0 2px red; }"), []);
  assert.deepEqual(selectorsFlagged(".x { outline: none; } .x:focus-visible .inner { outline: 2px solid red; }", link), []);
  assert.deepEqual(selectorsFlagged("a { outline: none; } @media (hover: hover) { a:focus-visible { outline: 2px solid red; } }"), ["a"]);
});

test("a decorative shadow is not a ring, on the element or a child", () => {
  const link = `<a class="x" href="/"><span>x</span></a>`;
  assert.deepEqual(selectorsFlagged("a { outline: none; } a:focus-visible span { box-shadow: 0 1px 2px #ccc; }"), ["a"]);
  assert.deepEqual(selectorsFlagged(".x { outline: none; } .x:focus-visible { box-shadow: 0 1px 2px #ccc; }", link), [".x"]);
  assert.deepEqual(selectorsFlagged(".x { outline: none; } .x:focus-visible { box-shadow: 0 1px 2px #ccc, 0 0 0 3px blue; }", link), []);
  // Digits inside a color must not be read as the spread.
  assert.deepEqual(selectorsFlagged("a { outline: none; } a:focus-visible span { box-shadow: 0 1px 2px rgba(61, 220, 151, 0.15); }"), ["a"]);
  assert.deepEqual(selectorsFlagged(".x { outline: none; } .x:focus-visible { box-shadow: 0 1px 2px #123; }", link), [".x"]);
  assert.deepEqual(selectorsFlagged(".x { outline: none; } .x:focus-visible { box-shadow: 0 1px 2px #333; }", link), [".x"]);
  assert.deepEqual(selectorsFlagged(".x { outline: none; } .x:focus-visible { box-shadow: 0 1px 2px var(--inset-color); }", link), [".x"]);
  assert.deepEqual(selectorsFlagged(".x { outline: none; } .x:focus-visible { box-shadow: 0 0 0 2px rgba(61, 220, 151, 0.5); }", link), []);
  assert.deepEqual(selectorsFlagged(".x { outline: none; } .x:focus-visible { box-shadow: inset 0 0 0 2px #123; }", link), []);
});

test("clip-path on a class carried by a link is flagged even with an outer ring", () => {
  const css = `:focus-visible { outline: 2px solid red; outline-offset: 3px; }
.cut { clip-path: polygon(0 0, 100% 0, 100% 100%); }`;
  assert.deepEqual(selectorsFlagged(css, `<a class="cut" href="/">x</a>`), [".cut"]);
});

test("clip-path is fine on a pseudo-element, a plain box, or with an inset ring", () => {
  const clip = "clip-path: polygon(0 0, 100% 0, 100% 100%);";
  const link = `<a class="cut" href="/">x</a><div class="plain"></div>`;
  assert.deepEqual(selectorsFlagged(`.cut::before { ${clip} }`, link), []);
  assert.deepEqual(selectorsFlagged(`.plain { ${clip} }`, link), []);
  assert.deepEqual(
    selectorsFlagged(`.cut { ${clip} } .cut:focus-visible { outline: 2px solid red; outline-offset: -3px; }`, link),
    [],
  );
});

test("focusable classes come from class expressions, tabindex, and createElement", () => {
  const css = ".a, .b, .c { outline: none; }";
  const violations = findFocusViolations([
    { path: "a.css", text: css },
    { path: "a.astro", text: `<button class={on ? "a" : ""}></button><div class="b" tabindex="0"></div>` },
    { path: "a.ts", text: `const el = document.createElement("button");\nel.className = "c";` },
  ]);
  assert.deepEqual(violations.map((v) => v.selector), [".a", ".b", ".c"]);
});

test("violations in a <style> block report the line in the file", () => {
  const [violation] = findFocusViolations([
    { path: "a.html", text: "<html>\n<style>\n.z { color: red; }\nbutton:focus {\n  outline: none;\n}\n</style>" },
  ]);
  assert.equal(violation?.line, 5);
});
