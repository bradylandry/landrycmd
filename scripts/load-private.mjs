#!/usr/bin/env node
/**
 * Load gitignored private JSON into the local .env file.
 *
 * Reads:
 *   private/applications.json
 *   private/resume-acadianatek.json
 *
 * Writes APPLICATIONS_JSON and RESUME_ACADIANATEK_JSON into .env.
 * Does not print the values and does not call Vercel. Set the same keys in
 * the Vercel project by hand before deploying.
 *
 * applications.json is an array of objects with company, role, sent, and
 * status (prepared, held, applied, or rejected). Optional fields: token, req,
 * note, url, disclosed (boolean), variant (network or presales).
 *
 * resume-acadianatek.json:
 * {
 *   "network": { "role": "", "org": "", "bullets": [] },
 *   "presales": { "role": "", "org": "", "bullets": [] }
 * }
 * Those role, org, and bullets values replace the public résumé lines only
 * when an application sets disclosed.
 */
import { readFile, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAcadianaTekCopy, loadApplications } from "../src/lib/private-config.mjs";

export function quoteEnv(value) {
  // Base64 avoids dotenv treating $, quotes, and newlines inside JSON as syntax.
  // The runtime also accepts raw JSON, which is what the Vercel dashboard stores.
  return Buffer.from(value, "utf8").toString("base64");
}

function lineKey(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const exportless = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
  const eq = exportless.indexOf("=");
  if (eq < 0) return null;
  return exportless.slice(0, eq).trim();
}

export function upsertEnv(existing, entries) {
  const keys = new Set(Object.keys(entries));
  const kept = existing.split(/\r?\n/).filter((line) => {
    const key = lineKey(line);
    return key === null || !keys.has(key);
  });
  while (kept.length > 0 && kept[kept.length - 1] === "") kept.pop();
  const lines = [...kept];
  if (lines.length > 0) lines.push("");
  for (const [key, value] of Object.entries(entries)) {
    lines.push(`${key}=${quoteEnv(value)}`);
  }
  lines.push("");
  return lines.join("\n");
}

export async function loadPrivateFiles(options = {}) {
  const dir = options.dir ?? join(process.cwd(), "private");
  const envFile = options.envFile ?? join(options.dir ? options.dir : process.cwd(), ".env");
  const log = options.log ?? console.log;
  const error = options.error ?? console.error;

  let appsRaw;
  let resumeRaw;
  try {
    appsRaw = await readFile(join(dir, "applications.json"), "utf8");
  } catch {
    error("missing applications.json");
    return 1;
  }
  try {
    resumeRaw = await readFile(join(dir, "resume-acadianatek.json"), "utf8");
  } catch {
    error("missing resume-acadianatek.json");
    return 1;
  }

  const apps = loadApplications(appsRaw);
  if (!apps.ok) {
    error(`applications.json is ${apps.reason}`);
    return 1;
  }
  const copy = loadAcadianaTekCopy(resumeRaw);
  if (!copy) {
    error("resume-acadianatek.json is invalid");
    return 1;
  }

  let existing = "";
  try {
    existing = await readFile(envFile, "utf8");
  } catch {
    existing = "";
  }

  const next = upsertEnv(existing, {
    APPLICATIONS_JSON: JSON.stringify(apps.applications),
    RESUME_ACADIANATEK_JSON: JSON.stringify(copy),
  });
  await writeFile(envFile, next);

  const noun = apps.applications.length === 1 ? "entry" : "entries";
  log("Updated .env");
  log(`APPLICATIONS_JSON: ${apps.applications.length} ${noun}`);
  log("RESUME_ACADIANATEK_JSON: ok");
  return 0;
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  const code = await loadPrivateFiles({
    dir: join(process.cwd(), "private"),
    envFile: join(process.cwd(), ".env"),
  });
  process.exit(code);
}
