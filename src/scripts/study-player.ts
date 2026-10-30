import {
  ALL,
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
  shuffleQueue,
  studyAgainCount,
  type Session,
  type StudySet,
} from "../lib/study";

const SWIPE_PX = 50;
const TAP_PX = 10;

function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or storage full. Studying still works, it just won't be saved.
  }
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function el<T extends HTMLElement>(root: HTMLElement, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`study page is missing ${selector}`);
  return found;
}

export function mountStudy(root: HTMLElement): void {
  if (root.dataset.mounted === "true" || !root.dataset.set) return;

  let set: StudySet;
  try {
    set = parseStudySet(JSON.parse(root.dataset.set));
  } catch {
    return;
  }
  root.dataset.mounted = "true";

  const v = fingerprint(set);
  const key = `study:${set.id}`;

  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-tab]"));
  const panels = Array.from(root.querySelectorAll<HTMLElement>("[data-panel]"));
  const catSelect = el<HTMLSelectElement>(root, "[data-cat]");
  const stats = el(root, "[data-stats]");
  const fill = el(root, "[data-fill]");
  const deck = el(root, "[data-deck]");
  const counter = el(root, "[data-counter]");
  const cardButton = el<HTMLButtonElement>(root, "[data-card]");
  const catLabel = el(root, "[data-cat-label]");
  const frontText = el(root, "[data-front]");
  const backText = el(root, "[data-back]");
  const frontFace = el(root, "[data-face='front']");
  const backFace = el(root, "[data-face='back']");
  const prev = el<HTMLButtonElement>(root, "[data-prev]");
  const next = el<HTMLButtonElement>(root, "[data-next]");
  const again = el<HTMLButtonElement>(root, "[data-again]");
  const known = el<HTMLButtonElement>(root, "[data-known]");
  const done = el(root, "[data-done]");
  const doneHeading = el(root, "[data-done-heading]");
  const doneText = el(root, "[data-done-text]");
  const retry = el<HTMLButtonElement>(root, "[data-retry]");
  const shuffleButton = el<HTMLButtonElement>(root, "[data-shuffle]");
  const reset = el<HTMLButtonElement>(root, "[data-reset]");

  const saved = storageGet(key);
  let session: Session = restoreSession(saved, set.cards, v) ?? newSession(set.cards, v);
  let flipped = false;
  catSelect.value = session.cat;

  const save = () => storageSet(key, JSON.stringify(session));

  const render = () => {
    const pool = session.queue.length + session.known.length;
    const card = current(session);
    const statsText = `Got it ${session.known.length} of ${pool} · Study again ${studyAgainCount(session)}`;
    // aria-live: only touch it when the counts change, not on every flip.
    if (stats.textContent !== statsText) stats.textContent = statsText;
    fill.style.width = pool ? `${(session.known.length / pool) * 100}%` : "0%";

    if (card === null) {
      deck.hidden = true;
      done.hidden = false;
      const missed = session.again.length;
      doneText.textContent = missed
        ? `You got through every card. You missed ${missed} along the way.`
        : "You got every card in this set.";
      retry.hidden = missed === 0;
      return;
    }

    deck.hidden = false;
    done.hidden = true;
    const item = set.cards[card];
    counter.textContent = `Card ${session.pos + 1} of ${session.queue.length} left${
      session.again.includes(card) ? " · missed before" : ""
    }`;
    catLabel.textContent = item.cat;
    frontText.textContent = item.q;
    backText.textContent = item.a;
    cardButton.classList.toggle("is-flipped", flipped);
    cardButton.setAttribute("aria-pressed", flipped ? "true" : "false");
    frontFace.setAttribute("aria-hidden", flipped ? "true" : "false");
    backFace.setAttribute("aria-hidden", flipped ? "false" : "true");
    cardButton.setAttribute(
      "aria-label",
      flipped ? `Answer: ${item.a}. Tap to flip back.` : `${item.cat}. ${item.q} Tap to show the answer.`,
    );
    const single = session.queue.length < 2;
    prev.disabled = single;
    next.disabled = single;
  };

  // Called only from user actions, so focus never jumps on page load.
  const update = (nextSession: Session) => {
    const hadCard = current(session) !== null;
    session = nextSession;
    flipped = false;
    save();
    render();
    const hasCard = current(session) !== null;
    if (hadCard && !hasCard) doneHeading.focus();
    else if (hasCard && (!hadCard || (document.activeElement instanceof HTMLButtonElement && document.activeElement.disabled))) {
      cardButton.focus();
    }
  };

  const flip = () => {
    flipped = !flipped;
    render();
  };

  // Touch: a short tap flips and a horizontal swipe moves. Both are handled on
  // touchend, which cancels the browser's synthetic click so one gesture never
  // counts twice. Mouse and keyboard still use the button's click.
  let startX = 0;
  let startY = 0;
  let tracking = false;
  cardButton.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 1) {
        tracking = false;
        return;
      }
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    },
    { passive: true },
  );
  cardButton.addEventListener("touchcancel", () => {
    tracking = false;
  });
  cardButton.addEventListener(
    "touchend",
    (event) => {
      if (!tracking) return;
      tracking = false;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) < TAP_PX && Math.abs(dy) < TAP_PX) {
        // If the browser will not let us cancel the click, let the click flip it.
        if (!event.cancelable) return;
        event.preventDefault();
        flip();
      } else if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
        // Past the tap distance the browser sends no click, so there is nothing to cancel.
        if (event.cancelable) event.preventDefault();
        if (session.queue.length > 1) update(move(session, dx < 0 ? 1 : -1));
      }
    },
    { passive: false },
  );
  cardButton.addEventListener("click", flip);

  prev.addEventListener("click", () => update(move(session, -1)));
  next.addEventListener("click", () => update(move(session, 1)));
  known.addEventListener("click", () => update(markKnown(session)));
  again.addEventListener("click", () => update(markAgain(session)));
  retry.addEventListener("click", () => update(retryMissed(session)));
  shuffleButton.addEventListener("click", () => update(shuffleQueue(session)));
  // Start over also puts the cards back in deck order.
  reset.addEventListener("click", () => update(newSession(set.cards, v, session.cat)));
  catSelect.addEventListener("change", () => {
    const cat = catSelect.value === ALL || set.cards.some((c) => c.cat === catSelect.value) ? catSelect.value : ALL;
    update(newSession(set.cards, v, cat, session.shuffled));
  });

  const quizRun = el(root, "[data-quiz-run]");
  const quizCounter = el(root, "[data-quiz-counter]");
  const quizQ = el(root, "[data-quiz-q]");
  const quizChoices = el(root, "[data-quiz-choices]");
  const quizFeedback = el(root, "[data-quiz-feedback]");
  const quizNext = el<HTMLButtonElement>(root, "[data-quiz-next]");
  const quizResult = el(root, "[data-quiz-result]");
  const quizScore = el(root, "[data-quiz-score]");
  const quizMissed = el(root, "[data-quiz-missed]");
  const quizRetake = el<HTMLButtonElement>(root, "[data-quiz-retake]");

  let qIndex = 0;
  let picks: Array<number | null> = set.quiz.map(() => null);

  const renderQuestion = () => {
    const item = set.quiz[qIndex];
    const picked = picks[qIndex];
    quizRun.hidden = false;
    quizResult.hidden = true;
    quizCounter.textContent = `Question ${qIndex + 1} of ${set.quiz.length}`;
    quizQ.textContent = item.q;
    quizChoices.replaceChildren(
      ...item.choices.map((choice, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "study-choice";
        button.textContent = choice;
        button.dataset.choice = String(index);
        if (picked !== null) {
          button.disabled = true;
          if (index === item.answer) button.classList.add("is-right");
          else if (index === picked) button.classList.add("is-wrong");
        }
        button.addEventListener("click", () => {
          if (picks[qIndex] !== null) return;
          picks[qIndex] = index;
          renderQuestion();
          quizNext.focus({ preventScroll: true });
        });
        return button;
      }),
    );
    if (picked === null) {
      quizFeedback.textContent = "";
      quizFeedback.className = "study-feedback";
      quizNext.hidden = true;
    } else {
      const right = picked === item.answer;
      quizFeedback.textContent = right ? "Correct." : `Not quite. The answer is ${item.choices[item.answer]}.`;
      quizFeedback.className = `study-feedback ${right ? "is-right" : "is-wrong"}`;
      quizNext.hidden = false;
      quizNext.textContent = qIndex === set.quiz.length - 1 ? "See my score" : "Next question";
    }
  };

  const renderResult = () => {
    const result = scoreQuiz(set.quiz, picks);
    quizRun.hidden = true;
    quizResult.hidden = false;
    quizScore.textContent = `You scored ${result.score} of ${result.total}`;
    if (result.missed.length === 0) {
      const p = document.createElement("p");
      p.textContent = "Perfect score. You missed none.";
      quizMissed.replaceChildren(p);
    } else {
      const heading = document.createElement("p");
      heading.className = "muted";
      heading.textContent = `You missed ${result.missed.length}:`;
      const list = document.createElement("ol");
      list.className = "study-missed";
      for (const index of result.missed) {
        const item = set.quiz[index];
        const li = document.createElement("li");
        const q = document.createElement("p");
        q.className = "study-missed-q";
        q.textContent = `${index + 1}. ${item.q}`;
        const yours = document.createElement("p");
        yours.className = "study-missed-yours";
        const pick = picks[index];
        yours.textContent = `Your answer: ${pick === null ? "none" : item.choices[pick]}`;
        const answer = document.createElement("p");
        answer.className = "study-missed-answer";
        answer.textContent = `Correct answer: ${item.choices[item.answer]}`;
        li.append(q, yours, answer);
        list.append(li);
      }
      quizMissed.replaceChildren(heading, list);
    }
    quizScore.focus({ preventScroll: false });
  };

  quizNext.addEventListener("click", () => {
    if (qIndex < set.quiz.length - 1) {
      qIndex += 1;
      renderQuestion();
    } else {
      renderResult();
    }
  });
  quizRetake.addEventListener("click", () => {
    qIndex = 0;
    picks = set.quiz.map(() => null);
    renderQuestion();
    quizQ.focus();
  });

  const quizTab = tabs.find((tab) => tab.dataset.tab === "quiz");
  if (quizTab && set.quiz.length === 0) quizTab.hidden = true;
  const showTab = (name: string, focus = false) => {
    for (const tab of tabs) {
      const on = tab.dataset.tab === name;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus();
    }
    for (const panel of panels) panel.hidden = panel.dataset.panel !== name;
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => showTab(tab.dataset.tab ?? "cards"));
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const other = tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      showTab(other.dataset.tab ?? "cards", true);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || isEditable(event.target)) return;
    if (deck.hidden || (deck.closest<HTMLElement>("[data-panel]")?.hidden ?? false)) return;
    if (event.target instanceof HTMLElement && event.target.closest("[role='tablist']")) return;
    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && session.queue.length > 1) {
      event.preventDefault();
      update(move(session, event.key === "ArrowLeft" ? -1 : 1));
    } else if ((event.key === " " || event.code === "Space") && event.target === document.body) {
      if (event.repeat) return;
      event.preventDefault();
      flip();
    }
  });

  if (set.quiz.length) renderQuestion();
  render();
}
