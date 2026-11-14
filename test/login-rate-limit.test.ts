import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { checkRateLimit, type RateLimitRedis } from "../src/lib/login-rate-limit.ts";

mock.method(console, "error", () => {});

type Row = { count: number; ttlAt: number | null };

function createRedis(opts: { expireThrows?: number } = {}) {
  const keys = new Map<string, Row>();
  let now = 0;
  let expireCalls = 0;
  const live = (key: string) => {
    const row = keys.get(key);
    if (!row) return undefined;
    if (row.ttlAt != null && now >= row.ttlAt) {
      keys.delete(key);
      return undefined;
    }
    return row;
  };
  const redis: RateLimitRedis & {
    advance(ms: number): void;
    seed(key: string, count: number, ttlAt: number | null): void;
    snapshot(): { key: string; count: number; ttlMs: number | null }[];
    expireCalls: number;
  } = {
    advance(ms) {
      now += ms;
    },
    seed(key, count, ttlAt) {
      keys.set(key, { count, ttlAt });
    },
    snapshot() {
      return [...keys.entries()].map(([key, row]) => ({
        key,
        count: row.count,
        ttlMs: row.ttlAt == null ? null : row.ttlAt - now,
      }));
    },
    get expireCalls() {
      return expireCalls;
    },
    async set(key, value, setOpts) {
      if (live(key)) return null;
      const count = Number(value);
      keys.set(key, {
        count: Number.isFinite(count) ? count : 0,
        ttlAt: now + setOpts.ex * 1000,
      });
      return "OK";
    },
    async incr(key) {
      const row = live(key) ?? { count: 0, ttlAt: null };
      row.count += 1;
      keys.set(key, row);
      return row.count;
    },
    async ttl(key) {
      const row = keys.get(key);
      if (!row) return -2;
      if (row.ttlAt == null) return -1;
      if (now >= row.ttlAt) return -2;
      return Math.ceil((row.ttlAt - now) / 1000);
    },
    async expire(key, seconds) {
      expireCalls += 1;
      if (opts.expireThrows && expireCalls <= opts.expireThrows) {
        throw new Error("expire failed");
      }
      const row = keys.get(key);
      if (!row) return 0;
      if (row.ttlAt == null) row.ttlAt = now + seconds * 1000;
      return 1;
    },
  };
  return redis;
}

const KEY = "ratelimit:auth:apps:203.0.113.5";

test("five tries are allowed, the sixth is refused, and the minute is on the key", async () => {
  const redis = createRedis();
  for (let i = 1; i <= 5; i++) {
    assert.equal(await checkRateLimit("203.0.113.5", redis), true, `try ${i}`);
  }
  assert.equal(await checkRateLimit("203.0.113.5", redis), false);
  const snap = redis.snapshot();
  assert.equal(snap.length, 1);
  assert.equal(snap[0].key, KEY);
  assert.equal(snap[0].count, 6);
  assert.equal(snap[0].ttlMs, 60_000);
  assert.equal(redis.expireCalls, 0);

  redis.advance(60_000);
  assert.equal(await checkRateLimit("203.0.113.5", redis), true);
  const again = redis.snapshot();
  assert.equal(again[0].count, 1);
  assert.equal(again[0].ttlMs, 60_000);
});

test("a thrown expire still leaves a minute on a new key", async () => {
  const redis = createRedis({ expireThrows: 100 });
  for (let i = 1; i <= 5; i++) {
    assert.equal(await checkRateLimit("203.0.113.8", redis), true, `try ${i}`);
  }
  assert.equal(await checkRateLimit("203.0.113.8", redis), false);
  const snap = redis.snapshot();
  assert.equal(snap[0].ttlMs, 60_000);
  assert.equal(redis.expireCalls, 0);

  redis.advance(60_000);
  assert.equal(await checkRateLimit("203.0.113.8", redis), true);
  assert.equal(redis.snapshot()[0].count, 1);
});

test("a key with no minute gets one on a later try, even if the first repair throws", async () => {
  const redis = createRedis({ expireThrows: 1 });
  const key = "ratelimit:auth:apps:203.0.113.9";
  redis.seed(key, 5, null);

  assert.equal(await checkRateLimit("203.0.113.9", redis), false);
  assert.equal(redis.snapshot()[0].count, 6);
  assert.equal(redis.snapshot()[0].ttlMs, null);

  assert.equal(await checkRateLimit("203.0.113.9", redis), false);
  assert.equal(redis.snapshot()[0].count, 7);
  assert.equal(redis.snapshot()[0].ttlMs, 60_000);

  redis.advance(60_000);
  assert.equal(await checkRateLimit("203.0.113.9", redis), true);
  assert.equal(redis.snapshot()[0].count, 1);
  assert.ok(redis.snapshot()[0].ttlMs !== null);
});

test("with no redis the in-process counter still stops at five", async () => {
  const ip = "198.51.100.40";
  for (let i = 1; i <= 5; i++) {
    assert.equal(await checkRateLimit(ip, null), true, `try ${i}`);
  }
  assert.equal(await checkRateLimit(ip, null), false);
});
