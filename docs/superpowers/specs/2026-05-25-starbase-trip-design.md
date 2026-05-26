# Starbase 2026 Trip Page — Design Spec

## Route & File
- **URL:** `landrycmd.com/trips/starbase-2026`
- **File:** `src/pages/trips/starbase-2026.astro`
- **Prerender:** `true` (fully static)
- **No new CSS** — reuses existing `trip.css`

## Approach
Static Astro page, all content hardcoded. No auth, no backend, no Redis. Inline `<script>` handles countdown timer and localStorage-backed checkboxes.

## Sections (scroll order)
1. **Hero** — title, crew (Brady · Adam · Carlos), dates, countdown to launch window
2. **Sticky nav** — jump links to each section
3. **Schedule** — day cards Thu Jun 19 – Mon Jun 23 using `.day-card` / `.day-timeline`
4. **Launch Watch** — Starship Flight 13, road closure timing, RocketLaunch.Live link
5. **Camp Setup** — Boca Chica Beach vs Rocket Ranch, beach driving tips, coordinates
6. **Packing List** — 6 category checklist with localStorage checkboxes
7. **Gear to Buy** — 5 category shopping list with prices, per-person split, localStorage checkboxes
8. **Things To Do** — cards for Boca Chica/Brownsville + Austin with Maps links
9. **Austin / Comedy Night** — Cap City Comedy Jun 21 (Joe Gatto + Jamie Lissow)
10. **Logistics Tips** — tire PSI, water math (2gal/person/day), border checkpoint, bugs

## Checkbox Persistence
Keys prefixed `starbase-pack-` and `starbase-buy-`. Applied on page load, no flash. Reset link clears all page keys.

## Dates
Provisionally Thu Jun 19 – Mon Jun 23, 2026. Hardcoded, easy to update when launch window confirmed.
