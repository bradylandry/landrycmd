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
  assert.match(css, /\.lab-grid/);
  assert.match(css, /grid-template-columns:\s*1fr 1fr/);
  assert.match(home, /class="lab-grid"/);
});

/**
 * Joint session history, the way Chrome records an iframe navigation:
 * assigning iframe.src commits a hidden entry after the current turn, on top
 * of any pushState from that same turn. Back pops that entry without a
 * parent popstate, so a close that only calls history.back() never reaches
 * the dialog.
 */
class DomNode {
  id = "";
  className = "";
  tag = "div";
  textContent = "";
  title = "";
  href = "";
  style: Record<string, string> = {};
  attributes: Record<string, string> = {};
  dataset: Record<string, string> = {};
  children: DomNode[] = [];
  listeners: Record<string, Array<(event: { target?: unknown; key?: string; preventDefault?: () => void }) => void>> = {};
  offsetHeight = 10;
  parent: DomNode | null = null;

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
    if (name === "class") this.className = value;
    if (name.startsWith("data-")) this.dataset[name.slice(5)] = value;
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  hasAttribute(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.attributes, name);
  }

  addEventListener(type: string, fn: (event: { target?: unknown }) => void): void {
    (this.listeners[type] ??= []).push(fn);
  }

  dispatch(type: string, event: { target?: unknown } = {}): void {
    for (const fn of this.listeners[type] ?? []) fn(event);
  }

  focus(): void {
    active = this;
  }

  click(): void {
    active = this;
    this.dispatch("click", { target: this });
  }

  querySelector(selector: string): DomNode | null {
    return queryAll(this, selector)[0] ?? null;
  }

  querySelectorAll(selector: string): DomNode[] {
    return queryAll(this, selector);
  }
}

class TestDialog extends DomNode {
  open = false;

  showModal(): void {
    this.open = true;
    this.setAttribute("open", "");
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.attributes.open = "";
    delete this.attributes.open;
    this.dispatch("close", {});
  }
}

class TestFrame extends DomNode {
  contentWindow: { location: { href: string; replace: (url: string) => void } };
  srcValue = "";
  onAssign: (url: string) => void;

  constructor(onAssign: (url: string) => void) {
    super();
    this.onAssign = onAssign;
    this.tag = "iframe";
    const frame = this;
    this.contentWindow = {
      location: {
        href: "about:blank",
        replace(url: string) {
          frame.contentWindow.location.href = url;
          frame.srcValue = url;
          frame.setAttribute("src", url);
        },
      },
    };
  }

  get src(): string {
    return this.srcValue;
  }

  set src(url: string) {
    this.srcValue = url;
    this.setAttribute("src", url);
    this.contentWindow.location.href = url;
    this.onAssign(url);
  }
}

class TestButton extends DomNode {
  constructor() {
    super();
    this.tag = "button";
  }
}

class TestAnchor extends DomNode {
  constructor() {
    super();
    this.tag = "a";
  }
}

let active: DomNode | null = null;

function matches(node: DomNode, selector: string): boolean {
  if (selector.startsWith("#")) return node.id === selector.slice(1);
  if (selector.startsWith(".")) return node.className.split(/\s+/).includes(selector.slice(1));
  if (selector === "button[data-lab]") return node.tag === "button" && "lab" in node.dataset;
  return false;
}

function queryAll(root: DomNode, selector: string): DomNode[] {
  const found: DomNode[] = [];
  const visit = (node: DomNode) => {
    if (matches(node, selector)) found.push(node);
    for (const child of node.children) visit(child);
  };
  visit(root);
  return found;
}

function child(parent: DomNode, node: DomNode): DomNode {
  node.parent = parent;
  parent.children.push(node);
  return node;
}

