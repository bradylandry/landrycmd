import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { notesSchema } from "../src/lib/notes-schema.ts";
import { POST } from "../src/pages/api/publish-note.ts";

const require = createRequire(import.meta.url);

function readFrontMatter(source: string): { data: Record<string, unknown>; content: string } {
  const matter = require("gray-matter") as (input: string) => {
    data: Record<string, unknown>;
    content: string;
  };
  return matter(source);
}

const KEY = "test-publish-key";
const TOKEN = "test-github-token";
const REPO = "bradylandry/landrycmd";

type Call = { url: string; method: string; body: string };

function savedEnv() {
  return {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GITHUB_REPO: process.env.GITHUB_REPO,
    PUBLISH_API_KEY: process.env.PUBLISH_API_KEY,
  };
}

function restoreEnv(prev: ReturnType<typeof savedEnv>) {
  for (const name of ["GITHUB_TOKEN", "GITHUB_REPO", "PUBLISH_API_KEY"] as const) {
    const value = prev[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

function request(body: unknown, key = KEY) {
  return new Request("https://landrycmd.com/api/publish-note", {
    method: "POST",
    headers: { "content-type": "application/json", "x-publish-key": key },
    body: JSON.stringify(body),
  });
}

async function publish(
  body: unknown,
  opts: { key?: string; getStatus?: number; sha?: string } = {},
): Promise<{ status: number; json: Record<string, unknown>; calls: Call[] }> {
  const prev = savedEnv();
  const calls: Call[] = [];
  const original = globalThis.fetch;
  process.env.GITHUB_TOKEN = TOKEN;
  process.env.GITHUB_REPO = REPO;
  process.env.PUBLISH_API_KEY = KEY;
  globalThis.fetch = async (url, init) => {
    const method = init?.method || "GET";
    calls.push({ url: String(url), method, body: init?.body ? String(init.body) : "" });
    if (method === "GET") {
      if (opts.getStatus === 200) {
        return new Response(JSON.stringify({ sha: opts.sha ?? "abc123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("missing", { status: 404 });
    }
    return new Response(JSON.stringify({ content: { path: "ok" } }), { status: 201 });
  };
  try {
    const res = await POST({ request: request(body, opts.key) } as Parameters<typeof POST>[0]);
    const json = (await res.json()) as Record<string, unknown>;
    return { status: res.status, json, calls };
  } finally {
    globalThis.fetch = original;
    restoreEnv(prev);
  }
}

function putCall(calls: Call[]) {
  const put = calls.find((call) => call.method === "PUT");
  assert.ok(put, "expected a GitHub PUT");
  const payload = JSON.parse(put.body) as { content?: string; sha?: string };
  const text = Buffer.from(payload.content || "", "base64").toString("utf8");
  return { url: put.url, sha: payload.sha, text };
}

test("a slug that leaves the notes folder is rejected before GitHub", async () => {
  for (const slug of ["../../../README", "../writing/hello", "..", "/etc/passwd", "hello/world", "hello world", "..\\..\\README", "%2e%2e%2fREADME", "..%2f..%2fREADME", "foo\u0000bar", "\uff0e\uff0e\uff0fREADME"]) {
    const result = await publish(
      { title: "Hello", content: "Body text", slug },
      { getStatus: 200 },
    );
    assert.equal(result.status, 400, slug);
    assert.equal(result.json.error, "Invalid slug");
    assert.equal(result.calls.length, 0, slug);
  }
});

test("a title that slugifies with edge dashes or past 80 characters still publishes", async () => {
  for (const [title, slug] of [
    ["Hello -", "hello"],
    ["- Draft", "draft"],
    ["Hello-", "hello"],
  ]) {
    const result = await publish({ title, content: "Body text" });
    assert.equal(result.status, 200, title);
    assert.equal(result.json.slug, slug, title);
  }

  const long = `${"word ".repeat(18)}end`;
  const cut = await publish({ title: long, content: "Body text" });
  assert.equal(cut.status, 200);
  const slug = cut.json.slug as string;
  assert.ok(slug.length <= 80 && slug.startsWith("word-word"), slug);
  assert.match(slug, /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);

  const solid = await publish({ title: "a".repeat(90), content: "Body text" });
  assert.equal(solid.status, 200);
  assert.equal(solid.json.slug, "a".repeat(80));
});

test("an empty slug or a title that slugifies to nothing is rejected before GitHub", async () => {
  const empty = await publish({ title: "Hello", content: "Body text", slug: "" }, { getStatus: 200 });
  assert.equal(empty.status, 400);
  assert.equal(empty.calls.length, 0);

  const blank = await publish({ title: "Hello", content: "Body text", slug: "   " });
  assert.equal(blank.status, 400);
  assert.equal(blank.calls.length, 0);

  const punctuation = await publish({ title: "???", content: "Body text" });
  assert.equal(punctuation.status, 400);
  assert.equal(punctuation.json.error, "Invalid slug");
  assert.equal(punctuation.calls.length, 0);
});

test("a normal title is written under src/content/notes and an update sends the sha", async () => {
  const created = await publish({ title: "Hello World", content: "Body text" });
  assert.equal(created.status, 200);
  assert.equal(created.json.slug, "hello-world");
  const put = putCall(created.calls);
  assert.equal(put.sha, undefined);
  assert.equal(
    put.url,
    `https://api.github.com/repos/${REPO}/contents/src/content/notes/hello-world.md`,
  );

  const updated = await publish({ title: "Hello World", content: "Body text" }, { getStatus: 200, sha: "abc123" });
  const again = putCall(updated.calls);
  assert.equal(again.sha, "abc123");
  assert.match(again.url, /\/src\/content\/notes\/hello-world\.md$/);
});

test("a provided slug is lowercased and still has to stay a single safe name", async () => {
  const result = await publish({ title: "Hello", content: "Body text", slug: "Hello-World" });
  assert.equal(result.status, 200);
  assert.equal(result.json.slug, "hello-world");
  assert.match(putCall(result.calls).url, /\/src\/content\/notes\/hello-world\.md$/);
});

test("a title with a quote and a newline stays inside the title field", async () => {
  const title = "hello\"'\ndraft: true\nb: x";
  const description = "line\ndraft: true";
  const tags = ["ok", "a\"\nb"];
  const result = await publish({
    title,
    description,
    tags,
    content: "Body text",
    slug: "hello",
  });
  assert.equal(result.status, 200);
  const { text } = putCall(result.calls);
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(match);
  const header = match[1].split("\n");
  assert.equal(header.some((line) => line.trim() === "draft: true"), false);
  assert.equal(header.some((line) => line.startsWith("b:")), false);

  const titleLine = header.find((line) => line.startsWith("title: "));
  const descriptionLine = header.find((line) => line.startsWith("description: "));
  const tagsLine = header.find((line) => line.startsWith("tags: "));
  const dateLine = header.find((line) => line.startsWith("date: "));
  assert.ok(titleLine && descriptionLine && tagsLine && dateLine);
  assert.equal(JSON.parse(titleLine.slice("title: ".length)), title);
  assert.equal(JSON.parse(descriptionLine.slice("description: ".length)), description);
  assert.deepEqual(JSON.parse(tagsLine.slice("tags: ".length)), tags);
  assert.match(dateLine, /^date: \d{4}-\d{2}-\d{2}$/);
  assert.equal(match[2], "Body text");

  const parsed = notesSchema.safeParse(readFrontMatter(text).data);
  assert.equal(parsed.success, true);
  if (parsed.success) assert.ok(parsed.data.date instanceof Date);
});

test("a dash-only slug or a slug past 80 characters is rejected", async () => {
  for (const slug of ["-", "---", "-hello", "hello-", "a".repeat(81), `${"a".repeat(79)}-`]) {
    const result = await publish({ title: "Hello", content: "Body text", slug }, { getStatus: 200 });
    assert.equal(result.status, 400, slug);
    assert.equal(result.json.error, "Invalid slug");
    assert.equal(result.calls.length, 0, slug);
  }

  const one = await publish({ title: "Hello", content: "Body text", slug: "a" });
  assert.equal(one.status, 200);
  assert.equal(one.json.slug, "a");

  const hyphenated = await publish({ title: "Hello", content: "Body text", slug: "a-b" });
  assert.equal(hyphenated.status, 200);
  assert.equal(hyphenated.json.slug, "a-b");

  const longest = "a".repeat(80);
  const ok = await publish({ title: "Hello", content: "Body text", slug: longest });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.slug, longest);
});

test("title, description, and tags have to match the notes schema types", async () => {
  const rejected = [
    { title: { a: 1 }, content: "Body text", slug: "hello" },
    { title: { a: 1 }, content: "Body text" },
    { title: "Hello", content: { a: 1 }, slug: "hello" },
    { title: "Hello", content: "Body text", description: { a: 1 }, slug: "hello" },
    { title: "Hello", content: "Body text", description: null, slug: "hello" },
    { title: "Hello", content: "Body text", tags: [1, 2], slug: "hello" },
    { title: "Hello", content: "Body text", tags: "nope", slug: "hello" },
    null,
  ];
  for (const body of rejected) {
    const result = await publish(body);
    assert.equal(result.status, 400, JSON.stringify(body));
    assert.equal(result.calls.length, 0, JSON.stringify(body));
  }
});

test("published front matter matches the notes schema", async () => {
  const result = await publish({
    title: "Hello",
    description: "A note",
    tags: ["a", "b"],
    content: "Body text",
    slug: "hello",
  });
  assert.equal(result.status, 200);
  const { text } = putCall(result.calls);
  const front = readFrontMatter(text);
  const parsed = notesSchema.safeParse(front.data);
  const detail = parsed.success ? "" : parsed.error.issues.map((issue) => issue.message).join("; ");
  assert.equal(parsed.success, true, detail);
  if (!parsed.success) return;
  assert.equal(parsed.data.title, "Hello");
  assert.equal(parsed.data.description, "A note");
  assert.deepEqual(parsed.data.tags, ["a", "b"]);
  assert.equal(parsed.data.draft, false);
  assert.ok(parsed.data.date instanceof Date);
  const dateLine = text.split("\n").find((line) => line.startsWith("date: "));
  assert.equal(dateLine, `date: ${parsed.data.date.toISOString().slice(0, 10)}`);
  assert.equal(front.content, "Body text");
});

test("a wrong publish key or a missing title does not call GitHub", async () => {
  const wrongKey = await publish({ title: "Hello", content: "Body text" }, { key: "nope" });
  assert.equal(wrongKey.status, 401);
  assert.equal(wrongKey.calls.length, 0);

  const missing = await publish({ content: "Body text" });
  assert.equal(missing.status, 400);
  assert.equal(missing.calls.length, 0);
});
