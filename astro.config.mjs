import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import vercel from "@astrojs/vercel/serverless";

export default defineConfig({
  site: "https://landrycmd.com",
  output: "hybrid",
  adapter: vercel(),
  integrations: [mdx()],
  // hybrid: pages are static by default; trip pages opt in to SSR via `export const prerender = false`
});
