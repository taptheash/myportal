import React, { useState, useEffect } from 'react';
import { X, Globe, Check, Pencil, GripVertical, Folder, FolderOpen, ChevronDown, ChevronRight, FolderPlus } from 'lucide-react';

interface QuickLinksProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface LinkItem {
  type: 'link';
  id: string;
  label: string;
  url: string;
}

interface FolderItem {
  type: 'folder';
  id: string;
  label: string;
  links: LinkItem[];
  expanded: boolean;
}

type Entry = LinkItem | FolderItem;

const DEFAULT_ENTRIES: Entry[] = [
  { type: 'link', id: '1', label: 'GitHub', url: 'https://github.com' },
  { type: 'link', id: '2', label: 'Gmail', url: 'https://mail.google.com' },
  { type: 'link', id: '3', label: 'Google Calendar', url: 'https://calendar.google.com' },
  { type: 'link', id: '4', label: 'YouTube', url: 'https://youtube.com' },
  { type: 'link', id: '5', label: 'Google', url: 'https://google.com' },
];

// Backward-compatible with links saved before folders existed — those
// entries have no `type` field at all, just {id, label, url}. Treat any
// entry without type: 'folder' as a plain link.
function normalizeEntries(raw: any[] | undefined): Entry[] {
  if (!raw) return DEFAULT_ENTRIES;
  return raw.map((e): Entry => {
    if (e && e.type === 'folder') {
      return {
        type: 'folder',
        id: e.id,
        label: e.label,
        expanded: e.expanded !== false,
        links: (e.links || []).map((l: any) => ({ type: 'link', id: l.id, label: l.label, url: l.url })),
      };
    }
    return { type: 'link', id: e.id, label: e.label, url: e.url };
  });
}

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

// Removes one entry from its source container (root, or a folder's links)
// and inserts it at a destination — either a specific position in a
// container, or appended into a folder. `dest.index` follows the same
// pre-removal gap-position convention as the drag-over handlers compute,
// so from===0,to===2 means "the gap that was between index 1 and 2."
function commitMove(
  entries: Entry[],
  source: { containerId: string; index: number },
  dest: { containerId: string; index: number } | { intoFolderId: string }
): Entry[] {
  let next: Entry[] = entries.map((e) => (e.type === 'folder' ? { ...e, links: [...e.links] } : { ...e }));

  let removed: Entry | null = null;
  if (source.containerId === 'root') {
    removed = next[source.index] ?? null;
    if (removed) next = next.filter((_, i) => i !== source.index);
  } else {
    const folder = next.find((e): e is FolderItem => e.type === 'folder' && e.id === source.containerId);
    if (folder) {
      removed = folder.links[source.index] ?? null;
      if (removed) folder.links = folder.links.filter((_, i) => i !== source.index);
    }
  }
  if (!removed) return entries;

  if ('intoFolderId' in dest) {
    if (removed.type !== 'link') return entries; // folders can't nest inside folders
    const folder = next.find((e): e is FolderItem => e.type === 'folder' && e.id === dest.intoFolderId);
    if (folder) folder.links = [...folder.links, removed];
    return next;
  }

  if (dest.containerId === 'root') {
    let insertAt = dest.index;
    if (source.containerId === 'root' && source.index < dest.index) insertAt -= 1;
    next = [...next.slice(0, insertAt), removed, ...next.slice(insertAt)];
  } else if (removed.type === 'link') {
    const folder = next.find((e): e is FolderItem => e.type === 'folder' && e.id === dest.containerId);
    if (folder) {
      let insertAt = dest.index;
      if (source.containerId === dest.containerId && source.index < dest.index) insertAt -= 1;
      folder.links = [...folder.links.slice(0, insertAt), removed, ...folder.links.slice(insertAt)];
    }
  }

  return next;
}

