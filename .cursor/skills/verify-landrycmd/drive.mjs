/**
 * Drive the local (or preview) site in headless Chrome.
 * Writes evidence under VERIFY_OUT and removes only the browser it started.
 *
 *   node .cursor/skills/verify-landrycmd/drive.mjs
 *   node .cursor/skills/verify-landrycmd/drive.mjs --screenshots
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const screenshotsOnly = process.argv.includes("--screenshots");
const base = (process.env.VERIFY_BASE ?? "http://localhost:4321").replace(/\/$/, "");
const outDir = process.env.VERIFY_OUT ?? "/tmp/landrycmd-verify";
const chromeBin = process.env.CHROME_BIN ?? "/usr/bin/google-chrome";
const debugPort = Number(process.env.VERIFY_CHROME_PORT ?? 9333);

const labs = [
  "/lab/mcp-simulator/",
  "/lab/frr-review/",
  "/lab/migration-simulator/",
  "/lab/ring-collapse/",
  "/lab/airtap-mpls/",
];

const themePages = ["/", "/writing/", "/resume", "/work/ai-network-operations"];

await mkdir(outDir, { recursive: true });

const userData = `${outDir}/chrome-profile`;
const chrome = spawn(
  chromeBin,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${debugPort}`,
    "--remote-allow-origins=*",
    `--user-data-dir=${userData}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

let session;
try {
  const version = await waitForJson(`http://localhost:${debugPort}/json/version`);
  session = await connect(version.webSocketDebuggerUrl);
  const { targetId } = await session.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await session.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  await session.send("Page.enable", {}, sessionId);
  await session.send("Runtime.enable", {}, sessionId);
  if (screenshotsOnly) await blockApiRoutes(session, sessionId);

  const report = {
    base,
    screenshots: [],
    contrast: [],
    overflow: [],
    reducedMotion: [],
    menu: null,
    fullscreen: [],
    driven: null,
  };

  if (!screenshotsOnly) {
    for (const theme of ["dark", "light"]) {
      for (const page of themePages) {
        await open(session, sessionId, {
          path: page,
          width: 1280,
          theme,
          motion: "no-preference",
        });
        const hits = await evaluate(session, sessionId, contrastExpression());
        report.contrast.push({ theme, path: page, failures: hits });
      }
    }
    for (const page of ["/", ...labs]) {
      await open(session, sessionId, {
        path: page,
        width: 360,
        theme: "dark",
        motion: "no-preference",
      });
      const box = await evaluate(session, sessionId, `(() => {
        const el = document.scrollingElement || document.documentElement;
        return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
      })()`);
      report.overflow.push({ path: page, ...box, ok: box.scrollWidth <= box.clientWidth });
    }
    for (const page of ["/", ...labs]) {
      await open(session, sessionId, {
        path: page,
        width: 1440,
        theme: "dark",
        motion: "reduce",
      });
      const motion = await evaluate(session, sessionId, reducedMotionExpression());
      report.reducedMotion.push({ path: page, ...motion });
    }
    await open(session, sessionId, {
      path: "/",
      width: 360,
      theme: "dark",
      motion: "no-preference",
    });
    report.menu = await evaluate(session, sessionId, menuExpression());
    for (const width of [360, 768, 1440]) {
      await open(session, sessionId, {
        path: "/lab/mcp-simulator/",
        width,
        theme: "dark",
        motion: "no-preference",
      });
      const fs = await evaluate(session, sessionId, `(() => {
        const button = document.querySelector(".lab-fs");
        if (!button) return { present: false, display: null };
        return { present: true, display: getComputedStyle(button).display };
      })()`);
      const phone = width <= 719;
      const shown = fs.present && fs.display !== "none";
      report.fullscreen.push({
        width,
        ...fs,
        ok: phone ? shown : fs.present && fs.display === "none",
      });
    }
    await open(session, sessionId, {
      path: "/",
      width: 1280,
      theme: "dark",
      motion: "no-preference",
    });
    report.driven = await driveLab(session, sessionId);
  }

  for (const width of [360, 768, 1440]) {
    await open(session, sessionId, {
      path: "/",
      width,
      theme: "dark",
      motion: "no-preference",
    });
    const file = `${outDir}/home-${width}.png`;
    await screenshot(session, sessionId, file, width);
    report.screenshots.push(file);
  }

  const reportPath = `${outDir}/report.json`;
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(summarize(report), null, 2));
  console.log(`report ${reportPath}`);

  const failed = failuresOf(report);
  if (failed.length) {
    console.error(failed.join("\n"));
    process.exitCode = 1;
  }
} finally {
  chrome.kill("SIGKILL");
  session?.ws.close();
}

function summarize(report) {
  return {
    base: report.base,
    screenshots: report.screenshots,
    contrastFailures: (report.contrast ?? []).flatMap((item) =>
      item.failures.map((failure) => ({ theme: item.theme, path: item.path, ...failure })),
    ),
    overflow: report.overflow,
    reducedMotion: report.reducedMotion,
    menu: report.menu,
    fullscreen: report.fullscreen,
    driven: report.driven,
  };
}

function failuresOf(report) {
  const failed = [];
  for (const item of report.contrast ?? []) {
    for (const failure of item.failures) {
      failed.push(`contrast ${item.theme} ${item.path} ${failure.sample} ${failure.ratio}`);
    }
  }
  for (const item of report.overflow ?? []) {
    if (!item.ok) failed.push(`overflow ${item.path} ${item.scrollWidth}>${item.clientWidth}`);
  }
  for (const item of report.reducedMotion ?? []) {
    if (!item.ok) failed.push(`reduced-motion ${item.path} ${JSON.stringify(item)}`);
  }
  if (report.menu && !report.menu.ok) failed.push(`menu ${JSON.stringify(report.menu)}`);
  for (const item of report.fullscreen ?? []) {
    if (!item.ok) failed.push(`fullscreen ${item.width} display=${item.display}`);
  }
  if (report.driven && !report.driven.ok) failed.push(`drive ${JSON.stringify(report.driven)}`);
  return failed;
}

async function open(session, sessionId, { path, width, theme, motion }) {
  await session.send(
    "Emulation.setDeviceMetricsOverride",
    { width, height: 900, deviceScaleFactor: 1, mobile: width < 720 },
    sessionId,
  );
  await session.send(
    "Emulation.setEmulatedMedia",
    {
      features: [
        { name: "prefers-color-scheme", value: theme },
        { name: "prefers-reduced-motion", value: motion },
      ],
    },
    sessionId,
  );
  await session.send(
    "Page.addScriptToEvaluateOnNewDocument",
    { source: `try{localStorage.setItem("theme",${JSON.stringify(theme)})}catch(e){}` },
    sessionId,
  );
  const target = `${base}${path}`;
  await session.send("Page.navigate", { url: target }, sessionId);
  for (let i = 0; i < 80; i++) {
    try {
      const ready = await evaluate(
        session,
        sessionId,
        `(() => ({ state: document.readyState, path: location.pathname }))()`,
      );
      const norm = (value) => (value.length > 1 ? value.replace(/\/$/, "") : value);
      const pathReady = norm(ready.path) === norm(path);
      if (ready.state === "complete" && pathReady) {
        await evaluate(
          session,
          sessionId,
          "document.fonts && document.fonts.ready ? document.fonts.ready : true",
        );
        return;
      }
    } catch {
      // The previous document is going away.
    }
    await delay(250);
  }
  throw new Error(`timed out loading ${path}`);
}

async function driveLab(session, sessionId) {
  await evaluate(
    session,
    sessionId,
    `document.querySelector('button.lab-open[data-lab="mcp-simulator"]').click()`,
  );
  let opened = null;
  for (let i = 0; i < 20; i++) {
    opened = await evaluate(
      session,
      sessionId,
      `(() => {
        const dialog = document.getElementById("lab-dialog");
        const frame = document.querySelector(".lab-dialog-frame");
        return {
          open: !!(dialog && dialog.open),
          title: document.getElementById("lab-dialog-title")?.textContent ?? "",
          src: frame ? frame.getAttribute("src") : "",
          href: (() => {
            try {
              return frame.contentWindow.location.pathname + frame.contentWindow.location.search;
            } catch (err) {
              return "";
            }
          })(),
          search: location.search,
        };
      })()`,
    );
    const frameUrl = opened && (opened.href || opened.src || "");
    if (opened && opened.open && String(frameUrl).includes("/lab/mcp-simulator/") && String(frameUrl).includes("embed=1")) break;
    await delay(250);
  }
  await evaluate(session, sessionId, `document.querySelector(".lab-dialog-close").click()`);
  await delay(200);
  const closed = await evaluate(
    session,
    sessionId,
    `(() => {
      const dialog = document.getElementById("lab-dialog");
      return { open: !!(dialog && dialog.open), search: location.search };
    })()`,
  );
  const ok =
    opened.open === true &&
    opened.title === "MCP Integration Simulator" &&
    String(opened.href || opened.src || "").includes("/lab/mcp-simulator/") &&
    String(opened.href || opened.src || "").includes("embed=1") &&
    opened.search === "?lab=mcp-simulator" &&
    closed.open === false &&
    closed.search === "";
  return { ok, opened, closed };
}

async function screenshot(session, sessionId, file, width) {
  const metrics = await session.send("Page.getLayoutMetrics", {}, sessionId);
  const height = Math.min(Math.ceil(metrics.cssContentSize.height), 8000);
  const shot = await session.send(
    "Page.captureScreenshot",
    {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height, scale: 1 },
    },
    sessionId,
  );
  await writeFile(file, Buffer.from(shot.data, "base64"));
}

function contrastExpression() {
  return `(() => {
    function parse(value) {
      const match = String(value).match(/rgba?\\(([^)]+)\\)/);
      if (!match) return null;
      const parts = match[1].split(",").map((item) => parseFloat(item));
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    }
    function blend(fg, bg) {
      const a = fg.a;
      return [
        fg.r * a + bg[0] * (1 - a),
        fg.g * a + bg[1] * (1 - a),
        fg.b * a + bg[2] * (1 - a),
      ];
    }
    function lum(rgb) {
      const lin = (channel) => {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
    }
    function ratio(a, b) {
      const l1 = lum(a);
      const l2 = lum(b);
      const light = Math.max(l1, l2);
      const dark = Math.min(l1, l2);
      return (light + 0.05) / (dark + 0.05);
    }
    function painted(el) {
      const chain = [];
      let node = el;
      while (node) {
        chain.push(node);
        node = node.parentElement;
      }
      let color = [255, 255, 255];
      for (let i = chain.length - 1; i >= 0; i--) {
        const bg = parse(getComputedStyle(chain[i]).backgroundColor);
        if (bg && bg.a > 0) color = bg.a >= 1 ? [bg.r, bg.g, bg.b] : blend(bg, color);
      }
      return color;
    }
    function hidden(el) {
      let node = el;
      while (node && node.nodeType === 1) {
        if (node.hasAttribute("hidden")) return true;
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") return true;
        node = node.parentElement;
      }
      return false;
    }
    for (const anim of document.getAnimations()) {
      try { anim.finish(); } catch (err) {}
    }
    const groups = new Map();
    function add(kind, sample, fg, bg, need) {
      const value = ratio(fg, bg);
      if (value + 0.05 >= need) return;
      const key = kind + "|" + sample + "|" + need;
      const rounded = Math.round(value * 100) / 100;
      if (!groups.has(key)) groups.set(key, { kind, sample, ratio: rounded, need, count: 0 });
      groups.get(key).count += 1;
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let text;
    while ((text = walker.nextNode())) {
      const value = text.nodeValue.replace(/\\s+/g, " ").trim();
      if (!value) continue;
      const el = text.parentElement;
      if (!el || hidden(el) || el.closest("svg")) continue;
      const style = getComputedStyle(el);
      const fg = parse(style.color);
      if (!fg) continue;
      const bg = painted(el);
      const opacity = parseFloat(style.opacity || "1");
      const ink = blend({ ...fg, a: fg.a * opacity }, bg);
      const size = parseFloat(style.fontSize);
      const weight = parseInt(style.fontWeight, 10);
      const large = size >= 24 || (weight >= 700 && size >= 18.66);
      const sample = (el.id ? "#" + el.id : el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".") : el.tagName.toLowerCase());
      add(large ? "large-text" : "text", sample, ink, bg, large ? 3 : 4.5);
    }
    for (const el of document.querySelectorAll("button, input, textarea, select, a.btn")) {
      if (hidden(el) || el.closest("svg")) continue;
      const label = (el.innerText || el.getAttribute("aria-label") || "").trim();
      if (label) continue;
      const style = getComputedStyle(el);
      const outside = painted(el.parentElement || document.body);
      const borderWidth = parseFloat(style.borderTopWidth) || 0;
      const border = borderWidth >= 1 ? parse(style.borderTopColor) : null;
      const fill = parse(style.backgroundColor);
      const sample = el.id ? "#" + el.id : "button";
      const boundary = border && border.a > 0 ? [border.r, border.g, border.b] : fill && fill.a > 0 ? [fill.r, fill.g, fill.b] : null;
      if (!boundary) continue;
      add("ui", sample, boundary, outside, 3);
    }
    return [...groups.values()];
  })()`;
}

function reducedMotionExpression() {
  return `(() => {
    function probe(className) {
      const el = document.createElement("div");
      el.className = className;
      document.body.appendChild(el);
      const style = getComputedStyle(el);
      const snapshot = {
        animation: style.animationName,
        filter: style.filter,
      };
      el.remove();
      return snapshot;
    }
    const root = getComputedStyle(document.documentElement);
    const glow = root.getPropertyValue("--glow").trim();
    const accent = root.getPropertyValue("--accent-glow").trim();
    const flow = probe("flow on");
    const pulse = probe("pulse");
    const live = probe("mline live");
    const profile = document.querySelector(".profile-id > *");
    const profileAnimation = profile ? getComputedStyle(profile).animationName : "none";
    const running = document.getAnimations().filter((item) => item.playState === "running").length;
    const glowOff = glow === "transparent" || glow === "rgba(0, 0, 0, 0)";
    const accentOff = accent === "" || accent === "transparent" || accent === "rgba(0, 0, 0, 0)";
    const ok = glowOff && accentOff && flow.animation === "none" && pulse.filter === "none" && live.filter === "none" && profileAnimation === "none" && running === 0;
    return { ok, glow, accent, flow, pulse, live, profileAnimation, running };
  })()`;
}

function menuExpression() {
  return `(() => {
    const button = document.getElementById("menu-toggle");
    const menu = document.getElementById("site-menu");
    const link = menu.querySelector('a[href="/#lab"]');
    if (!button || !link) return { ok: false, reason: "missing menu" };
    if (getComputedStyle(button).display === "none") return { ok: false, reason: "menu button hidden at 360" };
    button.click();
    const opened = button.getAttribute("aria-expanded") === "true" && !menu.hasAttribute("hidden");
    link.click();
    const closedOnLink = menu.hasAttribute("hidden") && button.getAttribute("aria-expanded") === "false";
    button.click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const closedOnEscape = menu.hasAttribute("hidden") && button.getAttribute("aria-expanded") === "false";
    return { ok: opened && closedOnLink && closedOnEscape, opened, closedOnLink, closedOnEscape };
  })()`;
}

async function evaluate(session, sessionId, expression) {
  const result = await session.send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    sessionId,
  );
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "evaluate failed");
  }
  return result.result.value;
}

async function waitForJson(url) {
  let last;
  for (let i = 0; i < 50; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      last = response.status;
    } catch (error) {
      last = error;
    }
    await delay(200);
  }
  throw new Error(`chrome debug port not ready: ${last}`);
}

function apiPath(url) {
  try {
    const path = new URL(url).pathname;
    return path === "/api" || path.startsWith("/api/");
  } catch {
    return false;
  }
}

function blockApiRoutes(session, sessionId) {
  session.on((message) => {
    if (message.method !== "Fetch.requestPaused") return;
    if (message.sessionId && message.sessionId !== sessionId) return;
    const requestId = message.params?.requestId;
    if (!requestId) return;
    const blocked = apiPath(message.params?.request?.url || "");
    const method = blocked ? "Fetch.failRequest" : "Fetch.continueRequest";
    const params = blocked
      ? { requestId, errorReason: "BlockedByClient" }
      : { requestId };
    session.send(method, params, sessionId).catch(() => {});
  });
  return session.send(
    "Fetch.enable",
    { patterns: [{ urlPattern: "*", requestStage: "Request" }] },
    sessionId,
  );
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const listeners = new Set();
  let next = 0;
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", () => reject(new Error("chrome websocket failed")));
  });
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
      return;
    }
    for (const listener of listeners) listener(message);
  });
  return {
    ws,
    on(listener) {
      listeners.add(listener);
    },
    async send(method, params = {}, sessionId) {
      await ready;
      const id = ++next;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params, sessionId }));
      });
    },
  };
}
