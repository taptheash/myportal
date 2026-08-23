import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';

interface Note {
  id: string;
  text: string;
  completed: boolean;
}

interface NotesList {
  name: string;
  notes: Note[];
}

export default function Notes() {
  const [lists, setLists] = useState<NotesList[]>([
    { name: 'Default', notes: [] }
  ]);
  const [activeList, setActiveList] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [newListName, setNewListName] = useState('');
  const [showNewList, setShowNewList] = useState(false);

  const addNote = () => {
    if (!inputValue.trim()) return;
    const updatedLists = [...lists];
    updatedLists[activeList].notes.push({
      id: Date.now().toString(),
      text: inputValue,
      completed: false
    });
    setLists(updatedLists);
    setInputValue('');
    localStorage.setItem('notes', JSON.stringify(updatedLists));
  };

  const toggleNote = (noteId: string) => {
    const updatedLists = [...lists];
    const note = updatedLists[activeList].notes.find(n => n.id === noteId);
    if (note) note.completed = !note.completed;
    setLists(updatedLists);
    localStorage.setItem('notes', JSON.stringify(updatedLists));
  };

  const deleteNote = (noteId: string) => {
    const updatedLists = [...lists];
    updatedLists[activeList].notes = updatedLists[activeList].notes.filter(n => n.id !== noteId);
    setLists(updatedLists);
    localStorage.setItem('notes', JSON.stringify(updatedLists));
  };

  const createNewList = () => {
    if (!newListName.trim()) return;
    setLists([...lists, { name: newListName, notes: [] }]);
    setNewListName('');
    setShowNewList(false);
  };

  return (
    <div className="space-y-3">
      {/* List tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {lists.map((list, idx) => (
          <button
            key={idx}
            onClick={() => setActiveList(idx)}
            className={`px-3 py-1 text-sm rounded whitespace-nowrap transition ${
              activeList === idx
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {list.name}
          </button>
        ))}
        {showNewList ? (
          <input
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && createNewList()}
            placeholder="New list..."
            className="px-2 py-1 text-sm rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setShowNewList(true)}
            className="px-3 py-1 text-sm rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100"
          >
            +
          </button>
        )}
      </div>

      {/* Notes input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addNote()}
          placeholder="Add a note..."
          className="flex-1 px-3 py-2 rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={addNote}
          className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Notes list */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {lists[activeList].notes.map((note) => (
          <div
            key={note.id}
            className="flex items-center gap-2 p-2 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            <input
              type="checkbox"
              checked={note.completed}
              onChange={() => toggleNote(note.id)}
              className="w-4 h-4 cursor-pointer"
            />
            <span
              className={`flex-1 text-sm ${
                note.completed
                  ? 'line-through text-gray-500 dark:text-gray-400'
                  : 'text-gray-900 dark:text-gray-100'
              }`}
            >
              {note.text}
            </span>
            <button
              onClick={() => deleteNote(note.id)}
              className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
