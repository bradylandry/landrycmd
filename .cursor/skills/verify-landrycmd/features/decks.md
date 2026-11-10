# Decks

Decks are shareable flashcard sets. The index lists each deck, and each deck page is a card player: tap the card to flip it, step through, or shuffle.

## Sub-features

- Index at `/decks/` with one link per deck, its course, and its card count. It says "No decks yet." when there are none.
- Deck page at `/decks/<id>/` with a counter ("Card 1 of N"), a progress bar, and an "All decks" link back to the index
- Flip: tap or click the card. Space also flips it.
- Previous and Next buttons, and the Left and Right arrow keys. Previous is disabled on the first card and Next on the last.
- Shuffle reorders the deck and goes back to card 1.
- Nothing is saved. A reload starts the deck over in file order.

Current deck id: `biology-ii-unit-3-integumentary`.

## How to get to it (user POV)

Nothing in the header, footer, or home page links to decks. Open `/decks/` directly, or a deck link someone shared. From the index, press a deck title. No login. The pages are indexable: they carry a canonical and OG tags, not `noindex`.

Each deck is one file in `src/data/decks/<id>.json` with `id`, `title`, `course`, and `cards[{front,back}]`. `src/lib/decks.ts` rejects any other key, an empty deck, or an id that is not lowercase words joined by `-`. `src/pages/decks/[id].astro` builds one page per file, so a new JSON there is a new public page. The player is `src/scripts/deck-player.ts`.

## Driving it with curl

```bash
curl -fsSL -o /tmp/landrycmd-verify/decks.html http://localhost:4321/decks/
test -s /tmp/landrycmd-verify/decks.html
grep -q 'href="/decks/biology-ii-unit-3-integumentary"' /tmp/landrycmd-verify/decks.html
curl -fsSL -o /tmp/landrycmd-verify/deck.html http://localhost:4321/decks/biology-ii-unit-3-integumentary/
test -s /tmp/landrycmd-verify/deck.html
grep -q 'data-deck-player' /tmp/landrycmd-verify/deck.html
grep -Eq '<button[^>]* data-card[ >]' /tmp/landrycmd-verify/deck.html
grep -Eq 'data-cards="[^"]+' /tmp/landrycmd-verify/deck.html
grep -q 'data-counter' /tmp/landrycmd-verify/deck.html
grep -q 'data-shuffle' /tmp/landrycmd-verify/deck.html
grep -Eq 'href="/decks"[^>]*>All decks' /tmp/landrycmd-verify/deck.html
```

Selectors: `[data-deck-player]`, `[data-card]` (with `aria-pressed`), `[data-front]`, `[data-back]`, `[data-counter]`, `[data-progress]`, `[data-prev]`, `[data-next]`, `[data-shuffle]`.

In a browser: click `[data-card]` and expect `aria-pressed="true"`. Click `[data-next]` and expect `[data-counter]` to read "Card 2 of N" and the card to be unflipped. Click `[data-shuffle]` and expect "Card 1 of N".

`drive.mjs` runs contrast on `/decks/` and `/decks/biology-ii-unit-3-integumentary/`. It does not run overflow, motion, or the player clicks on them, so a run that only executes `drive.mjs` has not verified the player.

## Gotchas

- The recipe fetches the trailing-slash URLs. The index links `/decks/<id>` and the deck page links `/decks`, both with no trailing slash, and the static server redirects them. Keep `-L` when you follow those on-page links with curl.
- The build emits `data-cards` double-quoted, with the JSON quotes escaped as `&#34;`. The grep above matches that form.
- The player reads the cards from the `data-cards` attribute on `[data-deck-player]`. Card text is in the HTML at build time, so the page needs no fetch after load.
- The arrow and Space keys are bound on `document`. They do nothing while focus is in an editable field.
- Deck titles can contain an em dash. Grep for attributes, not the title text.
