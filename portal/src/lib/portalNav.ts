// Lets a widget send you somewhere else in the portal and point at one item
// there. Used by the Notes <-> Tasks links: App.tsx listens for the event
// and switches section/tab, and the destination widget calls takeHighlight()
// when it mounts to scroll to that item and flash it.

let pendingHighlight: string | null = null;

export function navigateTo(section: string, tool?: string, highlightId?: string) {
  pendingHighlight = highlightId ?? null;
  window.dispatchEvent(new CustomEvent('portal-navigate', { detail: { section, tool } }));
}

// Returns (and clears) the id the last navigateTo asked to highlight.
export function takeHighlight(): string | null {
  const id = pendingHighlight;
  pendingHighlight = null;
  return id;
}

// Scrolls to [data-item-id="<id>"] and briefly rings it. Waits a frame so
// the destination widget has rendered.
export function flashItem(id: string) {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-indigo-400', 'rounded-lg');
    setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-400', 'rounded-lg'), 2000);
  });
}

// Pulls a task out of a note line: strips bullets and numbering
// (-, *, •, 1., 1)) and checkbox marks; "[x]" means already done.
export function lineToTask(line: string): { text: string; done: boolean } | null {
  let text = line.trim();
  if (!text) return null;
  let done = false;
  const box = text.match(/^\[( |x|X)?\]\s*/);
  text = text.replace(/^(?:[-*•]|\d+[.)])\s+/, '');
  const box2 = text.match(/^\[( |x|X)?\]\s*/);
  const m = box || box2;
  if (m) {
    done = /x/i.test(m[1] || '');
    text = text.replace(/^\[( |x|X)?\]\s*/, '');
  }
  text = text.trim();
  return text ? { text, done } : null;
}
