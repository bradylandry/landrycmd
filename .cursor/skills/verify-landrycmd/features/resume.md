# Public résumé

The public résumé is the presales page. It uses the site header and it never names an employer.

## Sub-features

- Presales résumé at `/resume`
- Same chrome as the rest of the site (header nav, menu, footer)
- No employer name, no prepared-for line

## How to get to it (user POV)

Header Résumé, or `/resume`. The public page never names a firm. Links sent to an employer are a different, unlisted URL and are out of this drive.

## Driving it with curl and drive.mjs

```bash
curl -fsSL -o /tmp/landrycmd-verify/resume.html http://localhost:4321/resume
test -s /tmp/landrycmd-verify/resume.html
grep -q '>Brady Landry</h1>' /tmp/landrycmd-verify/resume.html
grep -q 'id="summary"' /tmp/landrycmd-verify/resume.html
if grep -Eq 'class="[^"]*prepared-for' /tmp/landrycmd-verify/resume.html; then echo 'prepared-for present'; exit 1; fi
```

Selectors: `h1`, `#summary`, `#skills`, `a[href="mailto:bjlandry@gmail.com"]`. There is no `.prepared-for` element on this page.

`drive.mjs` runs contrast on `/resume`. It does not request a token URL.

## Gotchas

- `/resume/<token>` and `/api/track` record visits when Redis is configured. Do not invent a token and do not POST a beacon.
- `/applications` is 500 without `APPS_SECRET`. Do not try pins on `/login`.
- Unsourced figures in `src/lib/resume.ts` say `NEEDS NUMBER`. The scan reports them and does not fail the build for them.
- Astro adds `data-astro-cid-*` attributes to scoped elements, so the built `h1` is `<h1 data-astro-cid-...>`. Grep for `>Brady Landry</h1>`, not the bare tag. The scoped `.prepared-for` CSS rule is inlined on every résumé page, so grep for a `class` attribute that contains `prepared-for`, not the bare word.
- The absence check is an `if grep ...; then exit 1; fi` block. A bare `! grep` line does not stop a `set -e` script, so it would pass even when the element is present.
- The public résumé is the presales variant (`src/pages/resume.astro` passes `variant="presales"`).
