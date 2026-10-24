# Interactive labs

The labs are five network simulators. Each one opens in a dialog from the home page and also has its own page.

## Sub-features

- Five cards on the home Lab band, each opening `#lab-dialog`
- Standalone pages for the same sims
- Phone-only full-screen entry (`.lab-fs`)
- Packet dashes from `public/lab/wire.css` (`stroke-dasharray: 5 15`, `stroke-dashoffset: -40`)

Slugs: `mcp-simulator`, `frr-review`, `migration-simulator`, `ring-collapse`, `airtap-mpls`.

## How to get to it (user POV)

From Home, scroll to Lab and press a lab name. Or open `/lab/mcp-simulator/` (and the other four) directly. Inside the dialog, "Open page" goes to the standalone URL. On a phone, Full screen sits on the simulator.

## Driving it with curl and drive.mjs

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:4321/lab/mcp-simulator/
node .cursor/skills/verify-landrycmd/drive.mjs
node --experimental-strip-types --import ./test/register-hooks.mjs --test test/lab-wire-geometry.test.ts
```

Dialog: `button.lab-open[data-lab="mcp-simulator"]`, `#lab-dialog`, `#lab-dialog-title`, `.lab-dialog-frame`, `.lab-dialog-close`, `.lab-dialog-page`.

Fullscreen probe (scripted in `drive.mjs`, not clicked): `.lab-fs` inside `.view` on `/lab/mcp-simulator/`.

`?embed=1` adds `html.lab-embed` and hides `.lab-header`, `.lab-footer`, and `.cross`. The dialog iframe uses that query.

## Gotchas

- `.lab-fs` is `display: none` until `max-width: 719px`, then `inline-flex`. It is a grid item, so the used value at 360px is `flex`. At 768 and 1440 the entry control is hidden. After entering fullscreen, `.view.is-fs > .lab-fs` and `.view:fullscreen > .lab-fs` show the exit control at any width. The visibility check must not click the button.
- `mountLabDialog` navigates a same-origin iframe with `contentWindow.location.replace`. The frame's `src` attribute can stay unset. Read `contentWindow.location`, which is `/lab/<slug>/?embed=1`.
- `astro dev` returns 404 for `/lab/<slug>/` and 200 for `/lab/<slug>/index.html`. The static build in `.vercel/output/static` and Vercel serve the directory, which is the href on the home page and the dialog iframe (`/lab/mcp-simulator/?embed=1`). `astro preview` does not run with the Vercel adapter. Verify against the static server in the skill's Launch.
- `wire.js` inserts `.lab-fs` on `DOMContentLoaded`. Waiting for `document.readyState === "complete"` on that pathname is enough.
- Reduced motion stops `.flow.on` (`animation: none` in `wire.css`) and clears `--glow`. The home script skips the intersection observer when `prefers-reduced-motion: reduce`, so a probe element with class `flow on` is what shows the animation is actually off.
- Packet dashes are a geometry test, not a screenshot. `test/lab-wire-geometry.test.ts` fails if a dash crosses a node box or label.
- Lab pages are their own documents. They do not use the site menu.
