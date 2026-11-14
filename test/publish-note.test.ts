import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../src/pages/api/publish-note.ts";

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
  for (const slug of ["../../../README", "../writing/hello", "..", "/etc/passwd", "hello/world", "hello world"]) {
    const result = await publish(
      { title: "Hello", content: "Body text", slug },
      { getStatus: 200 },
    );
    assert.equal(result.status, 400, slug);
    assert.equal(result.json.error, "Invalid slug");
    assert.equal(result.calls.length, 0, slug);
  }
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
  assert.match(dateLine, /^date: "\d{4}-\d{2}-\d{2}"$/);
  assert.equal(match[2], "Body text");
});

test("a wrong publish key or a missing title does not call GitHub", async () => {
  const wrongKey = await publish({ title: "Hello", content: "Body text" }, { key: "nope" });
  assert.equal(wrongKey.status, 401);
  assert.equal(wrongKey.calls.length, 0);

  const missing = await publish({ content: "Body text" });
  assert.equal(missing.status, 400);
  assert.equal(missing.calls.length, 0);
});
