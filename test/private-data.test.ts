import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { findApplication, loadApplications } from "../src/lib/private-config.mjs";
import { getResume, loadAcadianaTekCopy } from "../src/lib/resume.ts";

const sampleApps = JSON.stringify([
  {
    token: "example-aaa111",
    company: "Example Co",
    role: "Example Role",
    sent: "2026-01-01",
    status: "applied",
    req: "REQ-1",
    note: "example note",
    url: "https://example.test/jobs/1",
    disclosed: true,
    variant: "network",
  },
  {
    company: "Other Example",
    role: "Other Role",
    sent: "2026-01-02",
    status: "held",
    note: "no live link",
  },
]);

const overlay = {
  network: {
    role: "Overlay Network Role",
    org: "Overlay Network Org",
    bullets: ["overlay network bullet"],
  },
  presales: {
    role: "Overlay Presales Role",
    org: "Overlay Presales Org",
    bullets: ["overlay presales bullet"],
  },
};

function withoutApplicationsEnv<T>(run: () => T): T {
  const prev = process.env.APPLICATIONS_JSON;
  delete process.env.APPLICATIONS_JSON;
  try {
    return run();
  } finally {
    if (prev === undefined) delete process.env.APPLICATIONS_JSON;
    else process.env.APPLICATIONS_JSON = prev;
  }
}

test("loadApplications reports missing env instead of an empty list", () => {
  const result = withoutApplicationsEnv(() => loadApplications());
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "missing");
});

test("loadApplications reads APPLICATIONS_JSON from the environment", () => {
  const prev = process.env.APPLICATIONS_JSON;
  process.env.APPLICATIONS_JSON = sampleApps;
  try {
    const result = loadApplications();
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.applications[0]?.company, "Example Co");
  } finally {
    if (prev === undefined) delete process.env.APPLICATIONS_JSON;
    else process.env.APPLICATIONS_JSON = prev;
  }
});

test("loadApplications parses a caller-supplied list and findApplication uses it", () => {
  const result = loadApplications(sampleApps);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.applications.length, 2);
  assert.equal(result.applications[1]?.token, undefined);
  assert.equal(
    findApplication("example-aaa111", result.applications)?.req,
    "REQ-1",
  );
  assert.equal(findApplication("nope", result.applications), undefined);
  assert.equal(findApplication("", result.applications), undefined);
});

test("loadApplications rejects malformed payloads", () => {
  assert.equal(loadApplications("not-json").ok, false);
  assert.equal(loadApplications("{}").ok, false);
  assert.equal(
    loadApplications(
      JSON.stringify([
        { company: "A", role: "B", sent: "2026-01-01", status: "nope" },
      ]),
    ).ok,
    false,
  );
  assert.equal(
    loadApplications(
      JSON.stringify([{ company: "A", role: "B", sent: "2026-01-01" }]),
    ).ok,
    false,
  );
});

test("public résumé ignores a disclosed overlay", () => {
  const copy = getResume({
    disclosed: false,
    variant: "network",
    acadianaTek: overlay,
  });
  const role = copy.experience[0];
  assert.ok(role);
  assert.equal(role.role, "Independent AI & Infrastructure Engineer");
  assert.equal(role.org, "landrycmd");
  assert.equal(role.bullets.includes("overlay network bullet"), false);
});

test("disclosed résumé appends overlay bullets and keeps the public ones", () => {
  const undisclosed = getResume({ disclosed: false, variant: "network" });
  const disclosed = getResume({
    disclosed: true,
    variant: "network",
    acadianaTek: overlay,
  });
  const role = disclosed.experience[0];
  assert.ok(role);
  assert.equal(role.role, "Overlay Network Role");
  assert.equal(role.org, "Overlay Network Org");
  for (const bullet of undisclosed.experience[0]?.bullets ?? []) {
    assert.equal(role.bullets.includes(bullet), true);
  }
  assert.equal(role.bullets.at(-1), "overlay network bullet");
});

test("presales disclosed overlay replaces only the gated role lines", () => {
  const undisclosed = getResume({ disclosed: false, variant: "presales" });
  const disclosed = getResume({
    disclosed: true,
    variant: "presales",
    acadianaTek: overlay,
  });
  const role = disclosed.experience[0];
  assert.ok(role);
  assert.equal(role.role, "Overlay Presales Role");
  assert.equal(role.org, "Overlay Presales Org");
  for (const bullet of undisclosed.experience[0]?.bullets ?? []) {
    assert.equal(role.bullets.includes(bullet), true);
  }
  assert.equal(role.bullets.at(-1), "overlay presales bullet");
});

test("disclosed résumé without overlay stays on the public lines", () => {
  const disclosed = getResume({
    disclosed: true,
    variant: "presales",
    acadianaTek: null,
  });
  const role = disclosed.experience[0];
  assert.ok(role);
  assert.equal(role.role, "Technical Solutions Lead");
  assert.equal(role.org, "Independent consulting practice · landrycmd");
});

test("loadAcadianaTekCopy parses JSON and rejects junk", () => {
  assert.equal(loadAcadianaTekCopy(""), null);
  assert.equal(loadAcadianaTekCopy("not-json"), null);
  assert.equal(loadAcadianaTekCopy("{}"), null);
  const parsed = loadAcadianaTekCopy(JSON.stringify(overlay));
  assert.equal(parsed?.network.role, "Overlay Network Role");
  assert.deepEqual(parsed?.presales.bullets, ["overlay presales bullet"]);
});

test("loadAcadianaTekCopy reads RESUME_ACADIANATEK_JSON", () => {
  const prev = process.env.RESUME_ACADIANATEK_JSON;
  process.env.RESUME_ACADIANATEK_JSON = JSON.stringify(overlay);
  try {
    assert.equal(loadAcadianaTekCopy()?.presales.org, "Overlay Presales Org");
  } finally {
    if (prev === undefined) delete process.env.RESUME_ACADIANATEK_JSON;
    else process.env.RESUME_ACADIANATEK_JSON = prev;
  }
});

test("application source no longer embeds the record list", async () => {
  const src = await readFile(
    new URL("../src/lib/applications.ts", import.meta.url),
    "utf8",
  );
  assert.equal(src.includes("export const APPLICATIONS"), false);
  assert.equal(/company:\s*"/.test(src), false);
  assert.equal(/token:\s*"/.test(src), false);
});
