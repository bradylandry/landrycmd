import { readFile } from "node:fs/promises";
import { JSDOM, VirtualConsole } from "jsdom";

const FOLLOWING = 4;
const EPS = 0.75;

type Matrix = [number, number, number, number, number, number];
type Rect = {
  kind: "rect";
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  name: string;
  role: "node" | "label";
};
type Circle = { kind: "circle"; cx: number; cy: number; r: number; name: string; role: "node" };
type Obstacle = Rect | Circle;

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(m1: Matrix, m2: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

function parseTransform(value: string | null): Matrix {
  let m = IDENTITY;
  if (!value) return m;
  const re = /(translate|scale)\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value))) {
    const nums = match[2]
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (match[1] === "translate") {
      m = multiply(m, [1, 0, 0, 1, nums[0] || 0, nums[1] || 0]);
    } else {
      const sx = nums[0] || 1;
      m = multiply(m, [sx, 0, 0, nums[1] ?? sx, 0, 0]);
    }
  }
  return m;
}

function worldMatrix(el: Element): Matrix {
  const chain: Array<string | null> = [];
  for (let node: Element | null = el; node && node.tagName.toLowerCase() !== "svg"; node = node.parentElement) {
    chain.push(node.getAttribute("transform"));
  }
  let m = IDENTITY;
  for (const transform of chain.reverse()) m = multiply(m, parseTransform(transform));
  return m;
}

function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function classes(el: Element): Set<string> {
  return new Set((el.getAttribute("class") || "").split(/\s+/).filter(Boolean));
}

function hasClass(el: Element, name: string): boolean {
  return classes(el).has(name);
}

function isNodeGroup(el: Element): boolean {
  const names = classes(el);
  return names.has("node") || names.has("nd") || names.has("stage") || names.has("box");
}

function nodeName(el: Element): string {
  const label = el.getAttribute("aria-label");
  if (label) return label;
  const text = el.querySelector("text");
  const value = text?.textContent?.trim();
  if (value) return value;
  return el.getAttribute("class") || el.tagName;
}

function isLink(el: Element): boolean {
  if (el.tagName.toLowerCase() !== "path") return false;
  const names = classes(el);
  return names.has("flow") || names.has("edge") || names.has("mline") || names.has("rl");
}

function segmentsOf(d: string): Array<[number, number, number, number]> {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!tokens) return [];
  let i = 0;
  let cmd = "";
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  const segs: Array<[number, number, number, number]> = [];
  const num = () => Number(tokens[i++]);
  const push = (x2: number, y2: number) => {
    if (Math.hypot(x2 - x, y2 - y) > 1e-6) segs.push([x, y, x2, y2]);
    x = x2;
    y = y2;
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const op = cmd.toUpperCase();
    if (op === "M") {
      const nx = num();
      const ny = num();
      x = rel ? x + nx : nx;
      y = rel ? y + ny : ny;
      sx = x;
      sy = y;
      cmd = rel ? "l" : "L";
    } else if (op === "L") {
      const nx = num();
      const ny = num();
      push(rel ? x + nx : nx, rel ? y + ny : ny);
    } else if (op === "H") {
      const nx = num();
      push(rel ? x + nx : nx, y);
    } else if (op === "V") {
      const ny = num();
      push(x, rel ? y + ny : ny);
    } else if (op === "Z") {
      push(sx, sy);
    } else if (op === "C") {
      const c1x = rel ? x + num() : num();
      const c1y = rel ? y + num() : num();
      const c2x = rel ? x + num() : num();
      const c2y = rel ? y + num() : num();
      const ex = rel ? x + num() : num();
      const ey = rel ? y + num() : num();
      let px = x;
      let py = y;
      for (let step = 1; step <= 16; step++) {
        const t = step / 16;
        const u = 1 - t;
        const nx = u ** 3 * x + 3 * u ** 2 * t * c1x + 3 * u * t ** 2 * c2x + t ** 3 * ex;
        const ny = u ** 3 * y + 3 * u ** 2 * t * c1y + 3 * u * t ** 2 * c2y + t ** 3 * ey;
        segs.push([px, py, nx, ny]);
        px = nx;
        py = ny;
      }
      x = ex;
      y = ey;
    } else {
      throw new Error(`unsupported path command ${cmd} in ${d}`);
    }
  }
  return segs;
}

