import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore plain .mjs skill helper
import { resolve } from "../.cursor/skills/verify-applications-auth/loader.mjs";

const root = new URL("../", import.meta.url).href;
const echo = async (specifier: string) => ({ url: specifier });

test("extensionless import under src/ resolves to .ts", async () => {
  const out = await resolve("./lib/apps-token", { parentURL: `${root}src/middleware.ts` }, echo);
  assert.equal(out.url, "./lib/apps-token.ts");
});

test("extensionless import from node_modules is left alone", async () => {
  const out = await resolve("./util", { parentURL: `${root}node_modules/pkg/index.js` }, echo);
  assert.equal(out.url, "./util");
});
