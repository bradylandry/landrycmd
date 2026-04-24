# landrycmd

Source for [landrycmd.com](https://landrycmd.com) — an independent software shop run by Brady Landry. AI infrastructure, algorithmic trading, and mobile health apps.

## Stack

- [Astro](https://astro.build) 4.x (static site)
- Markdown + MDX for `/writing` posts (via content collections)
- Deployed on Vercel

## Development

```bash
npm install
npm run dev      # localhost:4321
npm run build    # outputs to dist/
npm run preview
```

## Adding a writing post

Drop a markdown or MDX file in `src/content/writing/`. Frontmatter shape:

```yaml
---
title: "Post title"
description: "One-sentence summary for SEO + social previews"
date: 2026-04-24
draft: false
tags: [tag-1, tag-2]
---
```

Save → `npm run dev` shows it at `/writing/<filename>/`. On push, Vercel auto-builds and deploys.

## Deployment

Vercel auto-deploys on push to `main`. Preview deploys on PRs.

DNS:
- `landrycmd.com` — CNAME → Vercel
- `www.landrycmd.com` — CNAME → Vercel

Subdomains (`trading.landrycmd.com`, `jarvis.landrycmd.com`) remain pointed at their original hosts (GCP VM).
