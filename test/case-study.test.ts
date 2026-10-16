import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { getResume } from "../src/lib/resume.ts";

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

/**
 * SHA-256 of lowercase banned tokens (single words and two-word phrases).
 * The plaintext is not stored in the repo.
 */
const BANNED_TOKEN_HASHES = new Set([
  "07ac44e362f92f1f548cf0e6a20a3af1bc232b8c973a3115db09bbecfc86faae",
  "0bc57642b3cc041a76705d171c2afe66821e98101c7fd4cd23331c17ecb186a9",
  "161ae4a9aedc3531080823371effa42b3d375b7d2e9505003363b2a2fa7a4d69",
  "2f569e0502c494076f5dbf6b9225c50249ebd733a1ea9d6e0f7c8728415b64bd",
  "2f795c595639f4a5b4c90b10772ad6ccbcd1315fa4c77d4d409ac6bd82cacb16",
  "5c3e5fed722fc37b082fd729b2faf6dd732fea05279b80afd3e4409a003be9c2",
  "5f31ed275e1314790922399b4c9cb11baa5bb05d8db85b87f743c5874d97b7e8",
  "6cc6da34fa4cbfbbd5772aba509c20eb78cd7e85101291b3d936ef91e377ea9b",
  "6f0309fea1db13f704186ea5a0445b504af8a45881fddcb3e1c9669551da466a",
  "71f1a8cca8f4440e0b70570dc110ce8f360cb8563d3ea532afe6d8d4b695febb",
  "7ce6af087b8110526cbd1fae852861431b72bbbbf475fd509f7297cf40ac4dca",
  "865156d4103d05efdb2dcb41202f693fc79a2c532ffa7930fc693e17d9de69bd",
  "8963eeba445288aa0936c67537193fb01a030903c2fc9b68ce1fbc556dae4d8e",
  "9bfa0b50a90e669907e78780bcc1e5e972742e0d124b30a67fbeb6371c604891",
  "b5738c169b693bee89e1b74ebd48e0dfa53a34e8571790b7727721a0bfadc470",
  "c66c4c742d6afee1df77ba44d0ebf3beb5dea91d301bfb11af7f5bcc9df5f157",
  "db526bfe062629b1fd8b8bf3cd70bd6cdbd37e1dd1e81d080fdd29de2a6873cd",
]);

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function publishesBannedToken(text: string): boolean {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word) continue;
    if (BANNED_TOKEN_HASHES.has(sha256(word))) return true;
    const next = words[i + 1];
    if (next && BANNED_TOKEN_HASHES.has(sha256(`${word} ${next}`))) return true;
  }
  return false;
}

test("the site does not publish internal names", async () => {
  const files = await sourceFiles(new URL(".", root).pathname);
  const hits: string[] = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    if (publishesBannedToken(text)) hits.push(file);
  }
  assert.deepEqual(hits, []);
});

