import type { APIRoute } from "astro";

export const prerender = false;

const GITHUB_TOKEN = import.meta.env.GITHUB_TOKEN;
const GITHUB_REPO = import.meta.env.GITHUB_REPO ?? "bradylandry/landrycmd";
const PUBLISH_API_KEY = import.meta.env.PUBLISH_API_KEY;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function buildFrontmatter(fields: Record<string, unknown>): string {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) {
      lines.push(`${k}: [${v.map((s) => `"${s}"`).join(", ")}]`);
    } else if (typeof v === "string" && v.includes('"')) {
      lines.push(`${k}: '${v}'`);
    } else if (typeof v === "string") {
      lines.push(`${k}: "${v}"`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}

export const POST: APIRoute = async ({ request }) => {
  // Auth
  const key = request.headers.get("x-publish-key");
  if (!PUBLISH_API_KEY || key !== PUBLISH_API_KEY) {
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

  const slug = providedSlug ?? slugify(title);
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
