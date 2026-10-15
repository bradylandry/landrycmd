import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { LAB_SLUGS, readLabParam, tabDestination } from "../src/lib/labs.ts";
import {
  lockBackgroundScroll,
  releaseBackgroundScroll,
} from "../src/scripts/scroll-lock.ts";

const root = new URL("..", import.meta.url);

test("?lab= only accepts the five public labs", () => {
  assert.deepEqual(readLabParam("?lab=mcp-simulator"), "mcp-simulator");
  assert.equal(readLabParam("lab=frr-review"), "frr-review");
  assert.equal(readLabParam("?x=1&lab=ring-collapse"), "ring-collapse");
  assert.equal(readLabParam("?lab=migration-simulator"), "migration-simulator");
  assert.equal(readLabParam("?lab=airtap-mpls"), "airtap-mpls");
  assert.equal(readLabParam("?lab=jarvis"), null);
  assert.equal(readLabParam("?lab="), null);
  assert.equal(readLabParam(""), null);
  assert.equal(LAB_SLUGS.length, 5);
});

test("focus wraps only at the ends of the dialog", () => {
  assert.equal(tabDestination(3, 0, false), null);
  assert.equal(tabDestination(3, 1, false), null);
  assert.equal(tabDestination(3, 2, false), 0);
  assert.equal(tabDestination(3, 0, true), 2);
  assert.equal(tabDestination(3, 1, true), null);
  assert.equal(tabDestination(0, 0, false), null);
  assert.equal(tabDestination(3, -1, false), 0);
  assert.equal(tabDestination(3, -1, true), 2);
});

test("scroll lock never uses overflow:hidden and release clears it", () => {
  const bodyStyle = {
    position: "",
    top: "",
    left: "",
    right: "",
    width: "",
    paddingRight: "",
    overflow: "scroll",
  };
  const rootStyle = { overflow: "" };
  const body = { style: bodyStyle, offsetHeight: 10 };
  const root = { style: rootStyle, clientWidth: 100 };
  const frames: Array<() => void> = [];
  let scrollY = 480;
  const scrolled: number[] = [];
  const win = {
    scrollY,
    innerWidth: 116,
    scrollTo(_x: number, y: number) {
      scrollY = y;
      win.scrollY = y;
      scrolled.push(y);
    },
    requestAnimationFrame(cb: () => void) {
      frames.push(cb);
      return frames.length;
    },
    cancelAnimationFrame() {},
  };
  const doc = { body, documentElement: root };

  const saved = lockBackgroundScroll(
    doc as unknown as Document,
    win as unknown as Window,
  );
  assert.equal(saved, 480);
  assert.equal(bodyStyle.position, "fixed");
  assert.equal(bodyStyle.top, "-480px");
  assert.equal(bodyStyle.paddingRight, "16px");
  assert.equal(bodyStyle.overflow, "scroll");
  assert.equal(rootStyle.overflow, "");

  bodyStyle.overflow = "hidden";
  rootStyle.overflow = "hidden";
  releaseBackgroundScroll(doc as unknown as Document, win as unknown as Window, saved);

  assert.equal(bodyStyle.overflow, "");
  assert.equal(rootStyle.overflow, "");
  assert.equal(bodyStyle.position, "");
  assert.equal(bodyStyle.top, "");
  assert.equal(bodyStyle.paddingRight, "");
  assert.deepEqual(scrolled, [480]);

  for (const frame of frames) frame();
  assert.equal(bodyStyle.overflow, "");
  assert.equal(rootStyle.overflow, "");
  assert.equal(win.scrollY, 480);
});

test("homepage keeps the overview and opens each lab in a dialog", async () => {
  const home = await readFile(new URL("./src/pages/index.astro", root), "utf8");
  const thumb = await readFile(new URL("./src/components/LabThumb.astro", root), "utf8");
  const dialog = await readFile(new URL("./src/scripts/lab-dialog.ts", root), "utf8");
  const scroll = await readFile(new URL("./src/scripts/scroll-lock.ts", root), "utf8");
  const css = await readFile(new URL("./src/styles/global.css", root), "utf8");

  assert.match(home, /href="\/lab\/wire\.css"/);
  assert.match(home, /id="lab-dialog"/);
  assert.match(home, /class="lab-dialog-close"/);
  assert.match(home, /class="lab-dialog-frame"/);
  assert.match(home, /class="node-list"/);
  assert.match(home, /What you can inspect/);
  assert.match(home, /https:\/\/jarvis\.landrycmd\.com/);

  assert.match(home, /data-lab=\{p\.slug\}/);
  assert.match(home, /aria-haspopup="dialog"/);
  assert.match(home, /mountLabDialog/);
  for (const slug of LAB_SLUGS) {
    assert.match(home, new RegExp(`slug: "${slug}"`));
    assert.match(home, new RegExp(`"/lab/${slug}/"`));
    assert.match(thumb, new RegExp(`"${slug}"`));
    const page = await readFile(new URL(`./public/lab/${slug}/index.html`, root), "utf8");
    assert.match(page, /\/lab\/wire\.css/);
  }

  assert.match(thumb, /class="flow on"/);
  assert.equal(thumb.includes("stroke-dasharray"), false);
  assert.equal(thumb.includes("vrf-a"), false);
  assert.equal(thumb.includes("vrf-b"), false);
  assert.equal(/style\.overflow\s*=\s*["']hidden["']/.test(dialog + scroll), false);
  assert.match(dialog, /showModal/);
  assert.match(dialog, /Escape/);
  assert.match(dialog, /releaseBackgroundScroll/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /100dvh/);
});
