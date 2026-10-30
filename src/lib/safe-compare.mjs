import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Per-process key. Both inputs are HMACed to fixed-length digests, so
// timingSafeEqual never sees unequal lengths and length is not leaked.
const KEY = randomBytes(32);

function digest(value) {
  return createHmac("sha256", KEY).update(value, "utf8").digest();
}

/**
 * Constant-time string equality for secrets. Non-string or empty inputs
 * return false, so an unset expected secret fails closed.
 * @param {unknown} a
 * @param {unknown} b
 */
export function safeEqual(a, b) {
  const valid = typeof a === "string" && typeof b === "string" && a !== "" && b !== "";
  const left = digest(typeof a === "string" ? a : "");
  const right = digest(typeof b === "string" ? b : "");
  return timingSafeEqual(left, right) && valid;
}
