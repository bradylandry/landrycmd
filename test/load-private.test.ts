import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadEnv } from "vite";
import { decodeEnvJson } from "../src/lib/private-config.mjs";
import { upsertEnv } from "../scripts/load-private.mjs";

function envValue(text: string, key: string) {
  const line = text.split(/\r?\n/).find((entry: string) => entry.startsWith(`${key}=`));
  assert.ok(line);
  return decodeEnvJson(line.slice(key.length + 1));
}

const apps = [
  {
    token: "example-aaa111",
    company: "Example Co",
    role: "Example Role",
    sent: "2026-01-01",
    status: "applied",
    note: "SENTINEL_NOTE_SHOULD_NOT_PRINT",
  },
];

const resume = {
  network: {
    role: "Overlay Network Role",
    org: "Overlay Network Org",
    bullets: ["SENTINEL_BULLET_SHOULD_NOT_PRINT"],
  },
  presales: {
    role: "Overlay Presales Role",
    org: "Overlay Presales Org",
    bullets: [],
  },
};

test("quoted values round-trip through Vite env loading", () => {
  const payload = JSON.stringify([
    {
      company: "Example Co",
      role: "Example Role",
      sent: "2026-01-01",
      status: "applied",
      note: 'fee $12 and line1\nline2 and say "hi"',
    },
  ]);
    return mkdtemp(join(tmpdir(), "env-round-")).then(async (dir: string) => {
    try {
      await writeFile(join(dir, ".env"), upsertEnv("", { APPLICATIONS_JSON: payload }));
      const loaded = loadEnv("development", dir, "");
      assert.equal(decodeEnvJson(loaded.APPLICATIONS_JSON), payload);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

test("upsertEnv replaces only the private keys", () => {
  const existing = [
    "APPS_SECRET=keep-me",
    "APPLICATIONS_JSON=old",
    "APPS_PIN=also-keep",
    "",
  ].join("\n");
  const next = upsertEnv(existing, {
    APPLICATIONS_JSON: JSON.stringify(apps),
    DISCLOSED_ROLE_JSON: JSON.stringify(resume),
  });
  assert.match(next, /^APPS_SECRET=keep-me$/m);
  assert.match(next, /^APPS_PIN=also-keep$/m);
  assert.equal(next.includes("APPLICATIONS_JSON=old"), false);
  assert.match(next, /^APPLICATIONS_JSON=/m);
  assert.match(next, /^DISCLOSED_ROLE_JSON=/m);
  assert.equal(next.includes("SENTINEL_NOTE_SHOULD_NOT_PRINT"), false);
  assert.equal(next.includes("SENTINEL_BULLET_SHOULD_NOT_PRINT"), false);
  assert.match(envValue(next, "APPLICATIONS_JSON"), /SENTINEL_NOTE_SHOULD_NOT_PRINT/);
  assert.match(envValue(next, "DISCLOSED_ROLE_JSON"), /SENTINEL_BULLET_SHOULD_NOT_PRINT/);
});

test("loadPrivateFiles writes .env and does not print values", async () => {
  const { loadPrivateFiles } = await import("../scripts/load-private.mjs");
  const dir = await mkdtemp(join(tmpdir(), "load-private-"));
  const logs: string[] = [];
  const errors: string[] = [];
  try {
    await writeFile(
      join(dir, "applications.json"),
      `${JSON.stringify(apps, null, 2)}\n`,
    );
    await writeFile(
      join(dir, "disclosed-role.json"),
      `${JSON.stringify(resume, null, 2)}\n`,
    );
    await writeFile(join(dir, ".env"), "APPS_PIN=keep\n");
    const code = await loadPrivateFiles({
      dir,
      log: (line: string) => logs.push(line),
      error: (line: string) => errors.push(line),
    });
    assert.equal(code, 0);
    assert.equal(errors.length, 0);
    const output = logs.join("\n");
    assert.equal(output.includes("SENTINEL_NOTE_SHOULD_NOT_PRINT"), false);
    assert.equal(output.includes("SENTINEL_BULLET_SHOULD_NOT_PRINT"), false);
    assert.match(output, /APPLICATIONS_JSON: 1 entry/);
    const env = await readFile(join(dir, ".env"), "utf8");
    assert.match(env, /^APPS_PIN=keep$/m);
    assert.equal(env.includes("SENTINEL_NOTE_SHOULD_NOT_PRINT"), false);
    assert.equal(env.includes("SENTINEL_BULLET_SHOULD_NOT_PRINT"), false);
    assert.match(envValue(env, "APPLICATIONS_JSON"), /SENTINEL_NOTE_SHOULD_NOT_PRINT/);
    assert.match(envValue(env, "DISCLOSED_ROLE_JSON"), /SENTINEL_BULLET_SHOULD_NOT_PRINT/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
