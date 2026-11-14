import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://landrycmd.com",
  output: "static",
  adapter: vercel(),
  integrations: [mdx()],
  // static: on-demand routes opt in with `export const prerender = false`
});
