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
          <div key={note.id} className="bg-amber-50 dark:bg-slate-700 rounded-lg border border-amber-200 dark:border-slate-600 overflow-hidden">
            <div className="flex items-center gap-1 px-1">
              <button
                onClick={() => toggleCollapsed(note.id)}
                className="p-1.5 flex-shrink-0 text-amber-600 dark:text-amber-400"
                title={note.collapsed ? 'Expand' : 'Collapse'}
              >
                {note.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex-1 min-w-0 truncate py-2">{note.title}</h3>
              {note.items.length > 0 && (
                <span className="text-xs text-amber-500 dark:text-amber-400 flex-shrink-0">{doneCount}/{note.items.length}</span>
              )}
              <button onClick={() => deleteNote(note.id)} className="p-1.5 flex-shrink-0 text-gray-400 hover:text-red-500 transition">
                <X size={14} />
              </button>
            </div>

            {!note.collapsed && (
              <div className="px-3 pb-3">
                <div className="flex flex-col gap-1">
                  {note.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 group">
                      <button onClick={() => toggleItem(note.id, item.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                          item.done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-slate-500 hover:border-amber-400'
                        }`}>
                        {item.done && <Check size={12} />}
                      </button>
                      <span className={`text-sm flex-1 ${item.done ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>{item.text}</span>
                      <button onClick={() => deleteItem(note.id, item.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition"><X size={12} /></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1 mt-2">
                  <input type="text" value={newItemText[note.id] || ''}
                    onChange={(e) => setNewItemText({ ...newItemText, [note.id]: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && addItem(note.id)}
                    placeholder="Add item, press Enter"
                    className="flex-1 px-2 py-1 text-sm rounded bg-white dark:bg-slate-600 text-gray-900 dark:text-white border border-amber-200 dark:border-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400" />
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
            className="flex-1 px-2 py-1.5 text-sm rounded-lg bg-white dark:bg-slate-600 text-gray-900 dark:text-white border border-amber-200 dark:border-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
            autoFocus />
          <button onClick={addNote} className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-gray-900 rounded-lg text-sm font-semibold transition">Add</button>
          <button onClick={() => { setShowNewNote(false); setNewNoteTitle(''); }}
            className="px-2 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg text-sm transition"><X size={14} /></button>
        </div>
      ) : (
        <button onClick={() => setShowNewNote(true)}
          className="w-full py-2 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-500 hover:to-yellow-500 text-gray-900 rounded-lg font-semibold flex items-center justify-center gap-2 transition text-sm">
          <Plus size={16} /> New List
        </button>
      )}
    </div>
  );
}
