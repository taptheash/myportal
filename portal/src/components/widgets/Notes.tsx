import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, Check } from 'lucide-react';

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
}

export default function Notes({ id, config, onUpdateConfig }: NotesProps) {
  const [notes, setNotes] = useState<Note[]>(config.notes || []);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [showNewNote, setShowNewNote] = useState(false);
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Autosave
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onUpdateConfig({ ...config, notes });
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [notes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-resize: measure content and request layout change
  useEffect(() => {
    if (!contentRef.current) return;
    const contentHeight = contentRef.current.scrollHeight + 38; // +38 for title bar
    const rowHeight = 60;
    const margin = 16;
    const neededH = Math.max(3, Math.ceil((contentHeight + margin) / (rowHeight + margin)));
    onUpdateConfig({ ...config, notes, _desiredH: neededH });
  }, [notes, showNewNote]); // eslint-disable-line react-hooks/exhaustive-deps

  const addNote = () => {
    if (!newNoteTitle.trim()) return;
    setNotes([...notes, { id: Date.now().toString(), title: newNoteTitle.trim(), items: [] }]);
    setNewNoteTitle('');
    setShowNewNote(false);
  };

  const deleteNote = (noteId: string) => {
    setNotes(notes.filter((n) => n.id !== noteId));
  };

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
    <div ref={contentRef} className="flex flex-col gap-3" style={{minHeight: "400px"}}>
      {notes.map((note) => (
        <div key={note.id} className="bg-amber-50 dark:bg-slate-700 rounded-lg p-3 border border-amber-200 dark:border-slate-600">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">{note.title}</h3>
            <button onClick={() => deleteNote(note.id)} className="text-gray-400 hover:text-red-500 transition"><X size={14} /></button>
          </div>
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
      ))}

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
