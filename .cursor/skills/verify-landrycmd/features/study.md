# Study pages

## Sub-features

- Flash cards: tap to flip, Previous and Next, swipe left or right on the card
- Topic filter (`select[data-cat]`), Shuffle, Start over
- Piles: "Got it" takes a card out, "Study again" sends it to the back of the queue. When the queue is empty, "Go over the missed cards" restarts with only the missed ones.
- Practice quiz tab with a final score and the missed questions
- Progress is saved in `localStorage` under `study:<id>`. The quiz's last score is saved under `study:<id>:quiz`.

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

- A swipe also produces a click on some browsers. The player ignores a click within 500ms of a swipe.
- Changing the topic starts a fresh session for that topic.
- Saved progress carries a fingerprint of the cards and quiz. Editing the JSON drops old progress instead of pointing at the wrong cards.
