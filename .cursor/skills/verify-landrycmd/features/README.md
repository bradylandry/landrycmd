# landrycmd verification map

This directory is the maintained source for verifying the visitor-facing behavior of landrycmd, the public Astro site. Read the index before driving the site, then use the matching feature file as the recipe.

## Baseline preconditions

- Build with the empty assignments in the skill Launch, then serve `.vercel/output/static` at `http://localhost:4321`.
- Evidence goes to `/tmp/landrycmd-verify/`. A second static server can use the same directory on port `4331`. Two `astro dev` processes in one checkout share `.astro/` and will clobber each other.
- Leave `APPS_SECRET`, `TRIP_SECRET`, Redis, and the publish token empty. Do not POST `/api/auth`, `/api/track`, or `/api/publish-note`.
- Run the Doctor block and require `/` to contain `id="profile-name"`, `/lab/mcp-simulator/` to be 200, and `/applications` on the dev server to be 500 `Server misconfiguration`.
- Never drive an instance that was not started by this verification run.

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say otherwise.
- Prefer the selectors named in the feature file (`id`, `data-lab`, `href`) over coordinates.
- Treat every command as literal.
- Run browser actions through `node .cursor/skills/verify-landrycmd/drive.mjs`.
- Run page reads through `curl` against `http://localhost:4321`.
- Cleanup kills the recorded pids and leaves `/tmp/landrycmd-verify/` in place.

## Proof and skip reporting

- Capture the visitor action and the resulting state, not only the final screen.
- Browser proof includes `report.json` and the screenshots the drive writes.
- HTTP proof includes the status and a grep of the saved body.
- Record the feature file and the entry point with the notes for the run.
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.
- `/study/<id>` is unlisted. `drive.mjs` does not open it. Driving that file is a separate browser pass, and a run that only executes `drive.mjs` has not verified it.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the visitor-visible behavior. It then uses these H2 sections in order: `Sub-features`, `How to get to it (user POV)`, `Driving it with <harness>`, `Gotchas`.

## Features

| Feature | Path | File |
| --- | --- | --- |
| Home, theme, menu | `/` | [home.md](home.md) |
| Interactive labs | `/#lab`, `/lab/<slug>/` | [labs.md](labs.md) |
| Writing | `/writing/` | [writing.md](writing.md) |
| Case study | `/work/ai-network-operations` | [case-study.md](case-study.md) |
| Public résumé | `/resume` | [resume.md](resume.md) |
| Study pages (unlisted) | `/study/<id>` | [study.md](study.md) |

Unlisted, and not part of the public drive: `/applications`, `/login`, `/resume/<token>`, `/api/auth`, `/api/track`, `/api/publish-note`.
