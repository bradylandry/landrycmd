// Resolves the Astro middleware import so check.mjs can load src/middleware.ts
// under plain Node. Installed by register.mjs via node --import.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "astro:middleware") {
    return {
      url: new URL("./astro-middleware-stub.mjs", import.meta.url).href,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
