# Public résumé

## Sub-features

- Presales résumé at `/resume`
- Same chrome as the rest of the site (theme, menu)
- No employer name, no prepared-for line

## How to get to it (user POV)

Header Résumé, or `/resume`. The public page never names a firm. Links sent to an employer are a different, unlisted URL and are out of this drive.

## Driving it with curl and drive.mjs

```bash
curl -fsSL -o /tmp/landrycmd-verify/resume.html http://localhost:4321/resume
test -s /tmp/landrycmd-verify/resume.html
grep -q '<h1>Brady Landry</h1>' /tmp/landrycmd-verify/resume.html
grep -q 'id="summary"' /tmp/landrycmd-verify/resume.html
grep -q '<h1>Brady Landry</h1>' /tmp/landrycmd-verify/resume.html && ! grep -q 'prepared-for' /tmp/landrycmd-verify/resume.html
```

Selectors: `h1`, `#summary`, `#skills`, `a[href="mailto:bjlandry@gmail.com"]`. There is no `.prepared-for` on this page.

`drive.mjs` runs contrast on `/resume` in both themes. It does not request a token URL.

## Gotchas

- `/resume/<token>` and `/api/track` record visits when Redis is configured. Do not invent a token and do not POST a beacon.
- `/applications` is 500 without `APPS_SECRET`. Do not try pins on `/login`.
- Unsourced figures in `src/lib/resume.ts` say `NEEDS NUMBER`. The scan reports them and does not fail the build for them.
- The public résumé is the presales variant (`src/pages/resume.astro` passes `variant="presales"`).
