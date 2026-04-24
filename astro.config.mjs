import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

export default defineConfig({
  site: "https://landrycmd.com",
  integrations: [mdx()],
  // default directory format — clean URLs like /privacy/
});
