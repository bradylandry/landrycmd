import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://landrycmd.com",
  adapter: vercel(),
  integrations: [mdx()],
  // Static by default. On-demand routes opt in with `export const prerender = false`.
});
