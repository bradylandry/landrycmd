import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { findApplication, loadApplications } from "../src/lib/private-config.mjs";
import { getResume, loadDisclosedRole } from "../src/lib/resume.ts";

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
    disclosedRole: overlay,
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
    disclosedRole: overlay,
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

test("public presales résumé has no client-detail bullets", () => {
  const copy = getResume({ disclosed: false, variant: "presales" });
  assert.deepEqual(copy.experience[0]?.bullets, []);
});

test("presales disclosed overlay supplies the only bullets", () => {
  const disclosed = getResume({
    disclosed: true,
    variant: "presales",
    disclosedRole: overlay,
  });
  const role = disclosed.experience[0];
  assert.ok(role);
  assert.equal(role.role, "Overlay Presales Role");
  assert.equal(role.org, "Overlay Presales Org");
  assert.deepEqual(role.bullets, ["overlay presales bullet"]);
});

test("disclosed résumé fails closed when no overlay is present", () => {
  assert.throws(
    () =>
      getResume({
        disclosed: true,
        variant: "presales",
        disclosedRole: null,
      }),
    /DISCLOSED_ROLE_JSON unavailable/,
  );

  const prev = process.env.DISCLOSED_ROLE_JSON;
  delete process.env.DISCLOSED_ROLE_JSON;
  try {
    assert.throws(
      () => getResume({ disclosed: true, variant: "network" }),
      /DISCLOSED_ROLE_JSON unavailable/,
    );
  } finally {
    if (prev === undefined) delete process.env.DISCLOSED_ROLE_JSON;
    else process.env.DISCLOSED_ROLE_JSON = prev;
  }
});

test("loadDisclosedRole parses JSON and rejects junk", () => {
  assert.equal(loadDisclosedRole(""), null);
  assert.equal(loadDisclosedRole("not-json"), null);
  assert.equal(loadDisclosedRole("{}"), null);
  const parsed = loadDisclosedRole(JSON.stringify(overlay));
  assert.equal(parsed?.network.role, "Overlay Network Role");
  assert.deepEqual(parsed?.presales.bullets, ["overlay presales bullet"]);
});

test("loadDisclosedRole reads DISCLOSED_ROLE_JSON", () => {
  const prev = process.env.DISCLOSED_ROLE_JSON;
  process.env.DISCLOSED_ROLE_JSON = JSON.stringify(overlay);
  try {
    assert.equal(loadDisclosedRole()?.presales.org, "Overlay Presales Org");
  } finally {
    if (prev === undefined) delete process.env.DISCLOSED_ROLE_JSON;
    else process.env.DISCLOSED_ROLE_JSON = prev;
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
