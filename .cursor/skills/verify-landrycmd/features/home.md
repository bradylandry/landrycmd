# Home

## Sub-features

- Profile intro: portrait, name, role, résumé and off-site links
- Theme toggle (`dark` / `light`, stored as `localStorage` key `theme`)
- Primary nav on wide viewports, menu sheet at `max-width: 860px`
- Section jumps: Work, Lab, About

## How to get to it (user POV)

Open the site root. The first screen is the profile. Theme sits in the header. Below 860px the word Menu replaces the inline nav.

## Driving it with curl and drive.mjs

```bash
curl -fsS http://localhost:4321/ | grep -q 'id="profile-name"'
node .cursor/skills/verify-landrycmd/drive.mjs
```

Selectors: `#profile-name`, `#theme-toggle`, `#menu-toggle`, `#site-menu`, `#site-menu a[href="/#lab"]`, `#site-menu a[href="/#work"]`, `#site-menu a[href="/#about"]`.

The menu check in `drive.mjs` runs at 360px: open `#menu-toggle`, tap the Lab link, assert `#site-menu` has `hidden` and the button's `aria-expanded` is `false`, then open again and send Escape.

## Gotchas

- `#menu-toggle` is `display: none` above 860px. Drive the sheet at 360, not at 1440.
- Only hrefs containing `#work`, `#lab`, or `#about` call `closeMenu`. `/writing/` and `/resume` navigate away.
- The inline head script sets `data-theme` before paint. A browser check has to set `localStorage` before navigation or it will follow the OS scheme.
- The skip link is `a.skip` pointing at `#content`. It is off-screen until focused.