function hitsRect(x1: number, y1: number, x2: number, y2: number, rect: Rect): boolean {
  const minX = rect.minX + EPS;
  const maxX = rect.maxX - EPS;
  const minY = rect.minY + EPS;
  const maxY = rect.maxY - EPS;
  if (maxX - minX <= 0 || maxY - minY <= 0) return false;
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
      continue;
    }
    const r = q[i] / p[i];
    if (p[i] < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
  }
  return t1 - t0 > 1e-4;
}

function hitsCircle(x1: number, y1: number, x2: number, y2: number, circle: Circle): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((circle.cx - x1) * dx + (circle.cy - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const x = x1 + t * dx;
  const y = y1 + t * dy;
  return Math.hypot(x - circle.cx, y - circle.cy) < circle.r - EPS;
}

function lengthPx(value: string, fontSize: number): number {
  if (!value || value === "normal") return 0;
  if (value.endsWith("px")) return Number.parseFloat(value);
  if (value.endsWith("em")) return Number.parseFloat(value) * fontSize;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function labelBox(text: SVGTextElement): Rect | null {
  const value = text.textContent ?? "";
  if (!value.trim()) return null;
  const view = text.ownerDocument.defaultView;
  const computed = view?.getComputedStyle(text);
  const fontSize = lengthPx(computed?.fontSize || text.getAttribute("font-size") || "13px", 16) || 13;
  const family = computed?.fontFamily || "";
  const mono = /mono|var\(--mono\)/i.test(family) || hasClass(text, "geo") || hasClass(text, "pt");
  const advance = fontSize * (mono ? 0.6 : 0.52);
  const spacing = lengthPx(computed?.letterSpacing || "0", fontSize);
  const width = [...value].length * advance + Math.max(0, [...value].length - 1) * spacing;
  const anchor = computed?.getPropertyValue("text-anchor") || text.getAttribute("text-anchor") || "start";
  const x = Number(text.getAttribute("x") || 0);
  const y = Number(text.getAttribute("y") || 0);
  const left = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
  const top = y - fontSize * 0.8;
  const bottom = y + fontSize * 0.25;
  const m = worldMatrix(text);
  const corners = [
    apply(m, left, top),
    apply(m, left + width, top),
    apply(m, left, bottom),
    apply(m, left + width, bottom),
  ];
  const xs = corners.map((point) => point[0]);
  const ys = corners.map((point) => point[1]);
  return {
    kind: "rect",
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    name: value.trim(),
    role: "label",
  };
}

function rectBox(rect: SVGRectElement, name: string): Rect | null {
  const names = classes(rect);
  if (names.has("hit") || names.has("pip") || names.has("shadow") || names.has("bay")) return null;
  const width = Number(rect.getAttribute("width") || 0);
  const height = Number(rect.getAttribute("height") || 0);
  if (width <= 0 || height <= 0) return null;
  const x = Number(rect.getAttribute("x") || 0);
  const y = Number(rect.getAttribute("y") || 0);
  const m = worldMatrix(rect);
  const corners = [apply(m, x, y), apply(m, x + width, y), apply(m, x, y + height), apply(m, x + width, y + height)];
  const xs = corners.map((point) => point[0]);
  const ys = corners.map((point) => point[1]);
  return {
    kind: "rect",
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    name,
    role: "node",
  };
}

function circleBox(circle: SVGCircleElement, name: string): Circle | null {
  const names = classes(circle);
  if (["post", "pad", "padin", "mast", "flare"].some((name) => names.has(name))) return null;
  const r = Number(circle.getAttribute("r") || 0);
  if (r <= 0) return null;
  const [cx, cy] = apply(worldMatrix(circle), Number(circle.getAttribute("cx") || 0), Number(circle.getAttribute("cy") || 0));
  const scale = Math.hypot(worldMatrix(circle)[0], worldMatrix(circle)[1]) || 1;
  return { kind: "circle", cx, cy, r: r * scale, name, role: "node" };
}

function paintedBeforePacket(node: Element, packetLayer: Element): boolean {
  const position = packetLayer.compareDocumentPosition(node);
  return (position & FOLLOWING) === 0;
}

export async function checkLabHtml(html: string, name: string): Promise<string[]> {
  const wire = await readFile(new URL("../public/lab/wire.js", import.meta.url), "utf8");
  const shim =
    '<script>for (const el of document.querySelectorAll("[id]")) { if (!(el.id in window)) window[el.id] = el; }</script>';
  const page = html.replace(/<script\s+src="\/lab\/wire\.js"><\/script>/, `${shim}<script>${wire}</script>`);
  const virtualConsole = new VirtualConsole();
  const errors: string[] = [];
  virtualConsole.on("jsdomError", (error: Error) => {
    errors.push(error.stack || error.message);
  });
  const dom = new JSDOM(page, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://lab.local/lab/check/",
    virtualConsole,
  });
  if (errors.length > 0) return [`${name}: diagram script failed: ${errors[0]}`];

  const problems: string[] = [];
  const svgs = [...dom.window.document.querySelectorAll("svg")];
  let sawPackets = false;
  for (const svg of svgs) {
    const flows = [...svg.querySelectorAll("path.flow")];
    if (flows.length === 0) continue;
    sawPackets = true;
    const packetLayer = flows[0].parentElement;
    if (!packetLayer || packetLayer.tagName.toLowerCase() === "svg") {
      problems.push(`${name}: packet dashes are not in their own layer under the nodes`);
      continue;
    }
    const nodeGroups = [...svg.querySelectorAll("g")].filter(isNodeGroup);
    if (nodeGroups.length === 0) problems.push(`${name}: no node groups to paint above the packet layer`);
    for (const group of nodeGroups) {
      if (paintedBeforePacket(group, packetLayer)) {
        problems.push(`${name}: node "${nodeName(group)}" is painted before the packet layer`);
      }
    }

    const obstacles: Obstacle[] = [];
    for (const group of nodeGroups) {
      const label = nodeName(group);
      for (const rect of group.querySelectorAll("rect")) {
        const box = rectBox(rect, label);
        if (box) obstacles.push(box);
      }
      for (const circle of group.querySelectorAll("circle")) {
        const box = circleBox(circle, label);
        if (box) obstacles.push(box);
      }
    }
    for (const text of svg.querySelectorAll("text")) {
      const box = labelBox(text as SVGTextElement);
      if (box) obstacles.push(box);
    }

    for (const path of svg.querySelectorAll("path")) {
      if (!isLink(path)) continue;
      const d = path.getAttribute("d") || "";
      let pieces: Array<[number, number, number, number]>;
      try {
        pieces = segmentsOf(d);
      } catch (error) {
        problems.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      const m = worldMatrix(path);
      const kind = hasClass(path, "flow") ? "dash" : "link";
      for (const [x1, y1, x2, y2] of pieces) {
        const [ax, ay] = apply(m, x1, y1);
        const [bx, by] = apply(m, x2, y2);
        for (const obstacle of obstacles) {
          const hit =
            obstacle.kind === "rect"
              ? hitsRect(ax, ay, bx, by, obstacle)
              : hitsCircle(ax, ay, bx, by, obstacle);
          if (!hit) continue;
          problems.push(
            `${name}: ${kind} "${d}" crosses the interior of ${obstacle.role} "${obstacle.name}"`,
          );
        }
      }
    }
  }
  if (!sawPackets) problems.push(`${name}: no packet-dash layer`);
  dom.window.close();
  return problems;
}
