import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const functionsDir = ".vercel/output/functions";
const runtime = "nodejs24.x";
const retired = new Set(["nodejs18.x", "nodejs20.x"]);

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path);
    } else if (name === ".vc-config.json") {
      rewrite(path);
    }
  }
}

function rewrite(path) {
  const config = JSON.parse(readFileSync(path, "utf8"));
  if (!retired.has(config.runtime)) return;
  config.runtime = runtime;
  writeFileSync(path, `${JSON.stringify(config, null, "\t")}\n`);
  console.log(`Set ${path} runtime to ${runtime}`);
}

walk(functionsDir);
