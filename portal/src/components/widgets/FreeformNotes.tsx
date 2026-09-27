import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, ChevronDown, ChevronRight, ChevronsDown, ChevronsUp, ListChecks, CornerUpLeft } from 'lucide-react';
import { getWidgetConfig, updateWidgetConfig } from '../../lib/portalStorage';
import { navigateTo, takeHighlight, flashItem, lineToTask } from '../../lib/portalNav';

interface FreeformNotesProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface FreeformNote {
  id: string;
  title: string;
  text: string;
  collapsed: boolean;
  // Set when this note holds the details for a task (Tasks → "Add notes").
  linkedTask?: { listId: string; itemId: string };
}

function migrateNotes(raw: any[]): FreeformNote[] {
  return (raw || []).map((note) => {
    if (typeof note.text === 'string') {
      return { id: note.id, title: note.title, text: note.text, collapsed: note.collapsed ?? false, ...(note.linkedTask ? { linkedTask: note.linkedTask } : {}) };
    }
    const text = (note.items || []).map((item: any) => item.text).join('\n');
    return { id: note.id, title: note.title, text, collapsed: false };
  });
}

function previewOf(text: string): string {
  const firstLine = text.split('\n').find((line) => line.trim().length > 0) || '';
  return firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine;
}

export default function FreeformNotes({ config, onUpdateConfig }: FreeformNotesProps) {
  const [notes, setNotes] = useState<FreeformNote[]>(() => migrateNotes(config.notes));
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [showNewNote, setShowNewNote] = useState(false);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  // This effect also fires once right after mount (every effect does, on the
  // very first render) — without this guard that fires a save-back of
  // whatever `config.notes` happened to look like at mount, which can
  // clobber a more recent write made elsewhere (Home's Scratchpad writes
  // into this same widget's config directly, bypassing props, while Home is
  // showing — see lib/portalStorage.ts). Skipping the mount-triggered save
  // means this component only ever persists a change the user actually made
  // in it.
  const isFirstRender = useRef(true);
  const pendingSaveRef = useRef<(() => void) | null>(null);
  // Latest props, so a flushed/debounced save merges into the CURRENT config
  // rather than the one captured when the edit happened.
  const latestPropsRef = useRef({ config, onUpdateConfig });
  latestPropsRef.current = { config, onUpdateConfig };

  // Tracks the last value WE persisted, as a JSON string (migrateNotes always
  // returns fresh object/array references, so content — not identity — is
  // what has to be compared). Lets the sync effect below tell "config.notes
  // changed because something else wrote it" (Scratchpad, or this same tab
  // reacting to a write made from a second browser tab/window open to Home)
  // apart from "config.notes changed because our own save just round-tripped
  // back down as a new prop" — only the former should update local state.
  const lastPersistedRef = useRef<string>(JSON.stringify(migrateNotes(config.notes)));

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const persist = () => {
      pendingSaveRef.current = null;
      lastPersistedRef.current = JSON.stringify(notes);
      latestPropsRef.current.onUpdateConfig({ ...latestPropsRef.current.config, notes });
    };
    pendingSaveRef.current = persist;
    saveTimer.current = setTimeout(persist, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [notes]);

  // Flush a still-pending debounced save instead of dropping it. Before this,
  // typing and then switching tabs (or closing/reloading the page) within
  // 500ms unmounted the widget, the cleanup above cancelled the timer, and
  // the last edit was silently lost.
  useEffect(() => {
    const flush = () => {
      if (!pendingSaveRef.current) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      pendingSaveRef.current();
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  // Live-adopts an external config.notes change while this widget stays
  // mounted — e.g. Notes open in one tab/window while Scratchpad saves from
  // Home in another — so the note shows up without navigating away and back
  // or reloading the page.
  useEffect(() => {
    const incoming = migrateNotes(config.notes);
    const incomingKey = JSON.stringify(incoming);
    if (incomingKey !== lastPersistedRef.current) {
      lastPersistedRef.current = incomingKey;
      setNotes(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.notes]);

  const addNote = () => {
    if (!newNoteTitle.trim()) return;
    setNotes([...notes, { id: Date.now().toString(), title: newNoteTitle.trim(), text: '', collapsed: false }]);
    setNewNoteTitle('');
    setShowNewNote(false);
  };

  const deleteNote = (noteId: string) => setNotes(notes.filter((n) => n.id !== noteId));

  // Note waiting on "Turn into a task list?" confirmation.
  const [confirmConvertId, setConfirmConvertId] = useState<string | null>(null);

  // If another tab linked here (a task's "Open notes"), open and flash that note.
  useEffect(() => {
    const id = takeHighlight();
    if (!id) return;
    setNotes((prev) => prev.map((n) => (n.id === id && n.collapsed ? { ...n, collapsed: false } : n)));
    flashItem(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Turns a note into a Tasks list — one task per non-empty line, bullets and
  // [ ] / [x] marks stripped — then removes the note and jumps to the list.
  const convertToTaskList = (note: FreeformNote) => {
    setConfirmConvertId(null);
    const items = note.text
      .split('\n')
      .map(lineToTask)
      .filter((t): t is { text: string; done: boolean } => t !== null)
      .map((t, i) => ({ id: `${Date.now()}-${i}`, text: t.text, done: t.done }));
    const list = { id: `${Date.now()}`, title: note.title.trim() || 'Untitled', items, collapsed: false };
    const tasksConfig = getWidgetConfig('tasks');
    updateWidgetConfig('tasks', { notes: [...(tasksConfig.notes || []), list] });
    // Save the removal right now: switching tabs unmounts this widget in the
    // same render, before the normal debounced save would ever run.
    const next = notes.filter((n) => n.id !== note.id);
    setNotes(next);
    // Drop any older pending save so it can't overwrite this one on unmount.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingSaveRef.current = null;
    lastPersistedRef.current = JSON.stringify(next);
    latestPropsRef.current.onUpdateConfig({ ...latestPropsRef.current.config, notes: next });
    navigateTo('tools', 'tasks', list.id);
  };

  // The task a note is attached to, if it still exists.
  const findLinkedTask = (note: FreeformNote): { text: string } | null => {
    if (!note.linkedTask) return null;
    const lists: any[] = getWidgetConfig('tasks').notes || [];
    const list = lists.find((l) => l.id === note.linkedTask!.listId);
    const item = list?.items?.find((i: any) => i.id === note.linkedTask!.itemId);
    return item ? { text: item.text } : null;
  };

  const updateText = (noteId: string, text: string) =>
    setNotes(notes.map((n) => (n.id === noteId ? { ...n, text } : n)));

  const updateTitle = (noteId: string, title: string) =>
    setNotes(notes.map((n) => (n.id === noteId ? { ...n, title } : n)));

  const toggleCollapsed = (noteId: string) =>
    setNotes(notes.map((n) => (n.id === noteId ? { ...n, collapsed: !n.collapsed } : n)));

  // Matches Quick Links' bulk expand/collapse pattern: "any expanded" decides
  // which direction the button goes next, so it reads/acts as Collapse All
  // as long as at least one note is open, and only flips to Expand All once
  // every note is closed.
  const anyExpanded = notes.some((n) => !n.collapsed);
  const toggleAllNotes = () => setNotes(notes.map((n) => ({ ...n, collapsed: anyExpanded })));

  return (
    <div className="flex flex-col gap-2">
      {notes.length > 0 && (
        <button
          onClick={toggleAllNotes}
          className="self-start flex items-center gap-1.5 text-xs font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 px-1 py-0.5 transition-colors duration-150"
          title={anyExpanded ? 'Collapse all notes' : 'Expand all notes'}
        >
          {anyExpanded ? <ChevronsUp size={13} /> : <ChevronsDown size={13} />}
          {anyExpanded ? 'Collapse all' : 'Expand all'}
        </button>
      )}
      {notes.map((note) => (
        <div key={note.id} data-item-id={note.id} className="surface-card bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden transition-shadow duration-300">
          <div className="flex items-center gap-1 px-1">
            <button
              onClick={() => toggleCollapsed(note.id)}
              className="p-1.5 flex-shrink-0 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-150"
              title={note.collapsed ? 'Expand' : 'Collapse'}
            >
              {note.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
            <input
              type="text"
              value={note.title}
              onChange={(e) => updateTitle(note.id, e.target.value)}
              placeholder="Untitled"
              className="font-semibold text-sm text-zinc-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded px-1 py-2 flex-1 min-w-0"
            />
            <button
              onClick={() => setConfirmConvertId(confirmConvertId === note.id ? null : note.id)}
              title="Turn this note into a task list (one task per line)"
              className="p-1.5 flex-shrink-0 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors duration-150"
            >
              <ListChecks size={14} />
            </button>
            <button onClick={() => deleteNote(note.id)} className="p-1.5 flex-shrink-0 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors duration-150">
              <X size={14} />
            </button>
          </div>

          {confirmConvertId === note.id && (
            <div className="mx-3 mb-2 px-2.5 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-200">
              <span className="flex-1">Turn into a task list? Each line becomes a task, and this note is removed.</span>
              <button onClick={() => convertToTaskList(note)} className="px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors duration-150">Convert</button>
              <button onClick={() => setConfirmConvertId(null)} className="px-2 py-1 rounded-md bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors duration-150">Cancel</button>
            </div>
          )}

          {(() => {
            const task = findLinkedTask(note);
            return task ? (
              <button
                onClick={() => navigateTo('tools', 'tasks', note.linkedTask!.itemId)}
                title="Go to the task this note belongs to"
                className="mx-3 mb-2 flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline max-w-full"
              >
                <CornerUpLeft size={11} className="flex-shrink-0" />
                <span className="truncate">Task: {task.text}</span>
              </button>
            ) : null;
          })()}

          {note.collapsed ? (
            note.text.trim() && (
              <button
                onClick={() => toggleCollapsed(note.id)}
                className="w-full text-left px-3 pb-2 text-xs text-zinc-500 dark:text-zinc-400 truncate"
              >
                {previewOf(note.text)}
              </button>
            )
          ) : (
            <div className="px-3 pb-3">
              <textarea
                value={note.text}
                onChange={(e) => updateText(note.id, e.target.value)}
                placeholder="Write freely..."
                rows={4}
                className="w-full px-2 py-1.5 text-sm rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y"
              />
            </div>
          )}
        </div>
      ))}

      {showNewNote ? (
        <div className="flex gap-1">
          <input
            type="text"
            value={newNoteTitle}
            onChange={(e) => setNewNoteTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addNote()}
            placeholder="Note name (e.g. Ideas)"
            className="flex-1 px-2 py-1.5 text-sm rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            autoFocus
          />
          <button onClick={addNote} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors duration-150">
            Add
          </button>
          <button
            onClick={() => { setShowNewNote(false); setNewNoteTitle(''); }}
            className="px-2 py-1.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-white rounded-lg text-sm transition-colors duration-150"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowNewNote(true)}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors duration-150 text-sm"
        >
          <Plus size={16} /> New Note
        </button>
      )}
    </div>
  );
}
