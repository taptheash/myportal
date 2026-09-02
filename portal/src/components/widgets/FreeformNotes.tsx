import React, { useState, useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';

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
}

// Migrates notes saved under the old checkbox-list format
// ({items: [{text, done}]}) into plain freeform text, joining each item's
// text onto its own line. Existing saved notes carry over as readable text
// rather than being lost when this widget changed from a to-do-style list
// to open-ended note-taking.
function migrateNotes(raw: any[]): FreeformNote[] {
  return (raw || []).map((note) => {
    if (typeof note.text === 'string') return { id: note.id, title: note.title, text: note.text };
    const text = (note.items || []).map((item: any) => item.text).join('\n');
    return { id: note.id, title: note.title, text };
  });
}

export default function FreeformNotes({ config, onUpdateConfig }: FreeformNotesProps) {
  const [notes, setNotes] = useState<FreeformNote[]>(() => migrateNotes(config.notes));
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [showNewNote, setShowNewNote] = useState(false);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  // Autosave, debounced — same pattern the checkbox-list version used.
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
    setNotes([...notes, { id: Date.now().toString(), title: newNoteTitle.trim(), text: '' }]);
    setNewNoteTitle('');
    setShowNewNote(false);
  };

  const deleteNote = (noteId: string) => {
    setNotes(notes.filter((n) => n.id !== noteId));
  };

  const updateText = (noteId: string, text: string) => {
    setNotes(notes.map((n) => (n.id === noteId ? { ...n, text } : n)));
  };

  const updateTitle = (noteId: string, title: string) => {
    setNotes(notes.map((n) => (n.id === noteId ? { ...n, title } : n)));
  };

  return (
    <div className="flex flex-col gap-3">
      {notes.map((note) => (
        <div key={note.id} className="bg-amber-50 dark:bg-slate-700 rounded-lg p-3 border border-amber-200 dark:border-slate-600">
          <div className="flex justify-between items-center mb-2">
            <input
              type="text"
              value={note.title}
              onChange={(e) => updateTitle(note.id, e.target.value)}
              placeholder="Untitled"
              className="font-bold text-sm text-gray-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-amber-400 rounded px-1 -mx-1 flex-1 min-w-0"
            />
            <button onClick={() => deleteNote(note.id)} className="text-gray-400 hover:text-red-500 transition">
              <X size={14} />
            </button>
          </div>
          <textarea
            value={note.text}
            onChange={(e) => updateText(note.id, e.target.value)}
            placeholder="Write freely..."
            rows={4}
            className="w-full px-2 py-1.5 text-sm rounded bg-white dark:bg-slate-600 text-gray-900 dark:text-white border border-amber-200 dark:border-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-y"
          />
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
