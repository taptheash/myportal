import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, ChevronDown, ChevronRight } from 'lucide-react';

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
}

function migrateNotes(raw: any[]): FreeformNote[] {
  return (raw || []).map((note) => {
    if (typeof note.text === 'string') {
      return { id: note.id, title: note.title, text: note.text, collapsed: note.collapsed ?? false };
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
    setNotes([...notes, { id: Date.now().toString(), title: newNoteTitle.trim(), text: '', collapsed: false }]);
    setNewNoteTitle('');
    setShowNewNote(false);
  };

  const deleteNote = (noteId: string) => setNotes(notes.filter((n) => n.id !== noteId));

  const updateText = (noteId: string, text: string) =>
    setNotes(notes.map((n) => (n.id === noteId ? { ...n, text } : n)));

  const updateTitle = (noteId: string, title: string) =>
    setNotes(notes.map((n) => (n.id === noteId ? { ...n, title } : n)));

  const toggleCollapsed = (noteId: string) =>
    setNotes(notes.map((n) => (n.id === noteId ? { ...n, collapsed: !n.collapsed } : n)));

  return (
    <div className="flex flex-col gap-2">
      {notes.map((note) => (
        <div key={note.id} className="bg-amber-50 dark:bg-slate-700 rounded-lg border border-amber-200 dark:border-slate-600 overflow-hidden">
          <div className="flex items-center gap-1 px-1">
            <button
              onClick={() => toggleCollapsed(note.id)}
              className="p-1.5 flex-shrink-0 text-amber-600 dark:text-amber-400"
              title={note.collapsed ? 'Expand' : 'Collapse'}
            >
              {note.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
            <input
              type="text"
              value={note.title}
              onChange={(e) => updateTitle(note.id, e.target.value)}
              placeholder="Untitled"
              className="font-bold text-sm text-gray-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-amber-400 rounded px-1 py-2 flex-1 min-w-0"
            />
            <button onClick={() => deleteNote(note.id)} className="p-1.5 flex-shrink-0 text-gray-400 hover:text-red-500 transition">
              <X size={14} />
            </button>
          </div>

          {note.collapsed ? (
            note.text.trim() && (
              <button
                onClick={() => toggleCollapsed(note.id)}
                className="w-full text-left px-3 pb-2 text-xs text-gray-500 dark:text-gray-400 truncate"
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
                className="w-full px-2 py-1.5 text-sm rounded bg-white dark:bg-slate-600 text-gray-900 dark:text-white border border-amber-200 dark:border-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-y"
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
            className="flex-1 px-2 py-1.5 text-sm rounded-lg bg-white dark:bg-slate-600 text-gray-900 dark:text-white border border-amber-200 dark:border-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
            autoFocus
          />
          <button onClick={addNote} className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-gray-900 rounded-lg text-sm font-semibold transition">
            Add
          </button>
          <button
            onClick={() => { setShowNewNote(false); setNewNoteTitle(''); }}
            className="px-2 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg text-sm transition"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowNewNote(true)}
          className="w-full py-2 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-500 hover:to-yellow-500 text-gray-900 rounded-lg font-semibold flex items-center justify-center gap-2 transition text-sm"
        >
          <Plus size={16} /> New Note
        </button>
      )}
    </div>
  );
}
