import { useState } from 'react';
import { Edit2, Trash2, X } from 'lucide-react';

interface Link {
  id: string;
  title: string;
  url: string;
  favicon?: string;
}

export default function QuickLinks() {
  const [links, setLinks] = useState<Link[]>([
    { id: '1', title: 'Google', url: 'https://google.com' },
    { id: '2', title: 'GitHub', url: 'https://github.com' },
  ]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
    } catch {
      return '';
    }
  };

  const addLink = () => {
    if (!newTitle.trim() || !newUrl.trim()) return;
    const link: Link = {
      id: Date.now().toString(),
      title: newTitle,
      url: newUrl,
      favicon: getFaviconUrl(newUrl)
    };
    setLinks([...links, link]);
    setNewTitle('');
    setNewUrl('');
    setShowAdd(false);
    localStorage.setItem('quickLinks', JSON.stringify([...links, link]));
  };

  const startEdit = (link: Link) => {
    setEditingId(link.id);
    setEditTitle(link.title);
    setEditUrl(link.url);
  };

  const saveEdit = (id: string) => {
    const updated = links.map(l =>
      l.id === id ? { ...l, title: editTitle, url: editUrl, favicon: getFaviconUrl(editUrl) } : l
    );
    setLinks(updated);
    setEditingId(null);
    localStorage.setItem('quickLinks', JSON.stringify(updated));
  };

  const deleteLink = (id: string) => {
    const updated = links.filter(l => l.id !== id);
    setLinks(updated);
    localStorage.setItem('quickLinks', JSON.stringify(updated));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {links.map((link) => (
          <div key={link.id} className="relative group">
            {editingId === link.id ? (
              <div className="space-y-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <input
                  type="text"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => saveEdit(link.id)}
                    className="flex-1 px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex-1 px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 p-3 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                {link.favicon && (
                  <img
                    src={link.favicon}
                    alt={link.title}
                    className="w-6 h-6"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                )}
                <span className="text-xs text-center text-gray-900 dark:text-gray-100 break-words">
                  {link.title}
                </span>
              </a>
            )}
            {editingId !== link.id && (
              <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => startEdit(link)}
                  className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={() => deleteLink(link.id)}
                  className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showAdd ? (
        <div className="space-y-2 p-3 bg-gray-100 dark:bg-gray-800 rounded">
          <input
            type="text"
            placeholder="Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-2 py-1 text-sm rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <input
            type="text"
            placeholder="URL"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="w-full px-2 py-1 text-sm rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <div className="flex gap-2">
            <button
              onClick={addLink}
              className="flex-1 px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setNewTitle('');
                setNewUrl('');
              }}
              className="flex-1 px-3 py-1 text-sm bg-gray-400 text-white rounded hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          + Add Link
        </button>
      )}
    </div>
  );
}
