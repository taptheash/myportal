import React, { useState } from 'react';
import { X, Globe, Check, Pencil } from 'lucide-react';

interface QuickLinksProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface Link {
  id: string;
  label: string;
  url: string;
}

const DEFAULT_LINKS: Link[] = [
  { id: '1', label: 'GitHub', url: 'https://github.com' },
  { id: '2', label: 'Gmail', url: 'https://mail.google.com' },
  { id: '3', label: 'Google Calendar', url: 'https://calendar.google.com' },
  { id: '4', label: 'YouTube', url: 'https://youtube.com' },
  { id: '5', label: 'Google', url: 'https://google.com' },
];

function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return '';
  }
}

function SiteIcon({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false);
  const faviconUrl = getFaviconUrl(url);
  if (!faviconUrl || failed) {
    return <Globe size={20} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />;
  }
  return (
    <img
      src={faviconUrl}
      alt={label}
      width={20}
      height={20}
      className="flex-shrink-0 rounded-sm"
      onError={() => setFailed(true)}
    />
  );
}

export default function QuickLinks({ config, onUpdateConfig }: QuickLinksProps) {
  const [links, setLinks] = useState<Link[]>(config.links || DEFAULT_LINKS);
  const [showInlineAdd, setShowInlineAdd] = useState(config.showAdd || false);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editUrl, setEditUrl] = useState('');

  const saveLinks = (updatedLinks: Link[]) => {
    setLinks(updatedLinks);
    onUpdateConfig({ ...config, links: updatedLinks });
  };

  const handleAddLink = () => {
    if (!newLabel.trim() || !newUrl.trim()) {
      setError('Both fields are required');
      return;
    }
    const link: Link = {
      id: Date.now().toString(),
      label: newLabel.trim(),
      url: newUrl.startsWith('http') ? newUrl.trim() : `https://${newUrl.trim()}`,
    };
    saveLinks([...links, link]);
    setNewLabel('');
    setNewUrl('');
    setShowInlineAdd(false);
    setError(null);
    onUpdateConfig({ ...config, links: [...links, link], showAdd: false });
  };

  const handleRemoveLink = (id: string) => {
    saveLinks(links.filter((l) => l.id !== id));
  };

  const startEdit = (link: Link) => {
    setEditingId(link.id);
    setEditLabel(link.label);
    setEditUrl(link.url);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel('');
    setEditUrl('');
  };

  const saveEdit = () => {
    if (!editLabel.trim() || !editUrl.trim() || !editingId) return;
    const updated = links.map((l) =>
      l.id === editingId
        ? { ...l, label: editLabel.trim(), url: editUrl.startsWith('http') ? editUrl.trim() : `https://${editUrl.trim()}` }
        : l
    );
    saveLinks(updated);
    cancelEdit();
  };

  return (
    <div className="flex flex-col gap-2">

      {/* Inline add form */}
      {showInlineAdd && (
        <div className="flex flex-col gap-1.5 p-2 bg-teal-50 dark:bg-slate-700 rounded-lg border border-teal-200 dark:border-slate-600">
          {error && <p className="text-xs text-red-500">{error}</p>}
          <input
            type="text"
            placeholder="Label (e.g. GitHub)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-600 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-400"
            autoFocus
          />
          <input
            type="text"
            placeholder="URL (e.g. github.com)"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-600 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-400"
          />
          <div className="flex gap-2">
            <button onClick={handleAddLink} className="flex-1 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1">
              <Check size={14} /> Add
            </button>
            <button onClick={() => { setShowInlineAdd(false); setNewLabel(''); setNewUrl(''); setError(null); onUpdateConfig({ ...config, showAdd: false }); }}
              className="flex-1 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1">
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Links */}
      <div className="flex flex-col gap-1.5">
        {links.map((link) =>
          editingId === link.id ? (
            <div key={link.id} className="flex flex-col gap-1.5 p-2 bg-teal-50 dark:bg-slate-700 rounded-lg border border-teal-200 dark:border-slate-600">
              <input
                type="text"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="Label"
                className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-600 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-400"
                autoFocus
              />
              <input
                type="text"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                placeholder="URL"
                className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-600 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-400"
              />
              <div className="flex gap-2">
                <button onClick={saveEdit} className="flex-1 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1">
                  <Check size={14} /> Save
                </button>
                <button onClick={cancelEdit} className="flex-1 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1">
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div key={link.id} className="flex items-center gap-1.5 group">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center gap-2.5 px-3 py-2 bg-teal-50 dark:bg-slate-700 hover:bg-teal-100 dark:hover:bg-slate-600 rounded-lg transition truncate min-w-0"
              >
                <SiteIcon url={link.url} label={link.label} />
                <span className="text-sm font-medium text-teal-900 dark:text-teal-100 truncate">{link.label}</span>
              </a>
              <button
                onClick={() => startEdit(link)}
                className="p-1.5 bg-teal-100 dark:bg-slate-600 hover:bg-teal-200 dark:hover:bg-slate-500 text-teal-700 dark:text-teal-200 rounded-lg transition flex-shrink-0"
                title="Edit link"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => handleRemoveLink(link.id)}
                className="p-1.5 bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-600 dark:text-red-300 rounded-lg transition flex-shrink-0"
                title="Delete link"
              >
                <X size={13} />
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
