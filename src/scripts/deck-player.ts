interface Flashcard {
  front: string;
  back: string;
}

function shuffle(indices: number[]): number[] {
  const next = indices.slice();
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = next[i];
    next[i] = next[j];
    next[j] = current;
  }
  return next;
}

function sameOrder(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function isCard(value: unknown): value is Flashcard {
  if (typeof value !== "object" || value === null) return false;
  const card = value as Record<string, unknown>;
  return typeof card.front === "string" && typeof card.back === "string";
}

export function mountDeckPlayer(root: HTMLElement): void {
  if (root.dataset.mounted === "true") return;

  const raw = root.dataset.cards;
  if (!raw) return;

  let cards: Flashcard[];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isCard)) return;
    cards = parsed;
  } catch {
    return;
  }
  if (cards.length === 0) return;

  root.dataset.mounted = "true";

  const cardButton = root.querySelector<HTMLButtonElement>("[data-card]");
  const frontText = root.querySelector<HTMLElement>("[data-front]");
  const backText = root.querySelector<HTMLElement>("[data-back]");
  const frontFace = root.querySelector<HTMLElement>("[data-face='front']");
  const backFace = root.querySelector<HTMLElement>("[data-face='back']");
  const counter = root.querySelector<HTMLElement>("[data-counter]");
  const progress = root.querySelector<HTMLElement>("[data-progress]");
  const fill = root.querySelector<HTMLElement>("[data-progress-fill]");
  const prev = root.querySelector<HTMLButtonElement>("[data-prev]");
  const next = root.querySelector<HTMLButtonElement>("[data-next]");
  const shuffleButton = root.querySelector<HTMLButtonElement>("[data-shuffle]");

  if (
    !cardButton ||
    !frontText ||
    !backText ||
    !frontFace ||
    !backFace ||
    !counter ||
    !progress ||
    !fill ||
    !prev ||
    !next ||
    !shuffleButton
  ) {
    return;
  }

  let order = cards.map((_, index) => index);
  let index = 0;
  let flipped = false;

  const render = () => {
    const card = cards[order[index]];
    const position = index + 1;
    const total = order.length;
    const label = `Card ${position} of ${total}`;

    frontText.textContent = card.front;
    backText.textContent = card.back;
    cardButton.classList.toggle("is-flipped", flipped);
    cardButton.setAttribute("aria-pressed", flipped ? "true" : "false");
    frontFace.setAttribute("aria-hidden", flipped ? "true" : "false");
    backFace.setAttribute("aria-hidden", flipped ? "false" : "true");
    cardButton.setAttribute(
      "aria-label",
      flipped ? `${card.back}. Answer. Activate to flip.` : `${card.front}. Question. Activate to flip.`,
    );
    counter.textContent = label;
    progress.setAttribute("aria-valuenow", String(position));
    progress.setAttribute("aria-valuemax", String(total));
    progress.setAttribute("aria-valuetext", label);
    fill.style.width = `${(position / total) * 100}%`;
    prev.disabled = index === 0;
    next.disabled = index === total - 1;
  };

  const show = (nextIndex: number) => {
    index = nextIndex;
    flipped = false;
    render();
  };

  cardButton.addEventListener("click", () => {
    flipped = !flipped;
    render();
  });

  prev.addEventListener("click", () => {
    if (index > 0) show(index - 1);
  });

  next.addEventListener("click", () => {
    if (index < order.length - 1) show(index + 1);
  });

  shuffleButton.addEventListener("click", () => {
    const shuffled = shuffle(order);
    order = order.length > 1 && sameOrder(shuffled, order) ? shuffle(order) : shuffled;
    show(0);
  });

  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || isEditable(event.target)) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (index > 0) show(index - 1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (index < order.length - 1) show(index + 1);
      return;
    }

    if (event.key === " " || event.code === "Space") {
      if (event.repeat) return;
      event.preventDefault();
      flipped = !flipped;
      render();
    }
  });

  render();
}
