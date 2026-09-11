import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Check, ChevronDown, ChevronRight } from 'lucide-react';

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
}

interface Note {
  id: string;
  title: string;
  items: ListItem[];
  collapsed: boolean;
}

export default function Notes({ config, onUpdateConfig }: NotesProps) {
  const [notes, setNotes] = useState<Note[]>(() =>
    (config.notes || []).map((n: any) => ({ ...n, collapsed: n.collapsed ?? false }))
  );
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [showNewNote, setShowNewNote] = useState(false);
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onUpdateConfig({ ...config, notes });
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  const addNote = () => {
    if (!newNoteTitle.trim()) return;
    setNotes([...notes, { id: Date.now().toString(), title: newNoteTitle.trim(), items: [], collapsed: false }]);
    setNewNoteTitle('');
    setShowNewNote(false);
  };

  const deleteNote = (noteId: string) => setNotes(notes.filter((n) => n.id !== noteId));

  const toggleCollapsed = (noteId: string) =>
    setNotes(notes.map((n) => (n.id === noteId ? { ...n, collapsed: !n.collapsed } : n)));

  const addItem = (noteId: string) => {
    const text = (newItemText[noteId] || '').trim();
    if (!text) return;
    setNotes(notes.map((n) =>
      n.id === noteId ? { ...n, items: [...n.items, { id: Date.now().toString(), text, done: false }] } : n
    ));
    setNewItemText({ ...newItemText, [noteId]: '' });
  };

  const toggleItem = (noteId: string, itemId: string) => {
    setNotes(notes.map((n) =>
      n.id === noteId ? { ...n, items: n.items.map((i) => i.id === itemId ? { ...i, done: !i.done } : i) } : n
    ));
  };

  const deleteItem = (noteId: string, itemId: string) => {
    setNotes(notes.map((n) =>
      n.id === noteId ? { ...n, items: n.items.filter((i) => i.id !== itemId) } : n
    ));
  };

  return (
    <div className="flex flex-col gap-2">
      {notes.map((note) => {
        const doneCount = note.items.filter((i) => i.done).length;
        return (
          <div key={note.id} className="surface-card bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
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
                  {note.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 group">
                      <button onClick={() => toggleItem(note.id, item.id)}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-150 ${
                          item.done ? 'bg-green-500 border-green-500 text-white' : 'border-zinc-300 dark:border-zinc-600 hover:border-indigo-400'
                        }`}>
                        {item.done && <Check size={12} />}
                      </button>
                      <span className={`text-sm flex-1 ${item.done ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-800 dark:text-zinc-200'}`}>{item.text}</span>
                      <button onClick={() => deleteItem(note.id, item.id)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-colors duration-150"><X size={12} /></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1 mt-2">
                  <input type="text" value={newItemText[note.id] || ''}
                    onChange={(e) => setNewItemText({ ...newItemText, [note.id]: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && addItem(note.id)}
                    placeholder="Add item, press Enter"
                    className="flex-1 px-2 py-1 text-sm rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
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