test("the MCP hub and the firewall review are separate labs", async () => {
  const hub = await readFile(new URL("./public/lab/mcp-simulator/index.html", root), "utf8");
  const review = await readFile(new URL("./public/lab/frr-review/index.html", root), "utf8");
  const migration = await readFile(new URL("./public/lab/migration-simulator/index.html", root), "utf8");
  const ring = await readFile(new URL("./public/lab/ring-collapse/index.html", root), "utf8");
  const labs = [hub, review, migration, ring].join("\n");

  assert.match(hub, /MCP Integration Simulator/);
  assert.equal(hub.includes("const F="), false);
  assert.equal(hub.includes("30–60"), false);
  assert.equal(hub.includes("CHG-"), false);
  assert.match(hub, /\/lab\/frr-review\//);

  assert.match(review, /Firewall Request Review/);
  assert.match(review, /const F=/);
  assert.match(review, /30–60/);
  assert.match(review, /3–5/);
  assert.match(review, /\/lab\/mcp-simulator\//);

  assert.equal(/area\s*10|area\s*20/i.test(labs), false);
  assert.equal(labs.includes("540+"), false);
  assert.match(migration, /hundreds of port-channels/);

  const wire = await readFile(new URL("./public/lab/wire.css", root), "utf8");
  assert.match(wire, /stroke-dasharray:\s*5 15/);
  assert.match(wire, /stroke-dashoffset:\s*-40/);
  for (const page of [hub, review, migration, ring]) {
    assert.match(page, /\/lab\/wire\.css/);
    assert.match(page, /\/lab\/wire\.js/);
    assert.match(page, /labWire/);
  }
  assert.equal(hub.includes("getPointAtLength"), false);
  assert.equal(/Math\.cos|Math\.PI/.test(hub), false);
  assert.match(hub, /clients \/ agents/);
  assert.match(hub, /servers \/ tools/);
  assert.equal(review.includes("class:'pulse'"), false);
  assert.equal(review.includes('class="pulse"'), false);
  assert.match(ring, /rgN\.forEach\(g=>g\.setAttribute\('class','nd hub'\)\)/);
  assert.equal(ring.includes("nd'+(ringGone?' off':'')"), false);
});

test("unsourced lab figures read NEEDS NUMBER", async () => {
  const airtap = await readFile(new URL("./public/lab/airtap-mpls/index.html", root), "utf8");
  const review = await readFile(new URL("./public/lab/frr-review/index.html", root), "utf8");
  const migration = await readFile(new URL("./public/lab/migration-simulator/index.html", root), "utf8");
  const ring = await readFile(new URL("./public/lab/ring-collapse/index.html", root), "utf8");
  const home = await readFile(new URL("./src/pages/index.astro", root), "utf8");

  assert.match(airtap, /NEEDS NUMBER site points and NEEDS NUMBER point-to-point links/);
  assert.equal(airtap.includes("3,200"), false);
  assert.match(review, /NEEDS NUMBER<\/b><span>firewalls covered/);
  assert.match(review, /across NEEDS NUMBER disconnected systems/);
  assert.match(migration, /a load balancer took NEEDS NUMBER/);
  assert.equal(migration.includes("28 minutes"), false);
  assert.match(ring, /NEEDS NUMBER<\/b><span>revisions of the cost model/);
  assert.match(ring, /NEEDS NUMBER<\/b><span>months of capacity added before collapse/);
  assert.match(ring, /NEEDS NUMBER months before/);
  assert.match(home, /hub capacity NEEDS NUMBER months before touching the ring/);
  assert.equal(home.includes("four months"), false);
});

test("the AirTap lab does not publish an invented channel plan", async () => {
  const page = await readFile(new URL("./public/lab/airtap-mpls/index.html", root), "utf8");
  const home = await readFile(new URL("./src/pages/index.astro", root), "utf8");
  assert.equal(/36\d{2}\s*MHz/.test(page), false);
  assert.equal(page.includes("sector frequency"), false);
  assert.equal(page.includes("CHG-"), false);
  assert.equal(home.includes("3.65 GHz sector plan"), false);
});

test("the case study stands alone and Work links both labs", async () => {
  const page = await readFile(
    new URL("./src/pages/work/ai-network-operations.astro", root),
    "utf8",
  );
  assert.match(page, /AI Network Operations Platform \(MCP\)/);
  assert.match(page, /28/);
  assert.match(page, /~573/);
  assert.match(page, /44/);
  assert.match(page, /31/);
  assert.match(page, /23/);
  assert.match(page, /\/lab\/mcp-simulator\//);
  assert.match(page, /\/lab\/frr-review\//);
  assert.equal(/<a [^>]*role="tab"|role="tab"/i.test(page), false);
  assert.equal(publishesBannedToken(page), false);

  const home = await readFile(new URL("./src/pages/index.astro", root), "utf8");
  const work = home.slice(home.indexOf('id="work"'), home.indexOf('id="lab"'));
  assert.match(work, /\/work\/ai-network-operations/);
  assert.match(work, /\/lab\/mcp-simulator\//);
  assert.match(work, /\/lab\/frr-review\//);
});

test("the network résumé carries the sanitized facts", () => {
  const network = getResume({ disclosed: false, variant: "network" });
  const presales = getResume({ disclosed: false, variant: "presales" });
  for (const copy of [network, presales]) {
    const text = [
      copy.summary,
      ...copy.skills.map((skill) => skill.items),
      ...copy.experience.flatMap((role) => [role.org, ...role.bullets]),
    ].join("\n");
    assert.match(text, /Charter\/Spectrum \(formerly Cox Communications\)/);
    assert.match(text, /28 MCP servers, about 573 tools, 44 agents, and 31 skills/);
    assert.match(text, /Authored 23 of the shipping agents/);
    assert.match(text, /backlog from 200 to about 40/);
    assert.match(text, /30–60 minutes to 3–5 minutes/);
    assert.match(text, /about 20 hours per deployment/);
    assert.match(text, /zero traffic lost, and rollback is one priority change/);
    assert.match(text, /4 markets \(87 CMTS\) inside an 18-market, 536-CMTS program/);
    assert.match(text, /switch-replacement procedures for 14 markets/);
    assert.match(text, /capacity-first metro ring collapse for two markets/);
    assert.match(text, /440\+ devices across 29 sites/);
    assert.match(text, /4–8 hours to 15–30 minutes/);
    assert.match(text, /under 3 seconds per VLAN with zero dropped calls/);
    assert.match(text, /5 national peering centers/);
    assert.match(text, /across about 17 markets/);
    assert.match(text, /spreadsheet config generator in 2014/);
    assert.equal(publishesBannedToken(text), false);
  }

  const dc = network.experience[1];
  assert.ok(dc);
  assert.match(dc.bullets[0] ?? "", /AI network-operations platform/);
  assert.match(dc.bullets[1] ?? "", /firewall-request review/);
});
