import React, { useState, useEffect } from 'react';
import { Plus, X, Check, ChevronDown, ChevronRight, ExternalLink, AlertCircle, Sparkles } from 'lucide-react';
import { fetchRssWithCache } from '../../lib/rssCache';

interface CustomFeedsProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface CustomFeed {
  id: string;
  name: string;
  url: string;
  collapsed: boolean;
}

interface FeedState {
  items: Array<{ title: string; link: string; pubDate: string }>;
  status: 'loading' | 'ok' | 'error';
}

// Deliberately short. Every one of these is either verified working earlier
// in this project, or (Hacker News) established enough that its feed URL
// hasn't changed in over a decade. Not trying to be a full directory —
// Doug can add anything else himself (Substack: append /feed to any
// publication's URL; WordPress blogs: usually {site}/feed/).
const SUGGESTED_FEEDS: { name: string; url: string }[] = [
  { name: 'Hacker News', url: 'https://news.ycombinator.com/rss' },
  { name: 'AP News', url: 'https://apnews.com/hub/ap-top-news.rss' },
  { name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'NPR', url: 'https://feeds.npr.org/1002/rss.xml' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
];

function formatTime(pubDate: string): string {
  const date = new Date(pubDate.replace(' ', 'T') + 'Z');
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function CustomFeeds({ config, onUpdateConfig }: CustomFeedsProps) {
  const feeds: CustomFeed[] = config.feeds || [];
  const [feedData, setFeedData] = useState<Record<string, FeedState>>({});

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const feedsKey = feeds.map((f) => f.id).join(',');

  useEffect(() => {
    let cancelled = false;

    setFeedData((prev) => {
      const next: Record<string, FeedState> = {};
      feeds.forEach((f) => { next[f.id] = prev[f.id] ?? { items: [], status: 'loading' }; });
      return next;
    });

    const fetchFeed = async (feed: CustomFeed) => {
      try {
        const items = await fetchRssWithCache(`custom-feed-${feed.id}`, feed.url, 15, 3600000);
        if (!cancelled) setFeedData((prev) => ({ ...prev, [feed.id]: { items, status: 'ok' } }));
      } catch {
        if (!cancelled) setFeedData((prev) => ({ ...prev, [feed.id]: { items: [], status: 'error' } }));
      }
    };

    feeds.forEach((f) => fetchFeed(f));
    const interval = setInterval(() => feeds.forEach((f) => fetchFeed(f)), 3600000);
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedsKey]);

  const save = (updated: CustomFeed[]) => onUpdateConfig({ ...config, feeds: updated });

  const addFeed = (name: string, url: string) => {
    const feed: CustomFeed = { id: `feed${Date.now()}`, name, url, collapsed: false };
    save([...feeds, feed]);
  };

  const handleManualAdd = () => {
    if (!newName.trim() || !newUrl.trim()) {
      setError('Both fields are required');
      return;
    }
    addFeed(newName.trim(), newUrl.startsWith('http') ? newUrl.trim() : `https://${newUrl.trim()}`);
    setNewName('');
    setNewUrl('');
    setShowAdd(false);
    setError(null);
  };

  const removeFeed = (id: string) => save(feeds.filter((f) => f.id !== id));

  const toggleCollapsed = (id: string) =>
    save(feeds.map((f) => (f.id === id ? { ...f, collapsed: !f.collapsed } : f)));

  const availableSuggestions = SUGGESTED_FEEDS.filter(
    (s) => !feeds.some((f) => f.url === s.url)
  );

  return (
    <div className="flex flex-col gap-2">
      {showAdd && (
        <div className="flex flex-col gap-1.5 p-2 bg-sky-50 dark:bg-slate-700 rounded-lg border border-sky-200 dark:border-slate-600">
          {error && <p className="text-xs text-red-500">{error}</p>}
          <input type="text" placeholder="Name (e.g. My Favorite Blog)" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus
            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-600 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-400" />
          <input type="text" placeholder="Feed URL (RSS or Atom)" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-600 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-400" />
          <div className="flex gap-2">
            <button onClick={handleManualAdd} className="flex-1 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1"><Check size={14} /> Add</button>
            <button onClick={() => { setShowAdd(false); setNewName(''); setNewUrl(''); setError(null); }}
              className="flex-1 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1"><X size={14} /> Cancel</button>
          </div>
        </div>
      )}

      {!showAdd && (
        <button onClick={() => setShowAdd(true)}
          className="self-start flex items-center gap-1 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:text-sky-900 dark:hover:text-sky-100 px-1 transition">
          <Plus size={13} /> Add a feed by URL
        </button>
      )}

      {availableSuggestions.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 px-1">
            <Sparkles size={12} /> Suggested
          </div>
          <div className="flex flex-wrap gap-1.5">
            {availableSuggestions.map((s) => (
              <button
                key={s.url}
                onClick={() => addFeed(s.name, s.url)}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-sky-50 dark:bg-slate-700 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-slate-600 border border-sky-200 dark:border-slate-600 transition"
              >
                <Plus size={11} /> {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5 mt-1">
        {feeds.map((feed) => {
          const state = feedData[feed.id];
          return (
            <div key={feed.id} className="rounded-lg overflow-hidden bg-sky-50 dark:bg-slate-700">
              <div className="flex items-center gap-1">
                <button onClick={() => toggleCollapsed(feed.id)} className="flex-1 flex items-center gap-2 py-2 px-2.5 min-w-0 text-left">
                  {feed.collapsed ? <ChevronRight size={14} className="flex-shrink-0 text-sky-600 dark:text-sky-400" /> : <ChevronDown size={14} className="flex-shrink-0 text-sky-600 dark:text-sky-400" />}
                  <span className="text-sm font-semibold text-sky-900 dark:text-sky-100 truncate">{feed.name}</span>
                  {state?.status === 'ok' && <span className="text-xs text-sky-500 dark:text-sky-400 flex-shrink-0">({state.items.length})</span>}
                  {state?.status === 'loading' && <span className="text-xs text-gray-400 flex-shrink-0">loading…</span>}
                  {state?.status === 'error' && <AlertCircle size={12} className="flex-shrink-0 text-red-500" />}
                </button>
                <button onClick={() => removeFeed(feed.id)} className="p-1.5 mr-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition flex-shrink-0" title="Remove feed">
                  <X size={13} />
                </button>
              </div>

              {!feed.collapsed && (
                <div className="px-2 pb-2 flex flex-col gap-1">
                  {state?.status === 'error' && (
                    <p className="text-xs text-red-500 px-1 py-1">Couldn't load this feed — check the URL is a valid RSS or Atom feed.</p>
                  )}
                  {state?.status === 'ok' && state.items.length === 0 && (
                    <p className="text-xs text-gray-400 px-1 py-1">No articles found.</p>
                  )}
                  {state?.status === 'ok' && state.items.map((item, idx) => (
                    <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer"
                      className="flex items-start justify-between gap-2 px-2 py-1.5 bg-white dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-600 rounded-md transition group">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-900 dark:text-white line-clamp-2 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition">{item.title}</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{formatTime(item.pubDate)}</p>
                      </div>
                      <ExternalLink size={11} className="flex-shrink-0 text-gray-400 mt-0.5" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {feeds.length === 0 && (
        <div className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">
          No feeds yet — pick a suggestion above or add your own.
        </div>
      )}
    </div>
  );
}
