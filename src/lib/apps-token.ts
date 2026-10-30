import { safeEqual } from "./safe-compare.mjs";

/**
 * Signing and verification for the apps_auth cookie. Kept free of astro:*
 * imports so the tests can load it directly.
 */
export async function verifyAppsToken(token: string, secret: string): Promise<boolean> {
  if (!secret) return false;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return false;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!payload || !sig) return false;

  try {
    const expected = await sign(payload, secret);
    if (!safeEqual(expected, sig)) return false;

    const parts = payload.split(":");
    if (parts.length !== 3 || parts[0] !== "apps") return false;
    const expiresAt = parseInt(parts[2] ?? "0", 10);
    return expiresAt > 0 && Date.now() < expiresAt;
  } catch {
    return false;
  }
}

export async function sign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
