---
name: verify-landrycmd
description: Verify landrycmd, the public Astro site (web UI), before opening or updating a PR. Use before opening or updating a PR.
---

# Verify landrycmd

Public site for Brady Landry's AI lab. Visitors use the web UI: home, five labs, writing, the case study, and the public résumé. `/applications`, `/login`, and `/resume/<token>` are unlisted and fail closed without env. Do not POST `/api/auth`, `/api/track`, or `/api/publish-note`. There is no dry-run flag; those routes are the side effects, and with Redis unset tracking writes nothing.

`npm run preview` cannot serve this app: the Vercel serverless adapter rejects it (`The @astrojs/vercel/serverless adapter does not support the preview command`). After `npm run build`, the public files are in `.vercel/output/static`. Two static servers can share that directory on ports `4321` and `4331`. `astro dev` is the edit loop, on its own port if a static server is already up. Two `astro dev` processes in one checkout share `.astro/` and will clobber each other. `astro dev` 404s `/lab/<slug>/` and only serves `/lab/<slug>/index.html`. The static build and Vercel serve the directory index the home dialog requests.

Evidence goes to `/tmp/landrycmd-verify/`. Cleanup kills the dev pid recorded there and leaves the files.

## Launch

```bash
mkdir -p /tmp/landrycmd-verify
APPLICATIONS_JSON= DISCLOSED_ROLE_JSON= APPS_PIN= APPS_SECRET= TRIP_SECRET= \
UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN= KV_REST_API_URL= KV_REST_API_TOKEN= \
PUBLISH_API_KEY= GITHUB_TOKEN= npm run build > /tmp/landrycmd-verify/build.log 2>&1
python3 -m http.server 4321 --directory .vercel/output/static --bind localhost > /tmp/landrycmd-verify/dev.log 2>&1 &
echo $! > /tmp/landrycmd-verify/dev.pid
for i in $(seq 1 30); do
  curl -fsS http://localhost:4321/ | grep -q 'id="profile-name"' && break
  sleep 0.5
done
curl -fsS http://localhost:4321/ | grep -q 'id="profile-name"'
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:4321/lab/mcp-simulator/ | grep -q 200
```

Ready when `/` contains `id="profile-name"` and `/lab/mcp-simulator/` is 200. The empty assignments are the same placeholders [CI](../../../.github/workflows/ci.yml) sets on the build step so the build does not read secrets. Directory URLs such as `/resume` redirect to a trailing slash; Chrome follows that. The static server returns 404 for `/applications` because that route is a function, not a file.

## Doctor

Static server on 4321, then `astro dev` on 4331 with secrets blanked:

```bash
curl -fsSL -o /tmp/landrycmd-verify/doctor-home.html -w 'home:%{http_code}\n' http://localhost:4321/ \
  && grep -q 'id="profile-name"' /tmp/landrycmd-verify/doctor-home.html
curl -fsSL -o /dev/null -w 'lab:%{http_code}\n' http://localhost:4321/lab/mcp-simulator/ | grep -q '^lab:200$'
APPLICATIONS_JSON= DISCLOSED_ROLE_JSON= APPS_PIN= APPS_SECRET= TRIP_SECRET= \
UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN= KV_REST_API_URL= KV_REST_API_TOKEN= \
PUBLISH_API_KEY= GITHUB_TOKEN= \
npm run dev -- --host localhost --port 4331 > /tmp/landrycmd-verify/dev-apps.log 2>&1 &
echo $! > /tmp/landrycmd-verify/dev-apps.pid
for i in $(seq 1 60); do
  code=$(curl -sS -o /tmp/landrycmd-verify/doctor-apps.txt -w '%{http_code}' http://localhost:4331/applications || true)
  [ "$code" = 500 ] && break
  sleep 1
done
echo "applications:${code}"
grep -q 'Server misconfiguration' /tmp/landrycmd-verify/doctor-apps.txt
```

Home and the MCP lab are 200 on the static server. The doctor block does not request `/resume` or the case study. Those directory URLs 301 to a trailing slash, and the checks in `features/resume.md` and `features/case-study.md` follow that redirect with `-L` and grep the saved page. `/applications` is not in the static output. The empty assignments are in the environment before `astro dev` starts. Node's `loadEnvFile` and Vite leave existing variables in place, so a filled `.env` cannot supply `APPS_SECRET`, `TRIP_SECRET`, Redis, or the publish token to this process. On port 4331, `/applications` is 500 `Server misconfiguration`. Do not submit the form. Stop the 4331 process in Cleanup.

## Drive

Harness is curl plus headless Chrome (`drive.mjs`). Node's test runner covers the dash geometry and the fullscreen CSS contract; it does not replace the browser pass.

```bash
node .cursor/skills/verify-landrycmd/drive.mjs
```

That script drives `VERIFY_BASE` (default `http://localhost:4321`). It exits before Chrome starts when the host is not `localhost`, `127.0.0.1`, or `::1`. That includes `landrycmd.com`, any other `landrycmd.com` host, and a preview origin. `VERIFY_ALLOW_REMOTE=1` is the override that lets a non-local origin run. Every mode fails a request whose path is `/api` or starts with `/api/` before it is sent:

