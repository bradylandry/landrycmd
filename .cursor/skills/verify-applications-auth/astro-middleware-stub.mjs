// Verification stub. Lets the auth check import src/middleware.ts without
// starting Astro. The real defineMiddleware is only a wrapper around onRequest,
// and this check never calls onRequest.
export function defineMiddleware(handler) {
  return handler;
}
