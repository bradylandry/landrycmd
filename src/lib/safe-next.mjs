const FALLBACK = "/applications";

// The browser deletes tab, LF, and CR before it parses a URL, so a prefix
// check on the raw string is not enough: "/\t/evil.com" becomes "//evil.com".
// Resolve the value and keep it only when it is a path on this origin.
/**
 * @param {unknown} rawNext
 * @param {string} origin
 * @returns {string}
 */
export function safeNext(rawNext, origin) {
  if (typeof rawNext !== "string" || typeof origin !== "string" || origin === "") return FALLBACK;
  if (!rawNext.startsWith("/")) return FALLBACK;
  try {
    const url = new URL(rawNext, origin);
    if (url.origin !== origin) return FALLBACK;
    const next = url.pathname + url.search + url.hash;
    if (!next.startsWith("/") || next.startsWith("//") || /[\u0000-\u0020\\]/.test(next)) return FALLBACK;
    return next;
  } catch {
    return FALLBACK;
  }
}
