import { safeEqual } from "./safe-compare.mjs";

export function decodeEnvJson(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) return trimmed;
  const decoded = Buffer.from(trimmed, "base64").toString("utf8");
  const encoded = Buffer.from(decoded, "utf8").toString("base64").replace(/=+$/, "");
  if (encoded !== trimmed.replace(/=+$/, "")) return trimmed;
  return decoded;
}

const STATUSES = new Set(["prepared", "held", "applied", "rejected"]);
const VARIANTS = new Set(["network", "presales"]);

function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

let localEnvLoaded = false;

function ensureLocalEnv() {
  if (localEnvLoaded) return;
  localEnvLoaded = true;
  // Runtime read of a gitignored .env. Does not inline values into the build.
  // Existing process.env entries win, which is what Vercel injects.
  if (typeof process.loadEnvFile !== "function") return;
  try {
    process.loadEnvFile();
  } catch {
    // No local file. Hosted runtimes provide process.env directly.
  }
}

export function serverEnv(name) {
  ensureLocalEnv();
  const value = process.env[name];
  return typeof value === "string" ? value : "";
}

/**
 * @param {string | undefined} raw Caller-supplied JSON. Omit to read APPLICATIONS_JSON.
 */
export function loadApplications(raw) {
  const source = raw === undefined ? serverEnv("APPLICATIONS_JSON") : raw;
  if (typeof source !== "string" || source.trim() === "") {
    return { ok: false, reason: "missing" };
  }

  let parsed;
  try {
    parsed = JSON.parse(decodeEnvJson(source));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!Array.isArray(parsed)) return { ok: false, reason: "invalid" };

  const applications = [];
  for (const item of parsed) {
    if (!isRecord(item)) return { ok: false, reason: "invalid" };
    if (typeof item.company !== "string" || item.company.trim() === "") {
      return { ok: false, reason: "invalid" };
    }
    if (typeof item.role !== "string" || item.role.trim() === "") {
      return { ok: false, reason: "invalid" };
    }
    if (typeof item.sent !== "string" || item.sent.trim() === "") {
      return { ok: false, reason: "invalid" };
    }
    if (typeof item.status !== "string" || !STATUSES.has(item.status)) {
      return { ok: false, reason: "invalid" };
    }
    if (item.token !== undefined && typeof item.token !== "string") {
      return { ok: false, reason: "invalid" };
    }
    if (item.req !== undefined && typeof item.req !== "string") {
      return { ok: false, reason: "invalid" };
    }
    if (item.note !== undefined && typeof item.note !== "string") {
      return { ok: false, reason: "invalid" };
    }
    if (item.url !== undefined && typeof item.url !== "string") {
      return { ok: false, reason: "invalid" };
    }
    if (item.disclosed !== undefined && typeof item.disclosed !== "boolean") {
      return { ok: false, reason: "invalid" };
    }
    if (item.variant !== undefined && !VARIANTS.has(item.variant)) {
      return { ok: false, reason: "invalid" };
    }

    /** @type {Record<string, unknown>} */
    const app = {
      company: item.company,
      role: item.role,
      sent: item.sent,
      status: item.status,
    };
    if (typeof item.token === "string" && item.token !== "") app.token = item.token;
    if (typeof item.req === "string") app.req = item.req;
    if (typeof item.note === "string") app.note = item.note;
    if (typeof item.url === "string") app.url = item.url;
    if (item.disclosed === true) app.disclosed = true;
    if (typeof item.variant === "string") app.variant = item.variant;
    applications.push(app);
  }

  return { ok: true, applications };
}

/**
 * @param {string} token
 * @param {Array<{ token?: string }> | undefined} applications
 */
export function findApplication(token, applications) {
  const list =
    applications ??
    (() => {
      const loaded = loadApplications();
      return loaded.ok ? loaded.applications : [];
    })();
  if (!token) return undefined;
  // Compare against every entry so timing does not reveal the match position.
  let match;
  for (const app of list) {
    if (safeEqual(app.token, token) && match === undefined) match = app;
  }
  return match;
}

function parseRole(value) {
  if (!isRecord(value)) return null;
  if (typeof value.role !== "string" || value.role.trim() === "") return null;
  if (typeof value.org !== "string" || value.org.trim() === "") return null;
  if (!Array.isArray(value.bullets) || value.bullets.some((bullet) => typeof bullet !== "string")) {
    return null;
  }
  return { role: value.role, org: value.org, bullets: value.bullets };
}

/**
 * @param {string | undefined} raw Caller-supplied JSON. Omit to read DISCLOSED_ROLE_JSON.
 */
export function loadDisclosedRole(raw) {
  const source = raw === undefined ? serverEnv("DISCLOSED_ROLE_JSON") : raw;
  if (typeof source !== "string" || source.trim() === "") return null;

  let parsed;
  try {
    parsed = JSON.parse(decodeEnvJson(source));
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const network = parseRole(parsed.network);
  const presales = parseRole(parsed.presales);
  if (!network || !presales) return null;
  return { network, presales };
}
