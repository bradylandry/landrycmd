/**
 * Study sets: flash cards with categories plus a short multiple choice quiz.
 * Pure logic only, so the browser player and the tests share it.
 */

export interface StudyCard {
  cat: string;
  q: string;
  a: string;
}

export interface QuizQuestion {
  q: string;
  choices: string[];
  answer: number;
}

export interface StudySet {
  id: string;
  title: string;
  subtitle: string;
  cards: StudyCard[];
  quiz: QuizQuestion[];
}

export const ALL = "all";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  const want = [...expected].sort();
  return keys.length === want.length && keys.every((key, index) => key === want[index]);
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export function parseStudySet(raw: unknown, source = "study set"): StudySet {
  if (!isRecord(raw) || !sameKeys(raw, ["id", "title", "subtitle", "cards", "quiz"])) {
    throw new Error(`${source} must contain only id, title, subtitle, cards, and quiz`);
  }
  const { id, title, subtitle, cards, quiz } = raw;
  if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`${source} has an invalid id`);
  }
  if (!text(title) || !text(subtitle)) throw new Error(`${source} needs a title and subtitle`);
  if (!Array.isArray(cards) || cards.length === 0) throw new Error(`${source} needs cards`);
  if (!Array.isArray(quiz)) throw new Error(`${source} needs a quiz list`);

  const parsedCards = cards.map((card, index) => {
    if (!isRecord(card) || !sameKeys(card, ["cat", "q", "a"])) {
      throw new Error(`${source} card ${index + 1} must contain only cat, q, and a`);
    }
    if (!text(card.cat) || !text(card.q) || !text(card.a)) {
      throw new Error(`${source} card ${index + 1} has an empty field`);
    }
    return { cat: card.cat, q: card.q, a: card.a };
  });

  const parsedQuiz = quiz.map((item, index) => {
    if (!isRecord(item) || !sameKeys(item, ["q", "choices", "answer"])) {
      throw new Error(`${source} quiz ${index + 1} must contain only q, choices, and answer`);
    }
    const { q, choices, answer } = item;
    if (!text(q)) throw new Error(`${source} quiz ${index + 1} needs a question`);
    if (!Array.isArray(choices) || choices.length < 2 || !choices.every(text)) {
      throw new Error(`${source} quiz ${index + 1} needs at least two choices`);
    }
    if (typeof answer !== "number" || !Number.isInteger(answer) || answer < 0 || answer >= choices.length) {
      throw new Error(`${source} quiz ${index + 1} has an answer out of range`);
    }
    return { q, choices: choices as string[], answer };
  });

  return { id, title, subtitle, cards: parsedCards, quiz: parsedQuiz };
}

/** Categories in first-seen order. */
export function categories(cards: StudyCard[]): string[] {
  const seen: string[] = [];
  for (const card of cards) if (!seen.includes(card.cat)) seen.push(card.cat);
  return seen;
}

/** Short fingerprint so saved progress is dropped if the deck changes. */
export function fingerprint(set: Pick<StudySet, "cards" | "quiz">): string {
  const source = JSON.stringify([set.cards, set.quiz]);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/**
 * Session state. `queue` holds card indices still to study, in order.
 * "Got it" moves a card to `known`. "Study again" sends it to the back of the
 * queue and records it in `again`, so missed cards come back around.
 * `again` is the history of cards missed this session. The live Study again
 * pile is the part of it still in the queue (see studyAgainCount).
 */
export interface Session {
  v: string;
  cat: string;
  queue: number[];
  pos: number;
  known: number[];
  again: number[];
  shuffled: boolean;
}

export function cardsInCategory(cards: StudyCard[], cat: string): number[] {
  return cards.flatMap((card, index) => (cat === ALL || card.cat === cat ? [index] : []));
}

export function newSession(cards: StudyCard[], v: string, cat = ALL, shuffle = false, random?: () => number): Session {
  const pool = cardsInCategory(cards, cat);
  return {
    v,
    cat,
    queue: shuffle ? shuffled(pool, random) : pool,
    pos: 0,
    known: [],
    again: [],
    shuffled: shuffle,
  };
}

function clampPos(session: Session): Session {
  const max = Math.max(0, session.queue.length - 1);
  return { ...session, pos: Math.min(Math.max(0, session.pos), max) };
}

/** Cards marked Study again that have not been marked Got it since. */
export function studyAgainCount(session: Session): number {
  return session.again.filter((card) => session.queue.includes(card)).length;
}

export function current(session: Session): number | null {
  return session.queue.length ? session.queue[session.pos] : null;
}

export function move(session: Session, step: number): Session {
  if (session.queue.length === 0) return session;
  const len = session.queue.length;
  return { ...session, pos: (session.pos + step + len) % len };
}

export function markKnown(session: Session): Session {
  const card = current(session);
  if (card === null) return session;
  const queue = session.queue.filter((_, i) => i !== session.pos);
  const known = session.known.includes(card) ? session.known : [...session.known, card];
  const next = { ...session, queue, known, pos: session.pos >= queue.length ? 0 : session.pos };
  return clampPos(next);
}

export function markAgain(session: Session): Session {
  const card = current(session);
  if (card === null) return session;
  const rest = session.queue.filter((_, i) => i !== session.pos);
  const queue = [...rest, card];
  const again = session.again.includes(card) ? session.again : [...session.again, card];
  // The next card slides into this slot. If this was the last slot, wrap to the start.
  const pos = session.pos >= rest.length ? 0 : session.pos;
  return clampPos({ ...session, queue, again, pos });
}

export function shuffleQueue(session: Session, random?: () => number): Session {
  return { ...session, queue: shuffled(session.queue, random), pos: 0, shuffled: true };
}

/** Restart with only the cards marked "Study again" in this session. */
export function retryMissed(session: Session, random?: () => number): Session {
  const missed = session.again.slice();
  return {
    ...session,
    queue: session.shuffled ? shuffled(missed, random) : missed.sort((a, b) => a - b),
    pos: 0,
    known: [],
    again: [],
  };
}

/** Accepts saved JSON only when it matches this deck and every index is valid. */
export function restoreSession(raw: string | null, cards: StudyCard[], v: string): Session | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.v !== v) return null;
  const { cat, queue, pos, known, again, shuffled: wasShuffled } = value;
  const cats = categories(cards);
  if (typeof cat !== "string" || (cat !== ALL && !cats.includes(cat))) return null;
  const valid = (list: unknown): list is number[] =>
    Array.isArray(list) &&
    list.every((n) => Number.isInteger(n) && n >= 0 && n < cards.length) &&
    new Set(list).size === list.length;
  if (!valid(queue) || !valid(known) || !valid(again)) return null;
  if (queue.some((card) => known.includes(card))) return null;
  if (cat !== ALL && [...queue, ...known, ...again].some((card) => cards[card].cat !== cat)) return null;
  if (typeof pos !== "number" || !Number.isInteger(pos)) return null;
  return clampPos({ v, cat, queue, pos, known, again, shuffled: wasShuffled === true });
}

export interface QuizResult {
  score: number;
  total: number;
  missed: number[];
}

export function scoreQuiz(quiz: QuizQuestion[], picks: Array<number | null>): QuizResult {
  const missed: number[] = [];
  quiz.forEach((item, index) => {
    if (picks[index] !== item.answer) missed.push(index);
  });
  return { score: quiz.length - missed.length, total: quiz.length, missed };
}

/** JSON for a data attribute. Angle brackets stay escaped so text cannot break markup. */
export function serializeStudySet(set: StudySet): string {
  return JSON.stringify(set).replace(/</g, "\\u003c");
}
