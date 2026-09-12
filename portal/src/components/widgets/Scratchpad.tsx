import React, { useState, useEffect, useRef } from 'react';
import { StickyNote, ListChecks, Trash2, Check } from 'lucide-react';
import { getWidgetConfig, updateWidgetConfig } from '../../lib/portalStorage';

// A single, lightweight jot-it-down box for Home — deliberately NOT another
// full Notes/Tasks widget. Autosaves as you type (debounced), and offers two
// one-click destinations: file the whole thing as a new Note, or as a new
// Task. Either action clears the pad. This is the "quick capture" surface
// Doug's spec asked for — everything else (organizing, checking off,
// due dates) still happens in the real Tasks/Notes tabs.

const STORAGE_KEY = 'pw6-scratchpad';

export default function Scratchpad() {
  const [text, setText] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [savedFlash, setSavedFlash] = useState<'note' | 'task' | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, text);
      } catch {
        // full localStorage — not fatal, just won't persist this keystroke
      }
    }, 400);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [text]);

  const clear = () => setText('');

  const flash = (kind: 'note' | 'task') => {
    setSavedFlash(kind);
    setTimeout(() => setSavedFlash(null), 1500);
  };

  // Saves into the SAME FreeformNotes config the Notes tab reads — appends a
  // new note titled from the pad's first line, rather than opening any
  // separate storage.
  const saveToNotes = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const config = getWidgetConfig('notes');
    const firstLine = trimmed.split('\n')[0].slice(0, 60) || 'Untitled';
    const newNote = { id: Date.now().toString(), title: firstLine, text: trimmed, collapsed: false };
    updateWidgetConfig('notes', { notes: [...(config.notes || []), newNote] });
    clear();
    flash('note');
  };

  // Converts into a new list under Tasks — one list item per non-empty line,
  // filed under a single new list named from the pad's first line (or
  // "Quick tasks" if the pad is only one line).
  const saveToTasks = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const config = getWidgetConfig('tasks');
    const title = lines.length > 1 ? (lines[0].length <= 40 ? lines[0] : 'Quick tasks') : 'Quick tasks';
    const items = (lines.length > 1 ? lines.slice(1) : lines).map((l, i) => ({
      id: `${Date.now()}-${i}`,
      text: l,
      done: false,
    }));
    const newList = { id: Date.now().toString(), title, items, collapsed: false };
    updateWidgetConfig('tasks', { notes: [...(config.notes || []), newList] });
    clear();
    flash('task');
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Jot something down…"
        rows={4}
        className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y"
      />
      <div className="flex items-center gap-1.5">
        <button
          onClick={saveToNotes}
          disabled={!text.trim()}
          className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
        >
          {savedFlash === 'note' ? <Check size={13} /> : <StickyNote size={13} />}
          {savedFlash === 'note' ? 'Saved' : 'Save to Notes'}
        </button>
        <button
          onClick={saveToTasks}
          disabled={!text.trim()}
          className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
        >
          {savedFlash === 'task' ? <Check size={13} /> : <ListChecks size={13} />}
          {savedFlash === 'task' ? 'Added' : 'Convert to Task'}
        </button>
        <button
          onClick={clear}
          disabled={!text.trim()}
          title="Clear"
          className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
