export interface Flashcard {
  front: string;
  back: string;
}

export interface Deck {
  id: string;
  title: string;
  course: string;
  cards: Flashcard[];
}

interface DeckModule {
  default: unknown;
}

const deckModules = import.meta.glob<DeckModule>("../data/decks/*.json", {
  eager: true,
});

const DECK_KEYS = ["cards", "course", "id", "title"] as const;
const CARD_KEYS = ["back", "front"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function parseDeck(raw: unknown, source: string): Deck {
  if (!isRecord(raw) || !sameKeys(raw, DECK_KEYS)) {
    throw new Error(`${source} must contain only id, title, course, and cards`);
  }

  const { id, title, course, cards } = raw;
  if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`${source} has an invalid id`);
  }
  if (typeof title !== "string" || title.trim() === "") {
    throw new Error(`${source} needs a title`);
  }
  if (typeof course !== "string" || course.trim() === "") {
    throw new Error(`${source} needs a course`);
  }
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new Error(`${source} needs at least one card`);
  }

  const parsedCards = cards.map((card, index) => {
    if (!isRecord(card) || !sameKeys(card, CARD_KEYS)) {
      throw new Error(`${source} card ${index + 1} must contain only front and back`);
    }
    if (typeof card.front !== "string" || card.front.trim() === "") {
      throw new Error(`${source} card ${index + 1} needs a front`);
    }
    if (typeof card.back !== "string" || card.back.trim() === "") {
      throw new Error(`${source} card ${index + 1} needs a back`);
    }
    return { front: card.front, back: card.back };
  });

  return { id, title, course, cards: parsedCards };
}

let cached: Deck[] | null = null;

export function getDecks(): Deck[] {
  if (cached) return cached;

  const decks: Deck[] = [];
  const seen = new Set<string>();
  for (const [source, mod] of Object.entries(deckModules)) {
    const deck = parseDeck(mod.default, source);
    if (seen.has(deck.id)) {
      throw new Error(`Duplicate deck id "${deck.id}"`);
    }
    seen.add(deck.id);
    decks.push(deck);
  }

  decks.sort((a, b) => a.title.localeCompare(b.title, "en"));
  cached = decks;
  return decks;
}

/** JSON for a data attribute. Angle brackets stay escaped so card text cannot break markup. */
export function serializeCards(cards: Flashcard[]): string {
  return JSON.stringify(cards).replace(/</g, "\\u003c");
}
