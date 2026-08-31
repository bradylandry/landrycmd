import { getRedis } from "./redis";

/**
 * Per-application tracked résumé links.
 *
 * One token per application. The token is the only thing that appears in the
 * URL you send out; the company name lives here, server-side.
 *
 * Tokens are <company>-<random>. The company prefix makes the link read as a
 * tailored résumé; the random suffix is what matters. A bare company slug is
 * NOT acceptable: Unknown tokens 404
 * and known ones 200, so a guessable namespace would let anyone enumerate which
 * companies you have applied to. Generate the suffix with:
 *   python3 -c "import secrets,string;a=string.ascii_lowercase+string.digits;\
 *     print(''.join(secrets.choice(a) for _ in range(12)))"
 *
 * Two kinds of hit are recorded per token:
 *   - `open`    server-side, on page request. Includes automated fetches.
 *   - `engaged` client-side beacon, fired only after the page has been visible
 *               for ENGAGE_DELAY_MS. Corporate mail scanners (Defender Safe
 *               Links, Proofpoint, Mimecast) fetch HTML but do not execute JS,
 *               so `engaged` is the number worth reading.
 */

export interface Application {
  token: string;
  company: string;
  role: string;
  /** ISO date the link was sent, for reading the timeline */
  sent: string;
  url?: string;
  /** Name ACADIANA TEK on this application's résumé. Unlisted routes only. */
  disclosed?: boolean;
}

export const APPLICATIONS: Application[] = [
  {
    token: "exxon-39fi23",
    company: "ExxonMobil",
    role: "IT Network Engineer - Expert (Spring, TX)",
    sent: "2026-08-30",
    url: "https://jobs.exxonmobil.com/job/Spring-IT-Network-Engineer-Expert-TX-77389/1424527100/",
    disclosed: true,
  },
];

export function findApplication(token: string): Application | undefined {
  return APPLICATIONS.find((a) => a.token === token);
}

export const ENGAGE_DELAY_MS = 12000;

export type HitKind = "open" | "engaged";

export interface Hit {
  at: number;
  kind: HitKind;
  ip?: string;
  ua?: string;
  ref?: string;
  country?: string;
  /** true when the user agent matches a known link scanner / preview bot */
  bot?: boolean;
}

const MAX_HITS = 200;

const key = (token: string) => `app:hits:${token}`;

/**
 * Known automated fetchers. Not exhaustive, and not meant to be: the `engaged`
 * beacon is the real filter. This just labels the obvious ones so the dashboard
 * can grey them out.
 */
const BOT_RE =
  /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|slackbot|discordbot|whatsapp|telegram|twitterbot|linkedinbot|proofpoint|mimecast|barracuda|safelinks|urldefense|headless|python-requests|curl|wget|go-http-client|axios|okhttp/i;

export function looksAutomated(ua: string | undefined): boolean {
  if (!ua) return true;
  return BOT_RE.test(ua);
}

/**
 * Record a hit. Never throws and never blocks the render: if Redis is down or
 * unconfigured the page still serves. (The trip rate-limiter had to grow an
 * in-process fallback for exactly this reason, see commits 2799512 / c021021.)
 */
export async function recordHit(token: string, hit: Hit): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.lpush(key(token), JSON.stringify(hit));
    await redis.ltrim(key(token), 0, MAX_HITS - 1);
  } catch (err) {
    console.error("recordHit failed (non-fatal):", err);
  }
}

export async function getHits(token: string): Promise<Hit[]> {
  const redis = getRedis();
  if (!redis) return [];
  try {
    const raw = await redis.lrange<string | Hit>(key(token), 0, MAX_HITS - 1);
    return raw
      .map((r) => (typeof r === "string" ? safeParse(r) : (r as Hit)))
      .filter((h): h is Hit => !!h);
  } catch (err) {
    console.error("getHits failed (non-fatal):", err);
    return [];
  }
}

function safeParse(s: string): Hit | null {
  try {
    return JSON.parse(s) as Hit;
  } catch {
    return null;
  }
}

/** Truncate a UA so the dashboard stays readable. */
export function shortUA(ua: string | undefined): string {
  if (!ua) return "(none)";
  return ua.length > 70 ? ua.slice(0, 70) + "…" : ua;
}
