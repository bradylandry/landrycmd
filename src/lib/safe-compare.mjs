import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Per-process key. Both inputs are HMACed to fixed-length digests, so
// timingSafeEqual always gets equal-length buffers and the byte compare does
// not stop early. Hashing still takes time in proportion to input length, so
// this hides where two values differ, not how long they are. The secrets
// checked here are short, so that does not matter in practice.
const KEY = randomBytes(32);

function digest(value) {
  return createHmac("sha256", KEY).update(value, "utf8").digest();
}

/**
 * Constant-time string equality for secrets. Non-string or empty inputs
 * return false, so an unset expected secret fails closed. Strings with a lone
 * surrogate also return false: the utf8 encoder turns every lone surrogate
 * into the same replacement bytes, so two different malformed strings would
 * otherwise hash the same and compare equal.
 * @param {unknown} a
 * @param {unknown} b
 */
export function safeEqual(a, b) {
  const valid =
    typeof a === "string" &&
    typeof b === "string" &&
    a !== "" &&
    b !== "" &&
    a.isWellFormed() &&
    b.isWellFormed();
  const left = digest(typeof a === "string" ? a : "");
  const right = digest(typeof b === "string" ? b : "");
  return timingSafeEqual(left, right) && valid;
}
