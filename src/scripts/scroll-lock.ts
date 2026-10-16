const pendingRelease = new WeakMap<Window, number>();
const pendingTimer = new WeakMap<Window, number>();

function cancelPendingRelease(win: Window): void {
  const frame = pendingRelease.get(win);
  if (frame !== undefined) {
    pendingRelease.delete(win);
    if (typeof win.cancelAnimationFrame === "function") win.cancelAnimationFrame(frame);
  }
  const timer = pendingTimer.get(win);
  if (timer !== undefined) {
    pendingTimer.delete(win);
    if (typeof win.clearTimeout === "function") win.clearTimeout(timer);
  }
}

/**
 * Pin the page without `overflow: hidden`.
 * iOS Safari leaves the document unscrollable after a modal if that inline
 * style was applied to `body` (including by `dialog.showModal`) and then
 * removed. Position + a saved scroll offset is the lock we can actually undo.
 */
export function lockBackgroundScroll(doc: Document, win: Window): number {
  cancelPendingRelease(win);
  const y = win.scrollY;
  const bar = Math.max(0, win.innerWidth - doc.documentElement.clientWidth);
  const body = doc.body;
  body.style.position = "fixed";
  body.style.top = `-${y}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.paddingRight = bar > 0 ? `${bar}px` : "";
  return y;
}

/** Drop the pin and any leftover overflow lock, then put the viewport back. */
export function releaseBackgroundScroll(doc: Document, win: Window, y: number): void {
  const body = doc.body;
  const root = doc.documentElement;
  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.width = "";
  body.style.paddingRight = "";
  clearOverflowLock(body, root);
  win.scrollTo(0, y);
  // showModal() can reapply the overflow lock after `close` returns.
  const again = () => {
    clearOverflowLock(body, root);
    if (body.style.position === "fixed") {
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
    }
    win.scrollTo(0, y);
  };
  if (typeof win.requestAnimationFrame === "function") {
    const id = win.requestAnimationFrame(() => {
      pendingRelease.delete(win);
      again();
    });
    pendingRelease.set(win, id);
  } else {
    again();
  }
  if (typeof win.setTimeout === "function") {
    const timer = win.setTimeout(() => {
      pendingTimer.delete(win);
      again();
    }, 0);
    pendingTimer.set(win, Number(timer));
  }
}

function clearOverflowLock(body: HTMLElement, root: HTMLElement): void {
  // Assign a scrollable value first. iOS keeps the lock if the inline style
  // is only removed, until layout runs.
  body.style.overflow = "visible";
  root.style.overflow = "visible";
  void body.offsetHeight;
  body.style.overflow = "";
  root.style.overflow = "";
}
