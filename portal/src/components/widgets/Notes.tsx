import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Check, ChevronDown, ChevronRight, ChevronsDown, ChevronsUp, CalendarClock, StickyNote } from 'lucide-react';
import { getWidgetConfig, updateWidgetConfig } from '../../lib/portalStorage';
import { navigateTo, takeHighlight, flashItem } from '../../lib/portalNav';

interface NotesProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface ListItem {
  id: string;
  text: string;
  done: boolean;
  dueDate?: string; // ISO yyyy-mm-dd, optional — undated tasks behave exactly as before
  noteId?: string;  // id of the Notes entry holding this task's details ("Add notes")
}

interface Note {
  id: string;
  title: string;
  items: ListItem[];
  collapsed: boolean;
}

// Exported so Home's Attention module can read "how many tasks are due
// today / overdue" without re-implementing this file's storage shape.
export function getAllTaskItems(config: Record<string, any>): Array<ListItem & { noteId: string; noteTitle: string }> {
  const notes: Note[] = config?.notes || [];
  const out: Array<ListItem & { noteId: string; noteTitle: string }> = [];
  for (const n of notes) {
    for (const item of n.items || []) {
      out.push({ ...item, noteId: n.id, noteTitle: n.title });
    }
  }
  return out;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalizeTaskLists(raw: any[]): Note[] {
  return (raw || []).map((n: any) => ({ ...n, collapsed: n.collapsed ?? false }));
}

export default function Notes({ config, onUpdateConfig }: NotesProps) {
  const [notes, setNotes] = useState<Note[]>(() => normalizeTaskLists(config.notes));
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [showNewNote, setShowNewNote] = useState(false);
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});
  const [newItemDue, setNewItemDue] = useState<Record<string, string>>({});
  const [editingDueId, setEditingDueId] = useState<string | null>(null);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  // See the matching comment in FreeformNotes.tsx — without this guard, the
  // save-back this effect schedules right after mount would echo whatever
  // `config.notes` looked like at that instant, clobbering a more recent
  // write Home's Scratchpad just made directly into this same widget's
  // config (lib/portalStorage.ts). Skipping the mount-triggered save means
  // this component only ever persists a change the user actually made here.
  const isFirstRender = useRef(true);
  const pendingSaveRef = useRef<(() => void) | null>(null);
  // Latest props, so a flushed/debounced save merges into the CURRENT config
  // rather than the one captured when the edit happened.
  const latestPropsRef = useRef({ config, onUpdateConfig });
  latestPropsRef.current = { config, onUpdateConfig };

  // Tracks the last value WE persisted, as a JSON string. Lets the sync
  // effect below tell "config.notes changed because something else wrote
  // it" (Scratchpad, or this same tab reacting to a write made from a
  // second browser tab/window open to Home) apart from "config.notes
  // changed because our own save just round-tripped back down as a new
  // prop" — only the former should update local state.
  const lastPersistedRef = useRef<string>(JSON.stringify(normalizeTaskLists(config.notes)));

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
  // mounted — e.g. Tasks open in one tab/window while Scratchpad saves from
  // Home in another — so the task shows up without navigating away and back
  // or reloading the page.
  useEffect(() => {
    const incoming = normalizeTaskLists(config.notes);
    const incomingKey = JSON.stringify(incoming);
    if (incomingKey !== lastPersistedRef.current) {
      lastPersistedRef.current = incomingKey;
      setNotes(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.notes]);

  const addNote = () => {
    if (!newNoteTitle.trim()) return;
    setNotes([...notes, { id: Date.now().toString(), title: newNoteTitle.trim(), items: [], collapsed: false }]);
    setNewNoteTitle('');
    setShowNewNote(false);
  };

  const deleteNote = (noteId: string) => setNotes(notes.filter((n) => n.id !== noteId));

  const toggleCollapsed = (noteId: string) =>
    setNotes(notes.map((n) => (n.id === noteId ? { ...n, collapsed: !n.collapsed } : n)));

  // Matches Quick Links' bulk expand/collapse pattern: "any expanded" decides
  // which direction the button goes next, so it reads/acts as Collapse All
  // as long as at least one list is open, and only flips to Expand All once
  // every list is closed.
  const anyExpanded = notes.some((n) => !n.collapsed);
  const toggleAllNotes = () => setNotes(notes.map((n) => ({ ...n, collapsed: anyExpanded })));

  const addItem = (noteId: string) => {
    const text = (newItemText[noteId] || '').trim();
    if (!text) return;
    const dueDate = newItemDue[noteId] || undefined;
    setNotes(notes.map((n) =>
      n.id === noteId ? { ...n, items: [...n.items, { id: Date.now().toString(), text, done: false, dueDate }] } : n
    ));
    setNewItemText({ ...newItemText, [noteId]: '' });
    setNewItemDue({ ...newItemDue, [noteId]: '' });
  };

  const setItemDueDate = (noteId: string, itemId: string, dueDate: string) => {
    setNotes(notes.map((n) =>
      n.id === noteId ? { ...n, items: n.items.map((i) => i.id === itemId ? { ...i, dueDate: dueDate || undefined } : i) } : n
    ));
  };

  const toggleItem = (noteId: string, itemId: string) => {
    setNotes(notes.map((n) =>
      n.id === noteId ? { ...n, items: n.items.map((i) => i.id === itemId ? { ...i, done: !i.done } : i) } : n
    ));
  };

  // Arriving from a link (a converted note, or a note's "Task:" link):
  // expand the list if needed, then scroll to and flash the item.
  useEffect(() => {
    const id = takeHighlight();
    if (!id) return;
    setNotes((prev) => prev.map((n) =>
      (n.id === id || n.items.some((i) => i.id === id)) && n.collapsed ? { ...n, collapsed: false } : n
    ));
    flashItem(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ids of notes that currently exist, so a task only shows its note link
  // while that note is still there.
  const existingNoteIds = new Set<string>((getWidgetConfig('notes').notes || []).map((n: any) => n.id));

  // Opens this task's detail note, creating it (titled with the task) the
  // first time. The task itself stays a task.
  const openTaskNote = (listId: string, item: ListItem) => {
    if (item.noteId && existingNoteIds.has(item.noteId)) {
      navigateTo('tools', 'notes', item.noteId);
      return;
    }
    const note = { id: `${Date.now()}`, title: item.text, text: '', collapsed: false, linkedTask: { listId, itemId: item.id } };
    const notesConfig = getWidgetConfig('notes');
    updateWidgetConfig('notes', { notes: [...(notesConfig.notes || []), note] });
    // Saved immediately — the tab switch below unmounts this widget before
    // its debounced save would run.
    const next = notes.map((n) =>
      n.id === listId ? { ...n, items: n.items.map((i) => (i.id === item.id ? { ...i, noteId: note.id } : i)) } : n
    );
    setNotes(next);
    // Drop any older pending save so it can't overwrite this one on unmount.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingSaveRef.current = null;
    lastPersistedRef.current = JSON.stringify(next);
    latestPropsRef.current.onUpdateConfig({ ...latestPropsRef.current.config, notes: next });
    navigateTo('tools', 'notes', note.id);
  };

  const deleteItem = (noteId: string, itemId: string) => {
    setNotes(notes.map((n) =>
      n.id === noteId ? { ...n, items: n.items.filter((i) => i.id !== itemId) } : n
    ));
  };

  return (
    <div className="flex flex-col gap-2">
      {notes.length > 0 && (
        <button
          onClick={toggleAllNotes}
          className="self-start flex items-center gap-1.5 text-xs font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 px-1 py-0.5 transition-colors duration-150"
          title={anyExpanded ? 'Collapse all lists' : 'Expand all lists'}
        >
          {anyExpanded ? <ChevronsUp size={13} /> : <ChevronsDown size={13} />}
          {anyExpanded ? 'Collapse all' : 'Expand all'}
        </button>
      )}
      {notes.map((note) => {
        const doneCount = note.items.filter((i) => i.done).length;
        return (
          <div key={note.id} data-item-id={note.id} className="surface-card bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <div className="flex items-center gap-1 px-1">
              <button
                onClick={() => toggleCollapsed(note.id)}
                className="p-1.5 flex-shrink-0 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-150"
                title={note.collapsed ? 'Expand' : 'Collapse'}
              >
                {note.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-white flex-1 min-w-0 truncate py-2">{note.title}</h3>
              {note.items.length > 0 && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0">{doneCount}/{note.items.length}</span>
              )}
              <button onClick={() => deleteNote(note.id)} className="p-1.5 flex-shrink-0 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors duration-150">
                <X size={14} />
              </button>
            </div>

            {!note.collapsed && (
              <div className="px-3 pb-3">
                <div className="flex flex-col gap-1">
                  {note.items.map((item) => {
                    const isOverdue = !!item.dueDate && !item.done && item.dueDate < todayKey();
                    const isDueToday = !!item.dueDate && item.dueDate === todayKey();
                    return (
                      <div key={item.id} data-item-id={item.id} className="flex items-center gap-2 group transition-shadow duration-300">
                        <button onClick={() => toggleItem(note.id, item.id)}
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-150 ${
                            item.done ? 'bg-green-500 border-green-500 text-white' : 'border-zinc-300 dark:border-zinc-600 hover:border-indigo-400'
                          }`}>
                          {item.done && <Check size={12} />}
                        </button>
                        <span className={`text-sm flex-1 ${item.done ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-800 dark:text-zinc-200'}`}>{item.text}</span>
                        {editingDueId === item.id ? (
                          <input
                            type="date"
                            autoFocus
                            value={item.dueDate || ''}
                            onChange={(e) => setItemDueDate(note.id, item.id, e.target.value)}
                            onBlur={() => setEditingDueId(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingDueId(null)}
                            className="text-xs px-1.5 py-0.5 rounded-md bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingDueId(item.id)}
                            title={item.dueDate ? 'Change due date' : 'Set due date'}
                            className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md flex-shrink-0 transition-colors duration-150 ${
                              isOverdue
                                ? 'text-red-500 bg-red-50 dark:bg-red-950/40'
                                : isDueToday
                                ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40'
                                : item.dueDate
                                ? 'text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800'
                                : 'text-zinc-300 dark:text-zinc-700 opacity-0 group-hover:opacity-100 hover:text-indigo-500'
                            }`}
                          >
                            <CalendarClock size={11} />
                            {item.dueDate
                              ? new Date(`${item.dueDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : 'Due date'}
                          </button>
                        )}
                        {(() => {
                          const hasNote = !!item.noteId && existingNoteIds.has(item.noteId);
                          return (
                            <button
                              onClick={() => openTaskNote(note.id, item)}
                              title={hasNote ? 'Open this task\'s notes' : 'Add notes to this task'}
                              className={`flex-shrink-0 transition-colors duration-150 ${
                                hasNote
                                  ? 'text-indigo-500 hover:text-indigo-600 dark:text-indigo-400'
                                  : 'text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-indigo-500'
                              }`}
                            >
                              <StickyNote size={12} />
                            </button>
                          );
                        })()}
                        <button onClick={() => deleteItem(note.id, item.id)}
                          className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-colors duration-150"><X size={12} /></button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-1 mt-2">
                  <input type="text" value={newItemText[note.id] || ''}
                    onChange={(e) => setNewItemText({ ...newItemText, [note.id]: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && addItem(note.id)}
                    placeholder="Add item, press Enter"
                    className="flex-1 px-2 py-1 text-sm rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                  <input type="date" value={newItemDue[note.id] || ''}
                    onChange={(e) => setNewItemDue({ ...newItemDue, [note.id]: e.target.value })}
                    title="Optional due date"
                    className="w-[130px] px-2 py-1 text-sm rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {showNewNote ? (
        <div className="flex gap-1">
          <input type="text" value={newNoteTitle}
            onChange={(e) => setNewNoteTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addNote()}
            placeholder="List name (e.g. Packing List)"
            className="flex-1 px-2 py-1.5 text-sm rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            autoFocus />
          <button onClick={addNote} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors duration-150">Add</button>
          <button onClick={() => { setShowNewNote(false); setNewNoteTitle(''); }}
            className="px-2 py-1.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-white rounded-lg text-sm transition-colors duration-150"><X size={14} /></button>
        </div>
      ) : (
        <button onClick={() => setShowNewNote(true)}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors duration-150 text-sm">
          <Plus size={16} /> New List
        </button>
      )}
    </div>
  );
}
