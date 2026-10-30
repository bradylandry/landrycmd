import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ALL,
  categories,
  current,
  fingerprint,
  markAgain,
  markKnown,
  move,
  newSession,
  parseStudySet,
  restoreSession,
  retryMissed,
  scoreQuiz,
  serializeStudySet,
  shuffleQueue,
  studyAgainCount,
} from "../src/lib/study.ts";

const root = new URL("..", import.meta.url);
const rawText = await readFile(new URL("src/data/study/skeletal-system.json", root), "utf8");
const set = parseStudySet(JSON.parse(rawText));
const v = fingerprint(set);

test("skeletal system set parses with every card and quiz question", () => {
  assert.equal(set.cards.length, 79);
  assert.equal(set.quiz.length, 10);
  assert.equal(categories(set.cards).length, 17);
  for (const item of set.quiz) assert.ok(item.answer >= 0 && item.answer < item.choices.length);
});

test("study data carries no contact details or links", () => {
  assert.doesNotMatch(rawText, /@|https?:|www\./i);
  assert.doesNotMatch(rawText, /\b(my name|teacher|mrs?\.|ms\.|grade\s*\d+)\b/i);
});

test("parseStudySet rejects extra keys and bad answers", () => {
  assert.throws(() => parseStudySet({ ...set, owner: "x" }));
  assert.throws(() =>
    parseStudySet({ ...set, quiz: [{ q: "x", choices: ["a", "b"], answer: 2 }] }),
  );
  assert.throws(() => parseStudySet({ ...set, cards: [{ cat: "a", q: "b" }] }));
});

test("got it removes a card and study again sends it to the back", () => {
  let s = newSession(set.cards, v);
  const first = current(s);
  s = markAgain(s);
  assert.equal(s.queue.at(-1), first);
  assert.deepEqual(s.again, [first]);
  assert.equal(s.queue.length, 79);
  const second = current(s);
  s = markKnown(s);
  assert.deepEqual(s.known, [second]);
  assert.equal(s.queue.length, 78);
  assert.ok(!s.queue.includes(second as number));
});

test("missed cards come back around until marked got it", () => {
  let s = newSession(set.cards, v, "Hormones");
  assert.equal(s.queue.length, 2);
  const [a, b] = s.queue;
  s = markAgain(s);
  assert.equal(current(s), b);
  assert.equal(studyAgainCount(s), 1);
  s = markKnown(s);
  assert.equal(current(s), a);
  s = markKnown(s);
  assert.equal(current(s), null);
  assert.equal(studyAgainCount(s), 0);
  assert.deepEqual(s.again, [a]);
  s = retryMissed(s);
  assert.deepEqual(s.queue, [a]);
  assert.deepEqual(s.known, []);
});

test("study again on the last slot wraps to the start", () => {
  let s = newSession(set.cards, v, "Hormones");
  s = move(s, 1);
  const last = current(s);
  s = markAgain(s);
  assert.equal(s.pos, 0);
  assert.equal(s.queue.at(-1), last);
  assert.equal(s.queue.length, 2);
});

test("move wraps and category filter limits the pool", () => {
  let s = newSession(set.cards, v, "Joints");
  assert.equal(s.queue.length, 9);
  assert.ok(s.queue.every((i) => set.cards[i].cat === "Joints"));
  s = move(s, -1);
  assert.equal(s.pos, 8);
  s = move(s, 1);
  assert.equal(s.pos, 0);
  assert.equal(newSession(set.cards, v, ALL).queue.length, 79);
});

test("shuffle keeps the same cards", () => {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const s = shuffleQueue(newSession(set.cards, v), random);
  assert.equal(s.shuffled, true);
  assert.notDeepEqual(s.queue, newSession(set.cards, v).queue);
  assert.deepEqual([...s.queue].sort((x, y) => x - y), newSession(set.cards, v).queue);
});

test("saved progress is restored only when it matches this deck", () => {
  const s = markKnown(newSession(set.cards, v));
  assert.deepEqual(restoreSession(JSON.stringify(s), set.cards, v), s);
  assert.equal(restoreSession(JSON.stringify(s), set.cards, "other"), null);
  assert.equal(restoreSession("{not json", set.cards, v), null);
  assert.equal(restoreSession(JSON.stringify({ ...s, queue: [999] }), set.cards, v), null);
  assert.equal(restoreSession(JSON.stringify({ ...s, cat: "Nope" }), set.cards, v), null);
  assert.equal(restoreSession(null, set.cards, v), null);
  const joints = newSession(set.cards, v, "Joints");
  const other = set.cards.findIndex((card) => card.cat !== "Joints");
  assert.equal(restoreSession(JSON.stringify({ ...joints, again: [other] }), set.cards, v), null);
  assert.equal(restoreSession(JSON.stringify({ ...joints, known: [joints.queue[0]] }), set.cards, v), null);
  assert.ok(restoreSession(JSON.stringify(joints), set.cards, v));
});

test("quiz score lists missed questions", () => {
  const picks = set.quiz.map((item) => item.answer) as Array<number | null>;
  assert.deepEqual(scoreQuiz(set.quiz, picks), { score: 10, total: 10, missed: [] });
  picks[2] = (set.quiz[2].answer + 1) % set.quiz[2].choices.length;
  picks[5] = null;
  assert.deepEqual(scoreQuiz(set.quiz, picks), { score: 8, total: 10, missed: [2, 5] });
});

test("serialized set cannot close the attribute's markup", () => {
  const out = serializeStudySet({ ...set, cards: [{ cat: "a", q: "</section><b>", a: "x" }] });
  assert.ok(!out.includes("<"));
});

test("study page is noindex and not linked from the homepage", async () => {
  const page = await readFile(new URL("src/pages/study/skeletal-system.astro", root), "utf8");
  assert.match(page, /\bnoindex\b/);
  const layout = await readFile(new URL("src/layouts/Layout.astro", root), "utf8");
  assert.match(layout, /isPrivate && <meta name="robots" content="noindex,nofollow,noarchive"/);
  assert.match(layout, /!isPrivate && <link rel="canonical"/);
  for (const file of ["src/pages/index.astro", "src/layouts/Layout.astro"]) {
    const source = await readFile(new URL(file, root), "utf8");
    assert.doesNotMatch(source, /\/study/, file);
  }
});
