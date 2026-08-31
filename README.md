# landrycmd

Source for [landrycmd.com](https://landrycmd.com), an independent software shop run by Brady Landry. AI infrastructure, algorithmic trading, and mobile health apps.

## Stack

- [Astro](https://astro.build) 4.x, `hybrid` output (static by default; routes opt into SSR with `export const prerender = false`)
- Markdown + MDX for `/writing` posts (via content collections)
- Deployed on Vercel

## Development

```bash
npm install
cp .env.example .env    # then fill it in, or: vercel link && vercel env pull .env
npm run dev             # localhost:4321
npm run build
npm run preview
```

The site runs without any environment variables, but private routes fail
closed and tracking records nothing. See `.env.example` for what each one
affects. `.vercel/` is gitignored, so a fresh clone needs `vercel link`
before `vercel env pull` will work.

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
- `landrycmd.com`: CNAME to Vercel
- `www.landrycmd.com`: CNAME to Vercel

Subdomains (`trading.landrycmd.com`, `jarvis.landrycmd.com`) point at the Azure
VM, not Vercel.

## Tracked résumé links

`/resume/<token>` renders the résumé, records the visit, and can name the firm
on versions sent directly to an employer. The public `/resume` never does.

To add an application, append an entry to `APPLICATIONS` in
`src/lib/applications.ts`. Tokens must carry a random suffix; a guessable
namespace would let anyone enumerate which companies were applied to, since
unknown tokens 404 and known ones 200. Generate one with:

```bash
python3 -c "import secrets,string;a=string.ascii_lowercase+string.digits;\
  print('company-' + ''.join(secrets.choice(a) for _ in range(6)))"
```

Hits land in Redis under `app:hits:<token>` and are viewable at `/applications`,
which sits behind the same PIN as `/trips/*`. Read the "engaged" count, not
"opens": corporate mail scanners fetch the HTML but do not run JavaScript, so
only engaged reflects a human.
