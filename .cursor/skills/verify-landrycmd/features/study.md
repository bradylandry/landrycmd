# Study pages

## Sub-features

- Flash cards: tap to flip, Previous and Next, swipe left or right on the card
- Topic filter (`select[data-cat]`), Shuffle, Start over
- Piles: "Got it" takes a card out, "Study again" sends it to the back of the queue. The Study again count is cards still waiting after a miss. When the queue is empty, "Go over the missed cards" restarts with every card missed at least once.
- Start over puts the cards back in deck order for the current topic.
- Practice quiz tab with a final score and the missed questions. Quiz answers are not saved; a reload starts the quiz over.
- Progress is saved in `localStorage` under `study:<id>`.

## How to get to it (user POV)

Unlisted. Nothing on the site links to it. Open `/study/skeletal-system` directly. The page carries `noindex,nofollow,noarchive` and no canonical or OG tags. No login.

Data lives in `src/data/study/<id>.json` with `id`, `title`, `subtitle`, `cards[{cat,q,a}]`, and `quiz[{q,choices,answer}]`. `src/lib/study.ts` rejects any other key.

## Driving it with curl and a browser

```bash
curl -fsS http://localhost:4321/study/skeletal-system/ | grep -q 'noindex,nofollow,noarchive'
curl -fsS http://localhost:4321/study/skeletal-system/ | grep -q 'data-study'
```

At 390x844 with touch on: tap `[data-card]` and expect `aria-pressed="true"`. A horizontal touch swipe on the card changes `[data-counter]` and does not flip it. `[data-again]` raises "Study again" in `[data-stats]`; `[data-known]` raises "Got it" and drops the "left" count. Filter to `Hormones` (2 cards), mark one "Study again" and the other "Got it", and the first card comes back with "missed before". In the quiz tab, choices are `[data-quiz-choices] [data-choice]`, then `[data-quiz-next]`; the result is `[data-quiz-score]` and `.study-missed li`.

`drive.mjs` does not cover this page. `test/study.test.ts` covers the queue, restore, and scoring logic.

## Gotchas

- Touch taps and swipes are handled on `touchend`, which calls `preventDefault` so the browser's synthetic click does not flip the card a second time. Headless Chrome can drop the click for a quick tap right after a swipe, so do not test touch through `click`. Swipes and arrow keys do nothing with one card left.
- Offline works while the tab stays loaded: cards and quiz are inline in the HTML and nothing is fetched after load. There is no service worker, so a reload with no connection fails.
- Changing the topic starts a fresh session for that topic.
- Saved progress carries a fingerprint of the cards and quiz. Editing the JSON drops old progress instead of pointing at the wrong cards.