- Sets `data-theme` through `localStorage` key `theme`. Contrast uses the resting color after entrance animations finish. Body text needs 4.5:1. Large text (24px, or bold at 18.66px and up) needs 3:1. A control with no text label (`button`, `input`, `textarea`, `select`, `a.btn`) needs a 3:1 boundary against the background outside it. A labeled control, including `.btn`, is judged by its text, with opacity blended into the ink. Both `dark` and `light` on `/`, `/writing/`, `/resume`, and `/work/ai-network-operations`.
- At 360px, checks `scrollWidth <= clientWidth` on `/` and each lab: `/lab/mcp-simulator/`, `/lab/frr-review/`, `/lab/migration-simulator/`, `/lab/ring-collapse/`, `/lab/airtap-mpls/`.
- With `prefers-reduced-motion: reduce`, checks `--glow` and `--accent-glow` are transparent, `.flow.on` animation is `none`, `.pulse` and `.mline.live` filters are `none`, and nothing is running. Home and every lab.
- At 360px, clicks `#menu-toggle`, then `#site-menu a[href="/#lab"]`, and expects `#site-menu` hidden and `aria-expanded="false"`. Opens the menu again and sends Escape. Work, Lab, and About are the in-page links that call `closeMenu`. Writing and Résumé leave the document.
- On `/lab/mcp-simulator/`, `.lab-fs` is shown at 360 and `display: none` at 768 and 1440. The stylesheet sets `inline-flex` under `max-width: 719px`. The button is a grid item, so the used value is `flex`. The exit control is a different state (`view.is-fs` / `:fullscreen`); this check does not enter fullscreen.
- Clicks `button.lab-open[data-lab="mcp-simulator"]`, expects `#lab-dialog` open, `#lab-dialog-title` "MCP Integration Simulator", the frame location `/lab/mcp-simulator/?embed=1`, and `?lab=mcp-simulator`. Same-origin frames navigate with `location.replace`, so the `src` attribute can stay empty. Clicks `.lab-dialog-close` and expects the dialog closed and the query cleared.

Screenshots only. Local needs no override. A preview origin does:

```bash
VERIFY_ALLOW_REMOTE=1 VERIFY_BASE="$PREVIEW_ORIGIN" VERIFY_OUT=/tmp/landrycmd-verify/preview node .cursor/skills/verify-landrycmd/drive.mjs --screenshots
```

`PREVIEW_ORIGIN` is the origin on the Vercel deployment check for this PR, with no path. Widths are 360, 768, and 1440. Files: `home-360.png`, `home-768.png`, `home-1440.png`. This mode loads `/` only. `/api` is blocked here the same way as in the full pass. Without `VERIFY_ALLOW_REMOTE=1`, a preview or production `VERIFY_BASE` exits before Chrome starts.

## Evidence

Saved under `/tmp/landrycmd-verify/` (or `VERIFY_OUT`):

- `report.json` from the browser pass
- `home-360.png`, `home-768.png`, `home-1440.png`
- `doctor-home.html`, `doctor-apps.txt`, `dev.log`
- scan stdout (below)

The browser pass only GETs pages and clicks in-page controls. Theme writes `localStorage` in the throwaway Chrome profile. The lab dialog uses `history.replaceState`. Neither contacts Redis. Do not open mailto links. Every mode fails any request whose path is `/api` or starts with `/api/` before it is sent, so neither localhost nor a preview origin receives `/api/track`, `/api/auth`, or `/api/publish-note`.

Public-copy scan. Leak patterns fail the process. `NEEDS NUMBER` is listed and does not fail, and it is not a CI grep.

```bash
node .cursor/skills/verify-landrycmd/scan-public.mjs | tee /tmp/landrycmd-verify/scan.txt
```

Scanned trees: `src/pages`, `src/content`, `src/components`, `src/data`, `src/lib/resume.ts`, `public`. Skips `src/pages/api/` and the unlisted `applications`, `login`, and `resume/[token]` pages. Fails on IPv4, URL hosts outside the allowlist in `scan-public.mjs`, device-role acronyms `PE` `CE` `ASBR` `LER` `LSR`, ticket ids `CHG-` `INC-` `RITM-` `TASK-` `REQ-` `PRB-`, site or market codes (`area 10`, `area 20`, device-style names, CLLI-shaped tokens), internal tool names (`tailscale`, `azurecontainerapps`, `jarvis-lab`, `nautobot`, `netbox`, `servicenow`, `solarwinds`, `infoblox`), `.local` / `.internal` / `.corp` / `.lan` names, a coworker or colleague followed by a personal name, and email addresses other than the two published contact addresses.

Packet-dash test, then the steps in [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml):

```bash
node --experimental-strip-types --import ./test/register-hooks.mjs --test test/lab-wire-geometry.test.ts
npm test
npx astro sync
npx tsc --noEmit -p tsconfig.json
npx astro check
APPLICATIONS_JSON= DISCLOSED_ROLE_JSON= APPS_PIN= APPS_SECRET= TRIP_SECRET= \
UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN= KV_REST_API_URL= KV_REST_API_TOKEN= \
PUBLISH_API_KEY= GITHUB_TOKEN= npm run build
```

The first command is the dash file on its own. The workflow's Test step is `npm test`, which runs that file again with private-data, load-private, case-study, lab-dialog, and profile-hero. The geometry file is the packet-dash test (`stroke-dasharray: 5 15` lives in `public/lab/wire.css` and is also asserted from case-study). `npm ci` is the workflow's Install step and is not repeated here. The empty build assignments match the workflow's Build step.

## Cleanup

```bash
kill_tree() {
  local pid="$1" child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}
for pidfile in /tmp/landrycmd-verify/dev.pid /tmp/landrycmd-verify/dev-apps.pid; do
  if [ -f "$pidfile" ]; then
    kill_tree "$(cat "$pidfile")"
    rm -f "$pidfile"
  fi
done
test -f /tmp/landrycmd-verify/report.json && test -f /tmp/landrycmd-verify/home-360.png
```

`npm run dev` records the npm pid. `kill_tree` stops that pid and the `astro dev` child, and nothing else. Leaves `/tmp/landrycmd-verify/` in place. `drive.mjs` already kills the Chrome it spawned.
