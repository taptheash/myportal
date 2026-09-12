// Small shared helpers for reading/writing the SAME localStorage keys the
// main widget system already uses (App.tsx's `pw6` key holds every widget's
// config, keyed by type). Home-section modules like Scratchpad need to push
// a note into Tasks/Notes or read Tasks' due dates WITHOUT going through
// props (Home renders independently of whichever Tools tab happens to be
// active) — so they read/write `pw6` directly, the same way useLocalStorage
// does, rather than introducing any second storage system.

const WIDGETS_KEY = 'pw6';

interface WidgetInstance {
  id: string;
  type: string;
  title: string;
  config: Record<string, any>;
}

function readWidgets(): WidgetInstance[] {
  try {
    const raw = window.localStorage.getItem(WIDGETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeWidgets(widgets: WidgetInstance[]) {
  try {
    window.localStorage.setItem(WIDGETS_KEY, JSON.stringify(widgets));
  } catch {
    // localStorage full — not fatal
  }
}

export function getWidgetConfig(type: string): Record<string, any> {
  return readWidgets().find((w) => w.type === type)?.config || {};
}

// Merges into whatever the widget's config already is — never blind-replaces,
// so a write from Home can't clobber unrelated fields a widget stores.
export function updateWidgetConfig(type: string, patch: Record<string, any>) {
  const widgets = readWidgets();
  const idx = widgets.findIndex((w) => w.type === type);
  if (idx >= 0) {
    widgets[idx] = { ...widgets[idx], config: { ...widgets[idx].config, ...patch } };
  } else {
    widgets.push({ id: type, type, title: type, config: patch });
  }
  writeWidgets(widgets);
}
