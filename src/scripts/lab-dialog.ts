import {
  isLabSlug,
  LAB_NAMES,
  labPath,
  readLabParam,
  tabDestination,
  type LabSlug,
} from "../lib/labs";
import { lockBackgroundScroll, releaseBackgroundScroll } from "./scroll-lock";

const FOCUSABLE =
  'a[href], button:not([disabled]), iframe, input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function mountLabDialog(doc: Document = document, win: Window = window): void {
  const dialog = doc.getElementById("lab-dialog");
  if (!(dialog instanceof HTMLDialogElement)) return;
  const frame = dialog.querySelector(".lab-dialog-frame");
  const title = dialog.querySelector("#lab-dialog-title");
  const page = dialog.querySelector(".lab-dialog-page");
  const closeBtn = dialog.querySelector(".lab-dialog-close");
  if (
    !(frame instanceof HTMLIFrameElement) ||
    !(title instanceof HTMLElement) ||
    !(page instanceof HTMLAnchorElement) ||
    !(closeBtn instanceof HTMLButtonElement)
  ) {
    return;
  }
  const modal = dialog;
  const frameEl = frame;
  const titleEl = title;
  const pageEl = page;
  const closeEl = closeBtn;

  const buttons = [
    ...doc.querySelectorAll<HTMLButtonElement>("button[data-lab]"),
  ];
  let lockedY = 0;
  let pushed = false;
  let handlingPop = false;
  let closing = false;
  let returnFocus: HTMLElement | null = null;

  function focusables(): HTMLElement[] {
    return [...modal.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true",
    );
  }

  function setExpanded(slug: LabSlug | null): void {
    for (const button of buttons) {
      button.setAttribute("aria-expanded", button.dataset.lab === slug ? "true" : "false");
    }
  }

  function writeParam(slug: string | null, mode: "push" | "replace"): void {
    const url = new URL(win.location.href);
    if (slug) url.searchParams.set("lab", slug);
    else url.searchParams.delete("lab");
    const next = `${url.pathname}${url.search}${url.hash}`;
    const state = { lab: slug };
    if (mode === "push") win.history.pushState(state, "", next);
    else win.history.replaceState(state, "", next);
  }

  function openLab(slug: LabSlug, historyMode: "push" | "replace" | "none"): void {
    const button = buttons.find((item) => item.dataset.lab === slug);
    const name = button?.dataset.labName || LAB_NAMES[slug];
    titleEl.textContent = name;
    pageEl.href = labPath(slug);
    pageEl.textContent = "Full page";
    pageEl.setAttribute("aria-label", `${name} on its own page`);
    frameEl.title = `${name} simulation`;
    const src = labPath(slug);
    if (frameEl.getAttribute("src") !== src) frameEl.src = src;
    if (!modal.open) {
      const active = doc.activeElement;
      returnFocus =
        active instanceof HTMLElement && active !== doc.body && active !== doc.documentElement
          ? active
          : button ?? null;
      lockedY = lockBackgroundScroll(doc, win);
      if (typeof modal.showModal === "function") modal.showModal();
      else modal.setAttribute("open", "");
    }
    setExpanded(slug);
    closeEl.focus({ preventScroll: true });
    if (historyMode === "push" && readLabParam(win.location.search) !== slug) {
      writeParam(slug, "push");
      pushed = true;
    } else if (historyMode === "replace") {
      writeParam(slug, "replace");
    }
  }

  function requestClose(): void {
    if (!modal.open || closing) return;
    closing = true;
    if (pushed) {
      pushed = false;
      win.history.back();
      return;
    }
    modal.close();
  }

  function onDialogClose(): void {
    closing = false;
    pushed = false;
    frameEl.src = "about:blank";
    releaseBackgroundScroll(doc, win, lockedY);
    setExpanded(null);
    if (!handlingPop && readLabParam(win.location.search)) writeParam(null, "replace");
    const back = returnFocus;
    returnFocus = null;
    back?.focus({ preventScroll: true });
  }

  for (const button of buttons) {
    button.addEventListener("click", () => {
      const slug = button.dataset.lab;
      if (!isLabSlug(slug)) return;
      openLab(slug, "push");
    });
  }

  closeEl.addEventListener("click", () => requestClose());

  modal.addEventListener("click", (event) => {
    if (event.target === modal) requestClose();
  });

  modal.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestClose();
  });

  modal.addEventListener("close", onDialogClose);

  modal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      requestClose();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusables();
    const active = doc.activeElement;
    const index = active instanceof HTMLElement ? items.indexOf(active) : -1;
    const next = tabDestination(items.length, index, event.shiftKey);
    if (next === null) return;
    event.preventDefault();
    items[next]?.focus();
  });

  frameEl.addEventListener("load", () => {
    let child: Document | null = null;
    try {
      child = frameEl.contentDocument;
    } catch {
      return;
    }
    if (!child) return;
    child.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      requestClose();
    });
  });

  win.addEventListener("popstate", () => {
    closing = false;
    handlingPop = true;
    try {
      const slug = readLabParam(win.location.search);
      if (slug) openLab(slug, "none");
      else if (modal.open) modal.close();
    } finally {
      handlingPop = false;
    }
  });

  const raw = new URL(win.location.href).searchParams.get("lab");
  if (raw && !isLabSlug(raw)) writeParam(null, "replace");
  else if (isLabSlug(raw)) openLab(raw, "none");
}
