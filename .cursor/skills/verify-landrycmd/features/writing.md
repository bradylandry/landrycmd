# Writing

## Sub-features

- Index of published posts
- A post page
- RSS at `/rss.xml`

## How to get to it (user POV)

Header or footer path `/writing/`. Each title links to `/writing/<slug>/`. Posts live in `src/content/writing/` and show up when `draft` is not true.

## Driving it with curl and drive.mjs

```bash
curl -fsS http://localhost:4321/writing/ | grep -q 'Hello: what this is'
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:4321/writing/hello/
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:4321/rss.xml
```

Index selector: `ul.writing-list a[href^="/writing/"]`. Post selector: `article.prose h1`.

`drive.mjs` includes `/writing/` in the dark and light contrast pass. It does not submit anything.

## Gotchas

- A file with `draft: true` is omitted from `getStaticPaths`. Do not expect it on the index.
- Several essays keep the literal `NEEDS NUMBER` where a figure is unsourced. The scan lists those lines and does not fail on them.
- External links in essays are allowlisted hosts in `scan-public.mjs`. A new host fails the scan until it is added there on purpose.
