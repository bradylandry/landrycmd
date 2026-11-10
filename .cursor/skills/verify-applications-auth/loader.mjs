// Resolves the Astro middleware import so check.mjs can load src/middleware.ts
// under plain Node. Installed by register.mjs via node --import.
// Relative imports with no extension (src/middleware.ts imports
// ./lib/apps-token) resolve to the .ts file, the same rule as
// test/resolve-ts-hook.mjs.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "astro:middleware") {
    return {
      url: new URL("./astro-middleware-stub.mjs", import.meta.url).href,
      shortCircuit: true,
    };
  }
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.[a-z]+$/i.test(specifier)
  ) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}
