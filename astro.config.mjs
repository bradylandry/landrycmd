import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import vercel from "@astrojs/vercel/serverless";

export default defineConfig({
  site: "https://landrycmd.com",
  output: "hybrid",
  adapter: vercel(),
  integrations: [mdx()],
  // hybrid: pages are static by default; on-demand routes opt in via `export const prerender = false`
});
