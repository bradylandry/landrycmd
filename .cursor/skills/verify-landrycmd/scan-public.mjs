/**
 * Read-only scan of shipped public copy.
 * Leak hits fail the process. NEEDS NUMBER is printed and does not.
 * Not a CI check.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");

const includeRoots = [
  "src/pages",
  "src/content",
  "src/components",
  "src/data",
  "src/lib/resume.ts",
  "public",
];

const skipFiles = new Set([
  "src/pages/applications.astro",
  "src/pages/login.astro",
  "src/pages/resume/[token].astro",
]);

function skipped(rel) {
  if (skipFiles.has(rel)) return true;
  if (rel.startsWith("src/pages/api/")) return true;
  return false;
}

const textExt = new Set([
  ".astro",
  ".md",
  ".mdx",
  ".ts",
  ".js",
  ".mjs",
  ".css",
  ".html",
  ".svg",
  ".txt",
  ".json",
]);

/** Hosts the public site already names on purpose. Anything else is a leak. */
const allowedHosts = new Set([
  "landrycmd.com",
  "www.landrycmd.com",
  "jarvis.landrycmd.com",
  "act.landrycmd.com",
  "lift.landrycmd.com",
  "peptidetrackers.com",
  "github.com",
  "www.github.com",
  "linkedin.com",
  "www.linkedin.com",
  "gmail.com",
  "muse.ai",
  "ollama.com",
  "support.claude.com",
  "code.visualstudio.com",
  "insiderllm.com",
  "9to5mac.com",
  "console.groq.com",
  "cloud.cerebras.ai",
  "build.nvidia.com",
  "aistudio.google.com",
  "code.claude.com",
  "alexop.dev",
  "w3.org",
  "www.w3.org",
  "scripts.sil.org",
]);

const allowedEmails = new Set(["bjlandry@gmail.com", "support@landrycmd.com"]);

const ipv4 =
  /\b(?:(?:25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|1?\d{1,2})\b/g;
const deviceRole = /\b(?:PE|CE|ASBR|LER|LSR)\b/g;
const ticket = /\b(?:CHG|INC|RITM|TASK|REQ|PRB)-[A-Z0-9]+\b/g;
const areaCode = /\barea\s*(?:10|20)\b/gi;
const deviceName =
  /\b[a-z]{2,6}-(?:rtr|sw|agg|pe|ce|cmts|core|edge|border)-\d{1,3}\b/g;
const clli = /\b(?=[A-Z0-9]{8,11}\b)[A-Z]{4}[A-Z0-9]*\d[A-Z0-9]*\b/g;
const internalTool =
  /\b(?:tailscale|azurecontainerapps|jarvis-lab|nautobot|netbox|servicenow|solarwinds|infoblox)\b/gi;
const internalDns = /(?<![.\w])[a-z0-9-]+\.(?:local|internal|corp|lan)\b/gi;
const coworkerCue = /\b(?:coworker|co-worker|colleague)\s+[A-Z][a-z]+\b/g;
const email = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const urlHost = /\b(?:https?:\/\/|git@)([a-z0-9.-]+)/gi;
const needsNumber = /NEEDS NUMBER/g;

async function filesUnder(rel) {
  const abs = path.join(root, rel);
  const info = await stat(abs);
  if (!info.isDirectory()) return [rel];
  const out = [];
  const entries = await readdir(abs, { withFileTypes: true });
  for (const entry of entries) {
    const child = path.join(rel, entry.name);
    if (entry.isDirectory()) out.push(...(await filesUnder(child)));
    else if (textExt.has(path.extname(entry.name))) out.push(child);
  }
  return out;
}

function linesOf(text, regex, map) {
  const hits = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    regex.lastIndex = 0;
    const found = lines[i].match(regex);
    if (!found) continue;
    const extra = map ? map(found, lines[i]) : found;
    if (extra && extra.length) hits.push({ line: i + 1, match: extra.join(", ") });
  }
  return hits;
}

function unexpectedHosts(matches) {
  const bad = [];
  for (const raw of matches) {
    const host = raw
      .replace(/^https?:\/\//i, "")
      .replace(/^git@/i, "")
      .replace(/\.$/, "")
      .toLowerCase();
    if (!allowedHosts.has(host)) bad.push(host);
  }
  return bad;
}

function unexpectedEmails(matches) {
  return matches.filter((item) => {
    const email = item.toLowerCase();
    if (allowedEmails.has(email)) return false;
    if (email === "git@github.com") return false;
    return true;
  });
}

const leaks = [];
const placeholders = [];

for (const rel of includeRoots) {
  for (const file of await filesUnder(rel)) {
    if (skipped(file)) continue;
    const text = await readFile(path.join(root, file), "utf8");
    const buckets = [
      ["ip", linesOf(text, ipv4)],
      ["device-role", linesOf(text, deviceRole)],
      ["ticket", linesOf(text, ticket)],
      ["site-or-market-code", [
        ...linesOf(text, areaCode),
        ...linesOf(text, deviceName),
        ...linesOf(text, clli),
      ]],
      ["internal-tool", linesOf(text, internalTool)],
      ["internal-dns", linesOf(text, internalDns)],
      ["coworker", linesOf(text, coworkerCue)],
      ["email", linesOf(text, email, unexpectedEmails)],
      ["hostname", linesOf(text, urlHost, unexpectedHosts)],
    ];
    for (const [kind, hits] of buckets) {
      for (const hit of hits) {
        leaks.push({ file, kind, ...hit });
      }
    }
    needsNumber.lastIndex = 0;
    if (needsNumber.test(text)) {
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("NEEDS NUMBER")) {
          placeholders.push(`${file}:${i + 1}`);
        }
      }
    }
  }
}

console.log("NEEDS NUMBER in shipped copy (report only):");
if (placeholders.length === 0) console.log("(none)");
for (const item of placeholders) console.log(item);

console.log("\nPublic-copy leaks:");
if (leaks.length === 0) console.log("(none)");
for (const hit of leaks) {
  console.log(`${hit.file}:${hit.line}  ${hit.kind}  ${hit.match}`);
}

if (leaks.length) process.exit(1);
