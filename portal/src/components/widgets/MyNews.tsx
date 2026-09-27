import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, AlertCircle, Settings2, Check } from 'lucide-react';
import { allCategories, fetchCategories, DEFAULT_MY_NEWS, TaggedArticle } from '../../lib/newsCategories';
import FeedHealth from './FeedHealth';
import SaveButton from './SaveButton';

interface MyNewsProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

// One combined feed from the News categories you pick (plus any custom
// feeds). Uses the same caches as the category tabs, so it adds little
// extra fetching.
export default function MyNews({ config, onUpdateConfig }: MyNewsProps) {
  const selected: string[] = Array.isArray(config.categories) ? config.categories : DEFAULT_MY_NEWS;
  const articleCount = config.articleCount || 20;
  const [articles, setArticles] = useState<TaggedArticle[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const lastNonceRef = useRef(config.refreshNonce);
  const selectedKey = selected.join(',');

  const configRef = useRef(config);
  configRef.current = config;
  const onUpdateRef = useRef(onUpdateConfig);
  onUpdateRef.current = onUpdateConfig;

  useEffect(() => {
    const force = config.refreshNonce !== undefined && config.refreshNonce !== lastNonceRef.current;
    lastNonceRef.current = config.refreshNonce;
    let cancelled = false;
    const run = async (f: boolean) => {
      setLoading(true);
      const res = await fetchCategories(selected, f);
      if (cancelled) return;
      setArticles(res.articles);
      setFailed(res.failed);
      setLoading(false);
      const shown = Math.min(res.articles.length, articleCount);
      if (configRef.current.lastFetchedCount !== shown) {
        onUpdateRef.current({ ...configRef.current, lastFetchedCount: shown });
      }
    };
    run(force);
    const interval = setInterval(() => run(false), 3600000);
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, articleCount, config.refreshNonce]);

  const toggleCategory = (key: string) => {
    const next = selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
    onUpdateConfig({ ...config, categories: next });
  };

  const formatTime = (pubDate: string) => {
    const date = new Date(pubDate.replace(' ', 'T') + 'Z');
    const diffMins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const cats = allCategories();
  const shown = articles.slice(0, articleCount);
  const selectedSources = cats.filter((c) => selected.includes(c.key)).flatMap((c) => c.sources);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
          {selected.length === 0
            ? 'No categories picked yet'
            : cats.filter((c) => selected.includes(c.key)).map((c) => c.label).join(' · ')}
        </p>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-150 flex-shrink-0"
          title="Choose which categories feed My News"
        >
          <Settings2 size={12} /> Choose categories
        </button>
      </div>

      {showSettings && (
        <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 grid grid-cols-2 gap-1">
          {cats.map((c) => {
            const on = selected.includes(c.key);
            return (
              <button
                key={c.key}
                onClick={() => toggleCategory(c.key)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left transition-colors duration-150 ${
                  on ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:bg-white/60 dark:hover:bg-zinc-900/60'
                }`}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-zinc-300 dark:border-zinc-600'}`}>
                  {on && <Check size={11} />}
                </span>
                <span className="truncate">{c.label}{c.key.startsWith('custom:') ? ' (feed)' : ''}</span>
              </button>
            );
          })}
        </div>
      )}

      {loading && articles.length === 0 && (
        <div className="flex items-center justify-center h-24"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div></div>
      )}

      {!loading && failed.length > 0 && (
        <div className="flex items-center gap-1.5 px-1 text-[11px] text-amber-600 dark:text-amber-400">
          <AlertCircle size={12} /> Couldn't load: {failed.join(', ')}
        </div>
      )}

      {!loading && shown.length === 0 && (
        <div className="text-center text-zinc-400 dark:text-zinc-500 text-sm py-6">
          {selected.length === 0 ? 'Pick some categories with "Choose categories" above.' : 'No articles right now.'}
        </div>
      )}

      {shown.map((article) => (
        <a key={article.link || article.title} href={article.link} target="_blank" rel="noopener noreferrer"
          className="surface-card block p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl border-l-4 border-indigo-500 transition-all duration-150 group">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-zinc-900 dark:text-white text-sm line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-150">{article.title}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="px-1.5 py-px rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 flex-shrink-0">{article.categoryLabel}</span>
                <span className="truncate">{article.sourceName}</span>
                <span>•</span>
                <span className="flex-shrink-0">{formatTime(article.pubDate)}</span>
              </div>
            </div>
            <SaveButton article={{ link: article.link, title: article.title, source: article.sourceName }} />
            <ExternalLink size={14} className="flex-shrink-0 text-zinc-400 mt-1" />
          </div>
        </a>
      ))}

      {selectedSources.length > 0 && <FeedHealth sources={selectedSources} />}
    </div>
  );
}
