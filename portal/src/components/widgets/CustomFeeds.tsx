import React, { useState, useEffect } from 'react';
import { Plus, X, Check, ChevronDown, ChevronRight, ExternalLink, AlertCircle, Sparkles, Circle, CheckCircle2 } from 'lucide-react';
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

interface SuggestionEntry {
  name: string;
  url: string;
}

interface FeedState {
  items: Array<{ title: string; link: string; pubDate: string }>;
  status: 'loading' | 'ok' | 'error';
}

// AP News was removed — verified it no longer offers a native RSS feed at
// all (confirmed via a third-party project built specifically to work
// around that gap), not just a URL that needed fixing.
// Kept deliberately short and mixed rather than all-news: Hacker News, BBC,
// NPR, TechCrunch, The Verge, and Ars Technica are all verified working
// elsewhere in this project; Kottke.org (running since 1998, confirmed
// actively posting days ago) and xkcd are genuinely different in kind —
// independent blog and webcomic, not news at all.
const BUILT_IN_SUGGESTIONS: SuggestionEntry[] = [
  { name: 'Hacker News', url: 'https://news.ycombinator.com/rss' },
  { name: 'Kottke.org', url: 'http://feeds.kottke.org/main' },
  { name: 'xkcd', url: 'https://xkcd.com/rss.xml' },
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
  const savedSuggestions: SuggestionEntry[] = config.savedSuggestions || [];
  const [feedData, setFeedData] = useState<Record<string, FeedState>>({});

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [showAddSuggestion, setShowAddSuggestion] = useState(false);
  const [suggName, setSuggName] = useState('');
  const [suggUrl, setSuggUrl] = useState('');
  const [selectedSuggestionUrl, setSelectedSuggestionUrl] = useState<string | null>(null);

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

  const addFeed = (name: string, url: string) => {
    const feed: CustomFeed = { id: `feed${Date.now()}`, name, url, collapsed: false };
    onUpdateConfig({ ...config, feeds: [...feeds, feed] });
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

  const removeFeed = (id: string) => onUpdateConfig({ ...config, feeds: feeds.filter((f) => f.id !== id) });

  const toggleCollapsed = (id: string) =>
    onUpdateConfig({ ...config, feeds: feeds.map((f) => (f.id === id ? { ...f, collapsed: !f.collapsed } : f)) });

  // All suggestions available to pick from: built-in ones plus anything
  // Doug has added himself, minus anything already subscribed to.
  const allSuggestions: SuggestionEntry[] = [...BUILT_IN_SUGGESTIONS, ...savedSuggestions].filter(
    (s) => !feeds.some((f) => f.url === s.url)
  );

  const handleAddSuggestion = () => {
    if (!suggName.trim() || !suggUrl.trim()) return;
    const url = suggUrl.startsWith('http') ? suggUrl.trim() : `https://${suggUrl.trim()}`;
    onUpdateConfig({ ...config, savedSuggestions: [...savedSuggestions, { name: suggName.trim(), url }] });
    setSuggName('');
    setSuggUrl('');
    setShowAddSuggestion(false);
  };

  const handleSubscribe = () => {
    const picked = allSuggestions.find((s) => s.url === selectedSuggestionUrl);
    if (!picked) return;
    addFeed(picked.name, picked.url);
    setSelectedSuggestionUrl(null);
  };

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

      {(allSuggestions.length > 0 || showAddSuggestion) && (
        <div className="flex flex-col gap-1.5 p-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <Sparkles size={12} /> Suggested — pick one to subscribe
            </div>
            {!showAddSuggestion && (
              <button onClick={() => setShowAddSuggestion(true)} className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-0.5">
                <Plus size={11} /> Add to this list
              </button>
            )}
          </div>

          {showAddSuggestion && (
            <div className="flex flex-col gap-1.5 p-2 bg-white dark:bg-slate-800 rounded-lg">
              <input type="text" placeholder="Name" value={suggName} onChange={(e) => setSuggName(e.target.value)} autoFocus
                className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-600 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-400" />
              <input type="text" placeholder="Feed URL" value={suggUrl} onChange={(e) => setSuggUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSuggestion()}
                className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-600 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-400" />
              <div className="flex gap-2">
                <button onClick={handleAddSuggestion} className="flex-1 py-1 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs font-semibold transition">Add to list</button>
                <button onClick={() => { setShowAddSuggestion(false); setSuggName(''); setSuggUrl(''); }} className="flex-1 py-1 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg text-xs font-semibold transition">Cancel</button>
              </div>
            </div>
          )}

          {allSuggestions.length > 0 && (
            <>
              <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                {allSuggestions.map((s) => {
                  const selected = selectedSuggestionUrl === s.url;
                  return (
                    <button
                      key={s.url}
                      onClick={() => setSelectedSuggestionUrl(selected ? null : s.url)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition ${
                        selected
                          ? 'bg-sky-100 dark:bg-sky-900/40 text-sky-900 dark:text-sky-100'
                          : 'hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {selected ? <CheckCircle2 size={15} className="flex-shrink-0 text-sky-500" /> : <Circle size={15} className="flex-shrink-0 text-gray-300 dark:text-gray-600" />}
                      {s.name}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={handleSubscribe}
                disabled={!selectedSuggestionUrl}
                className="py-1.5 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-200 dark:disabled:bg-slate-600 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition"
              >
                Subscribe
              </button>
            </>
          )}
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
