// Resolves the Astro middleware import so check.mjs can load src/middleware.ts
// under plain Node. Installed by register.mjs via node --import.
// Relative imports with no extension (src/middleware.ts imports
// ./lib/apps-token) resolve to the .ts file, the same rule as
// test/resolve-ts-hook.mjs, but only for importers under src/ so a package
// in node_modules is never rewritten.
const srcUrl = new URL("../../../src/", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "astro:middleware") {
    return {
      url: new URL("./astro-middleware-stub.mjs", import.meta.url).href,
      shortCircuit: true,
    };
  }
  if (
    context.parentURL?.startsWith(srcUrl) &&
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.[a-z]+$/i.test(specifier)
  ) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}
