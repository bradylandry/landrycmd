import type { APIRoute } from "astro";
import { safeEqual } from "../../lib/safe-compare.mjs";

export const prerender = false;

// import.meta.env throws under plain Node, where the tests run. The Astro
// server build rewrites these reads to process.env. An empty value stays
// empty, so a missing publish token fails closed.
function metaString(read: () => string | undefined): string | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

function publishSettings(): { token: string; repo: string; key: string } {
  const tokenMeta = metaString(() => import.meta.env.GITHUB_TOKEN);
  const repoMeta = metaString(() => import.meta.env.GITHUB_REPO);
  const keyMeta = metaString(() => import.meta.env.PUBLISH_API_KEY);
  const token = tokenMeta !== undefined ? tokenMeta : (process.env.GITHUB_TOKEN ?? "");
  const repo = (repoMeta !== undefined ? repoMeta : process.env.GITHUB_REPO) ?? "bradylandry/landrycmd";
  const key = keyMeta !== undefined ? keyMeta : (process.env.PUBLISH_API_KEY ?? "");
  return { token, repo, key };
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const SAFE_SLUG = /^[a-z0-9-]+$/;

function safeSlug(raw: string): string | null {
  const slug = raw.trim().toLowerCase();
  if (!SAFE_SLUG.test(slug)) return null;
  return slug;
}

// JSON string encoding is also a valid YAML double-quoted scalar, so a quote
// or a newline stays inside the value instead of opening a new header line.
function yamlString(value: string): string {
  return JSON.stringify(value);
}

function buildFrontmatter(fields: Record<string, unknown>): string {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) {
      lines.push(`${k}: [${v.map((s) => yamlString(String(s))).join(", ")}]`);
    } else if (typeof v === "string") {
      lines.push(`${k}: ${yamlString(v)}`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}

export const POST: APIRoute = async ({ request }) => {
  const { token: GITHUB_TOKEN, repo: GITHUB_REPO, key: PUBLISH_API_KEY } = publishSettings();
  const key = request.headers.get("x-publish-key");
  if (!PUBLISH_API_KEY || !safeEqual(key, PUBLISH_API_KEY)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!GITHUB_TOKEN) {
    return new Response(JSON.stringify({ error: "GITHUB_TOKEN not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { title?: string; content?: string; description?: string; tags?: string[]; slug?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { title, content, description, tags = [], slug: providedSlug } = body;
  if (!title || !content) {
    return new Response(JSON.stringify({ error: "title and content are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawSlug = typeof providedSlug === "string" ? providedSlug : slugify(title);
  const slug = safeSlug(rawSlug);
  if (!slug) {
    return new Response(JSON.stringify({ error: "Invalid slug" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const date = new Date().toISOString().split("T")[0];
  const filePath = `src/content/notes/${slug}.md`;

  const frontmatter = buildFrontmatter({
    title,
    ...(description ? { description } : {}),
    date,
    ...(tags.length ? { tags } : {}),
  });
  const fileContent = frontmatter + content;
  const encoded = Buffer.from(fileContent).toString("base64");

  // Check if file already exists (needed for SHA to update)
  const ghBase = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;
  const ghHeaders = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };

  let sha: string | undefined;
  try {
    const existing = await fetch(ghBase, { headers: ghHeaders });
    if (existing.ok) {
      const data = await existing.json() as { sha: string };
      sha = data.sha;
    }
  } catch {
    // file doesn't exist, no SHA needed
  }

  const commitPayload: Record<string, unknown> = {
    message: `notes: publish "${title}"`,
    content: encoded,
    ...(sha ? { sha } : {}),
  };

  const ghRes = await fetch(ghBase, {
    method: "PUT",
    headers: ghHeaders,
    body: JSON.stringify(commitPayload),
  });

  if (!ghRes.ok) {
    const err = await ghRes.text();
    return new Response(JSON.stringify({ error: "GitHub commit failed", detail: err }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = `https://landrycmd.com/notes/${slug}/`;
  return new Response(JSON.stringify({ url, slug, message: "Published — live in ~3 min after Vercel deploy" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
