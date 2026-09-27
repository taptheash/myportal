import React from 'react';
import { ExternalLink, X, Bookmark } from 'lucide-react';
import { SavedArticle, removeSavedArticle } from '../../lib/savedArticles';

interface SavedProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

// Articles bookmarked from any News tab, newest first. They stay until you
// remove them.
export default function SavedArticles({ config }: SavedProps) {
  const items: SavedArticle[] = Array.isArray(config.items) ? config.items : [];

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
        <Bookmark size={20} />
        <p>Nothing saved yet.</p>
        <p className="text-xs">Hover any article in News and click its bookmark icon to keep it here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((a) => (
        <div key={a.link} className="group flex items-stretch gap-1">
          <a href={a.link} target="_blank" rel="noopener noreferrer"
            className="surface-card flex-1 min-w-0 block p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl border-l-4 border-indigo-500 transition-all duration-150">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-zinc-900 dark:text-white text-sm line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-150">{a.title}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                  {a.source ? `${a.source} • ` : ''}saved {new Date(a.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <ExternalLink size={14} className="flex-shrink-0 text-zinc-400 mt-1" />
            </div>
          </a>
          <button
            onClick={() => removeSavedArticle(a.link)}
            title="Remove from Saved"
            className="px-2 rounded-lg text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-150"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center mt-1">{items.length} saved</p>
    </div>
  );
}
