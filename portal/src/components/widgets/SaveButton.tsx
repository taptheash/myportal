import React from 'react';
import { Bookmark } from 'lucide-react';
import { useSavedLinks, toggleSavedArticle } from '../../lib/savedArticles';

// Bookmark toggle shown on every news article. Sits inside the article's
// link, so it stops the click from also opening the article.
export default function SaveButton({ article, size = 14 }: { article: { link: string; title: string; source?: string }; size?: number }) {
  const saved = useSavedLinks().has(article.link);
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSavedArticle(article); }}
      title={saved ? 'Remove from Saved' : 'Save for later'}
      aria-pressed={saved}
      className={`flex-shrink-0 mt-0.5 transition-colors duration-150 ${
        saved ? 'text-indigo-500 dark:text-indigo-400' : 'text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-indigo-500'
      }`}
    >
      <Bookmark size={size} fill={saved ? 'currentColor' : 'none'} />
    </button>
  );
}
