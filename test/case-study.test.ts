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

const bannedNames =
  /\b(DSR|SCR|SBR|DOLAG|DDSJ|BBLAG|AGGC|SYSC|NAGC)\b|spider|acadiana/i;

test("the site does not publish internal names", async () => {
  const files = await sourceFiles(new URL(".", root).pathname);
  const hits: string[] = [];
  for (const file of files) {
    if (file.endsWith(join("test", "case-study.test.ts"))) continue;
    const text = await readFile(file, "utf8");
    if (bannedNames.test(text)) hits.push(file);
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
  assert.equal(/ServiceNow|Nautobot|AWX|Forward Networks|IPControl/.test(page), false);

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
    assert.equal(/ServiceNow|Nautobot|\bAWX\b|Forward Networks|IPControl|80 percent|Acadiana/i.test(text), false);
    assert.equal(bannedNames.test(text), false);
  }

  const dc = network.experience[1];
  assert.ok(dc);
  assert.match(dc.bullets[0] ?? "", /AI network-operations platform/);
  assert.match(dc.bullets[1] ?? "", /firewall-request review/);
});
