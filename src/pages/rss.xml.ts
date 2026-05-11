import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";

// Static-rendered RSS feed for the writing collection. References to /rss.xml
// previously 404'd; this file makes the link real.
export async function GET(context: APIContext) {
  const posts = (await getCollection("writing", ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );

  return rss({
    title: "landrycmd — Writing",
    description:
      "Long-form pieces on infrastructure, AI tooling, personal knowledge management, and the small-but-specific problems I actually run into.",
    site: context.site ?? "https://landrycmd.com",
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/writing/${post.slug}/`,
    })),
  });
}