export default function QuickLinks({ config, onUpdateConfig }: QuickLinksProps) {
  const [entries, setEntries] = useState<Entry[]>(() => normalizeEntries(config.links));
  const [showInlineAdd, setShowInlineAdd] = useState(config.showAdd || false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Drag state. `source`/`insertTarget` carry a containerId ('root' or a
  // folder's id) alongside an index, so the same logic covers reordering
  // at the top level, reordering within a folder, and moving between them.
  // `dropFolderId` is separate: it's the "drop ONTO this folder to file
  // into it" signal, distinct from "insert as a sibling near this folder."
  const [dragSource, setDragSource] = useState<{ containerId: string; index: number } | null>(null);
  const [insertTarget, setInsertTarget] = useState<{ containerId: string; index: number } | null>(null);
  const [dropFolderId, setDropFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (config.showAdd) setShowInlineAdd(true);
  }, [config.showAdd]);

  const save = (updated: Entry[]) => {
    setEntries(updated);
    onUpdateConfig({ ...config, links: updated });
  };

  const handleAddLink = () => {
    if (!newLabel.trim() || !newUrl.trim()) {
      setError('Both fields are required');
      return;
    }
    const link: LinkItem = {
      type: 'link',
      id: Date.now().toString(),
      label: newLabel.trim(),
      url: newUrl.startsWith('http') ? newUrl.trim() : `https://${newUrl.trim()}`,
    };
    save([...entries, link]);
    setNewLabel('');
    setNewUrl('');
    setShowInlineAdd(false);
    setError(null);
    onUpdateConfig({ ...config, links: [...entries, link], showAdd: false });
  };

  const handleAddFolder = () => {
    if (!newFolderName.trim()) return;
    const folder: FolderItem = {
      type: 'folder',
      id: `f${Date.now()}`,
      label: newFolderName.trim(),
      links: [],
      expanded: true,
    };
    save([...entries, folder]);
    setNewFolderName('');
    setShowAddFolder(false);
  };

  const toggleFolder = (folderId: string) => {
    save(entries.map((e) => (e.type === 'folder' && e.id === folderId ? { ...e, expanded: !e.expanded } : e)));
  };

  // Deleting a folder un-files its links back to the root list rather than
  // deleting them — losing saved links just because the organizing folder
  // went away isn't a reasonable default.
  const deleteFolder = (folderId: string) => {
    const folder = entries.find((e): e is FolderItem => e.type === 'folder' && e.id === folderId);
    const rest = entries.filter((e) => !(e.type === 'folder' && e.id === folderId));
    save(folder ? [...rest, ...folder.links] : rest);
  };

  const startRenameFolder = (folder: FolderItem) => {
    setRenamingFolderId(folder.id);
    setRenameValue(folder.label);
  };

  const saveFolderRename = () => {
    if (!renameValue.trim() || !renamingFolderId) return;
    save(entries.map((e) => (e.type === 'folder' && e.id === renamingFolderId ? { ...e, label: renameValue.trim() } : e)));
    setRenamingFolderId(null);
    setRenameValue('');
  };

  const removeLink = (containerId: string, id: string) => {
    if (containerId === 'root') {
      save(entries.filter((e) => !(e.type === 'link' && e.id === id)));
    } else {
      save(entries.map((e) =>
        e.type === 'folder' && e.id === containerId ? { ...e, links: e.links.filter((l) => l.id !== id) } : e
      ));
    }
  };

  const startEdit = (link: LinkItem) => {
    setEditingId(link.id);
    setEditLabel(link.label);
    setEditUrl(link.url);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel('');
    setEditUrl('');
  };

  const saveEdit = (containerId: string) => {
    if (!editLabel.trim() || !editUrl.trim() || !editingId) return;
    const applyEdit = (l: LinkItem): LinkItem =>
      l.id === editingId
        ? { ...l, label: editLabel.trim(), url: editUrl.startsWith('http') ? editUrl.trim() : `https://${editUrl.trim()}` }
        : l;
    if (containerId === 'root') {
      save(entries.map((e) => (e.type === 'link' ? applyEdit(e) : e)));
    } else {
      save(entries.map((e) => (e.type === 'folder' && e.id === containerId ? { ...e, links: e.links.map(applyEdit) } : e)));
    }
    cancelEdit();
  };

  const commit = () => {
    if (dragSource && dropFolderId) {
      save(commitMove(entries, dragSource, { intoFolderId: dropFolderId }));
    } else if (dragSource && insertTarget) {
      save(commitMove(entries, dragSource, insertTarget));
    }
    setDragSource(null);
    setInsertTarget(null);
    setDropFolderId(null);
  };

  const handleDragStart = (containerId: string, index: number) => (e: React.DragEvent) => {
    setDragSource({ containerId, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'drag');
  };

  const handleDragEnd = () => {
    setDragSource(null);
    setInsertTarget(null);
    setDropFolderId(null);
  };

  // Plain links only get top/bottom halves — insert before or after.
  const handleLinkDragOver = (containerId: string, index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragSource) return;
    setDropFolderId(null);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const overTop = e.clientY < rect.top + rect.height / 2;
    const target = overTop ? index : index + 1;
    const isNoOp = dragSource.containerId === containerId && (target === dragSource.index || target === dragSource.index + 1);
    setInsertTarget(isNoOp ? null : { containerId, index: target });
  };

  // Folders get three zones: top edge / bottom edge insert as a sibling,
  // middle band highlights the folder itself as a "drop into" target.
  const handleFolderDragOver = (folderId: string, rootIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragSource) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const band = relY / rect.height;

    if (band < 0.25) {
      setDropFolderId(null);
      const isNoOp = dragSource.containerId === 'root' && (rootIndex === dragSource.index || rootIndex === dragSource.index + 1);
      setInsertTarget(isNoOp ? null : { containerId: 'root', index: rootIndex });
    } else if (band > 0.75) {
      setDropFolderId(null);
      const target = rootIndex + 1;
      const isNoOp = dragSource.containerId === 'root' && (target === dragSource.index || target === dragSource.index + 1);
      setInsertTarget(isNoOp ? null : { containerId: 'root', index: target });
    } else {
      setInsertTarget(null);
      // Can't drop a folder into a folder, and dropping into its own folder is a no-op.
      const draggedEntry = dragSource.containerId === 'root' ? entries[dragSource.index] : null;
      if (draggedEntry?.type === 'folder' || dragSource.containerId === folderId) {
        setDropFolderId(null);
      } else {
        setDropFolderId(folderId);
      }
    }
  };

  const handleKeyDown = (containerId: string, index: number, length: number) => (e: React.KeyboardEvent) => {
    if (!e.altKey) return;
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      save(commitMove(entries, { containerId, index }, { containerId, index: index - 1 }));
    } else if (e.key === 'ArrowDown' && index < length - 1) {
      e.preventDefault();
      save(commitMove(entries, { containerId, index }, { containerId, index: index + 2 }));
    }
  };

  const renderLinkRow = (link: LinkItem, containerId: string, index: number, listLength: number) => (
    <div
      key={link.id}
      onDragOver={handleLinkDragOver(containerId, index)}
      className={`flex items-center gap-1 group ${dragSource?.containerId === containerId && dragSource.index === index ? 'opacity-40' : ''}`}
    >
      <button
        draggable
        onDragStart={handleDragStart(containerId, index)}
        onDragEnd={handleDragEnd}
        onKeyDown={handleKeyDown(containerId, index, listLength)}
        title="Drag to reorder or move into a folder, or focus and use Alt+Up/Down"
        className="p-1 flex-shrink-0 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
      >
        <GripVertical size={14} />
      </button>
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        draggable={false}
        className="flex-1 flex items-center gap-2.5 px-3 py-2 bg-teal-50 dark:bg-slate-700 hover:bg-teal-100 dark:hover:bg-slate-600 rounded-lg transition truncate min-w-0"
      >
        <SiteIcon url={link.url} label={link.label} />
        <span className="text-sm font-medium text-teal-900 dark:text-teal-100 truncate">{link.label}</span>
      </a>
      <button onClick={() => startEdit(link)} className="p-1.5 bg-teal-100 dark:bg-slate-600 hover:bg-teal-200 dark:hover:bg-slate-500 text-teal-700 dark:text-teal-200 rounded-lg transition flex-shrink-0" title="Edit link">
        <Pencil size={13} />
      </button>
      <button onClick={() => removeLink(containerId, link.id)} className="p-1.5 bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-600 dark:text-red-300 rounded-lg transition flex-shrink-0" title="Delete link">
        <X size={13} />
      </button>
    </div>
  );

  const renderEditForm = (containerId: string) => (
    <div className="flex flex-col gap-1.5 p-2 bg-teal-50 dark:bg-slate-700 rounded-lg border border-teal-200 dark:border-slate-600">
      <input type="text" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Label" autoFocus
        className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-600 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-400" />
      <input type="text" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEdit(containerId)} placeholder="URL"
        className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-600 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-400" />
      <div className="flex gap-2">
        <button onClick={() => saveEdit(containerId)} className="flex-1 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1"><Check size={14} /> Save</button>
        <button onClick={cancelEdit} className="flex-1 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1"><X size={14} /> Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2" onDrop={(e) => { e.preventDefault(); commit(); }} onDragOver={(e) => e.preventDefault()}>

      {showInlineAdd && (
        <div className="flex flex-col gap-1.5 p-2 bg-teal-50 dark:bg-slate-700 rounded-lg border border-teal-200 dark:border-slate-600">
          {error && <p className="text-xs text-red-500">{error}</p>}
          <input type="text" placeholder="Label (e.g. GitHub)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} autoFocus
            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-600 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-400" />
          <input type="text" placeholder="URL (e.g. github.com)" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-600 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-400" />
          <div className="flex gap-2">
            <button onClick={handleAddLink} className="flex-1 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1"><Check size={14} /> Add</button>
            <button onClick={() => { setShowInlineAdd(false); setNewLabel(''); setNewUrl(''); setError(null); onUpdateConfig({ ...config, showAdd: false }); }}
              className="flex-1 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1"><X size={14} /> Cancel</button>
          </div>
        </div>
      )}

      {showAddFolder && (
        <div className="flex flex-col gap-1.5 p-2 bg-amber-50 dark:bg-slate-700 rounded-lg border border-amber-200 dark:border-slate-600">
          <input type="text" placeholder="Folder name" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()} autoFocus
            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-600 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400" />
          <div className="flex gap-2">
            <button onClick={handleAddFolder} className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1"><Check size={14} /> Create</button>
            <button onClick={() => { setShowAddFolder(false); setNewFolderName(''); }}
              className="flex-1 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1"><X size={14} /> Cancel</button>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowAddFolder(true)}
        className="self-start flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 px-1 transition"
      >
        <FolderPlus size={13} /> New folder
      </button>

      <div className="flex flex-col gap-1.5">
        {entries.map((entry, index) => (
          <React.Fragment key={entry.id}>
            {insertTarget?.containerId === 'root' && insertTarget.index === index && (
              <div className="h-0.5 mx-1 bg-blue-500 rounded-full" aria-hidden="true" />
            )}

            {entry.type === 'link' ? (
              editingId === entry.id ? renderEditForm('root') : renderLinkRow(entry, 'root', index, entries.length)
            ) : renamingFolderId === entry.id ? (
              <div className="flex flex-col gap-1.5 p-2 bg-amber-50 dark:bg-slate-700 rounded-lg border border-amber-200 dark:border-slate-600">
                <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveFolderRename()} autoFocus
                  className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-600 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400" />
                <div className="flex gap-2">
                  <button onClick={saveFolderRename} className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1"><Check size={14} /> Save</button>
                  <button onClick={() => setRenamingFolderId(null)} className="flex-1 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1"><X size={14} /> Cancel</button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={handleFolderDragOver(entry.id, index)}
                className={`flex flex-col gap-1 group/folder ${dragSource?.containerId === 'root' && dragSource.index === index ? 'opacity-40' : ''}`}
              >
                <div
                  className={`flex items-center gap-1 rounded-lg transition ${
                    dropFolderId === entry.id ? 'bg-amber-200 dark:bg-amber-900/60 ring-2 ring-amber-400' : 'bg-amber-50 dark:bg-slate-700'
                  }`}
                >
                  <button
                    draggable
                    onDragStart={handleDragStart('root', index)}
                    onDragEnd={handleDragEnd}
                    title="Drag to reorder"
                    className="p-1 pl-1.5 flex-shrink-0 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
                  >
                    <GripVertical size={14} />
                  </button>
                  <button onClick={() => toggleFolder(entry.id)} className="flex-1 flex items-center gap-2 py-2 pr-2 min-w-0 text-left">
                    {entry.expanded ? <ChevronDown size={14} className="flex-shrink-0 text-amber-600 dark:text-amber-400" /> : <ChevronRight size={14} className="flex-shrink-0 text-amber-600 dark:text-amber-400" />}
                    {entry.expanded ? <FolderOpen size={18} className="flex-shrink-0 text-amber-600 dark:text-amber-400" /> : <Folder size={18} className="flex-shrink-0 text-amber-600 dark:text-amber-400" />}
                    <span className="text-sm font-semibold text-amber-900 dark:text-amber-100 truncate">{entry.label}</span>
                    <span className="text-xs text-amber-500 dark:text-amber-400 flex-shrink-0">({entry.links.length})</span>
                  </button>
                  <button onClick={() => startRenameFolder(entry)} className="p-1.5 mr-1 text-amber-600 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-slate-600 rounded-lg transition flex-shrink-0" title="Rename folder">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => deleteFolder(entry.id)} className="p-1.5 mr-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition flex-shrink-0" title="Delete folder (keeps its links)">
                    <X size={13} />
                  </button>
                </div>

                {entry.expanded && (
                  <div className="flex flex-col gap-1.5 pl-5 border-l-2 border-amber-200 dark:border-slate-600 ml-3">
                    {entry.links.length === 0 ? (
                      <div className="text-xs text-gray-400 dark:text-gray-500 italic py-1 px-2">Drag links here</div>
                    ) : (
                      entry.links.map((link, linkIndex) => (
                        <React.Fragment key={link.id}>
                          {insertTarget?.containerId === entry.id && insertTarget.index === linkIndex && (
                            <div className="h-0.5 mx-1 bg-blue-500 rounded-full" aria-hidden="true" />
                          )}
                          {editingId === link.id ? renderEditForm(entry.id) : renderLinkRow(link, entry.id, linkIndex, entry.links.length)}
                        </React.Fragment>
                      ))
                    )}
                    {insertTarget?.containerId === entry.id && insertTarget.index === entry.links.length && (
                      <div className="h-0.5 mx-1 bg-blue-500 rounded-full" aria-hidden="true" />
                    )}
                  </div>
                )}
              </div>
            )}
          </React.Fragment>
        ))}
        {insertTarget?.containerId === 'root' && insertTarget.index === entries.length && (
          <div className="h-0.5 mx-1 bg-blue-500 rounded-full" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
