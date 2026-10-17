# Public résumé

## Sub-features

- Presales résumé at `/resume`
- Same chrome as the rest of the site (theme, menu)
- No employer name, no prepared-for line

## How to get to it (user POV)

Header Résumé, or `/resume`. The public page never names a firm. Links sent to an employer are a different, unlisted URL and are out of this drive.

## Driving it with curl and drive.mjs

```bash
curl -fsS http://localhost:4321/resume | grep -q '<h1>Brady Landry</h1>'
curl -fsS http://localhost:4321/resume | grep -q 'id="summary"'
if curl -fsS http://localhost:4321/resume | grep -q 'prepared-for'; then exit 1; fi
```

Selectors: `h1`, `#summary`, `#skills`, `a[href="mailto:bjlandry@gmail.com"]`. There is no `.prepared-for` on this page.

`drive.mjs` runs contrast on `/resume` in both themes. It does not request a token URL.

## Gotchas

- `/resume/<token>` and `/api/track` record visits when Redis is configured. Do not invent a token and do not POST a beacon.
- `/applications` is 500 without `APPS_SECRET`. Do not try pins on `/login`.
- Unsourced figures in `src/lib/resume.ts` say `NEEDS NUMBER`. The scan reports them and does not fail the build for them.
- The public résumé is the presales variant (`src/pages/resume.astro` passes `variant="presales"`).