function labPage(): {
  doc: Document;
  win: Window;
  dialog: TestDialog;
  open: TestButton;
  close: TestButton;
  pushes: string[];
  length: () => number;
} {
  const entries: Array<{ kind: "page" | "iframe"; search: string }> = [{ kind: "page", search: "" }];
  let cursor = 0;
  const pushes: string[] = [];
  const popListeners: Array<() => void> = [];
  const location = {
    href: "http://localhost/",
    search: "",
  };

  function apply(search: string): void {
    location.search = search;
    location.href = `http://localhost/${search}`;
  }

  const frame = new TestFrame(() => {
    queueMicrotask(() => {
      entries.splice(cursor + 1);
      entries.push({ kind: "iframe", search: location.search });
      cursor = entries.length - 1;
    });
  });
  frame.className = "lab-dialog-frame";
  frame.setAttribute("class", "lab-dialog-frame");

  const title = new DomNode();
  title.id = "lab-dialog-title";
  title.tag = "h2";
  title.textContent = "Lab";

  const page = new TestAnchor();
  page.className = "lab-dialog-page";
  page.setAttribute("class", "lab-dialog-page");
  page.href = "/lab/mcp-simulator/";

  const close = new TestButton();
  close.className = "lab-dialog-close";
  close.setAttribute("class", "lab-dialog-close");
  close.textContent = "Close";

  const dialog = new TestDialog();
  dialog.id = "lab-dialog";
  dialog.className = "lab-dialog";
  child(dialog, title);
  child(dialog, page);
  child(dialog, frame);
  child(dialog, close);

  const open = new TestButton();
  open.setAttribute("data-lab", "mcp-simulator");
  open.setAttribute("data-lab-name", "MCP Integration Simulator");
  open.setAttribute("aria-expanded", "false");

  const body = new DomNode();
  body.tag = "body";
  child(body, open);
  child(body, dialog);
  const root = new DomNode();
  root.tag = "html";
  Object.assign(root, { clientWidth: 100 });

  const doc = {
    body,
    documentElement: root,
    get activeElement() {
      return active ?? body;
    },
    getElementById(id: string) {
      return queryAll(body, `#${id}`)[0] ?? null;
    },
    querySelector(selector: string) {
      return queryAll(body, selector)[0] ?? null;
    },
    querySelectorAll(selector: string) {
      return queryAll(body, selector);
    },
  };

  const win = {
    location,
    scrollY: 120,
    innerWidth: 100,
    scrollTo() {},
    requestAnimationFrame(cb: () => void) {
      return setTimeout(cb, 0);
    },
    cancelAnimationFrame(id: number) {
      clearTimeout(id);
    },
    setTimeout,
    clearTimeout,
    history: {
      get length() {
        return entries.length;
      },
      pushState(_state: unknown, _title: string, url: string) {
        const search = new URL(url, location.href).search;
        entries.splice(cursor + 1);
        entries.push({ kind: "page", search });
        cursor = entries.length - 1;
        apply(search);
        pushes.push(url);
      },
      replaceState(_state: unknown, _title: string, url: string) {
        const search = new URL(url, location.href).search;
        entries[cursor] = { kind: "page", search };
        apply(search);
      },
      back() {
        if (cursor === 0) return;
        cursor -= 1;
        const entry = entries[cursor];
        if (!entry || entry.kind !== "page") return;
        apply(entry.search);
        for (const fn of popListeners) fn();
      },
    },
    addEventListener(type: string, fn: () => void) {
      if (type === "popstate") popListeners.push(fn);
    },
  };

  Object.assign(globalThis, {
    HTMLElement: DomNode,
    HTMLDialogElement: TestDialog,
    HTMLIFrameElement: TestFrame,
    HTMLAnchorElement: TestAnchor,
    HTMLButtonElement: TestButton,
  });

  return {
    doc: doc as unknown as Document,
    win: win as unknown as Window,
    dialog,
    open,
    close,
    pushes,
    length: () => entries.length,
  };
}

test("opening a lab twice does not stick the dialog or push history", async () => {
  const page = labPage();
  const { mountLabDialog } = await import("../src/scripts/lab-dialog.ts");
  mountLabDialog(page.doc, page.win);
  const before = page.length();

  page.open.click();
  await Promise.resolve();
  assert.equal(page.dialog.open, true);
  page.close.click();
  await Promise.resolve();
  assert.equal(page.dialog.open, false);

  page.open.click();
  await Promise.resolve();
  assert.equal(page.dialog.open, true);
  page.close.click();
  await Promise.resolve();
  assert.equal(page.dialog.open, false);

  assert.deepEqual(page.pushes, []);
  assert.equal(page.length(), before);
});
