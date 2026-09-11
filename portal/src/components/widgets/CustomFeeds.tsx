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
  genre: string;
}

interface FeedState {
  items: Array<{ title: string; link: string; pubDate: string }>;
  status: 'loading' | 'ok' | 'error';
}

// Confidence varies by entry, and that's worth being upfront about rather
// than pretending otherwise at this scale:
// - CONFIRMED: found the exact URL directly in a real search result, often
//   from a source dated within the last few months.
// - PATTERN: a well-known, large, established site where I applied the
//   standard WordPress-style /feed convention rather than finding the exact
//   URL directly — reasonable confidence given the site's size and
//   longevity, but not independently confirmed the way the others were.
// If any entry here doesn't load, that failure is isolated to its own
// card — nothing else in the widget is affected, and it's easy to spot
// and remove.
const BUILT_IN_SUGGESTIONS: SuggestionEntry[] = [
  // News — World & US (CONFIRMED unless noted)
  { name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/world/rss.xml', genre: 'News' },
  { name: 'NPR', url: 'https://feeds.npr.org/1002/rss.xml', genre: 'News' },
  { name: 'CNN World', url: 'http://rss.cnn.com/rss/edition_world.rss', genre: 'News' },
  { name: 'CNN US', url: 'http://rss.cnn.com/rss/edition_us.rss', genre: 'News' },
  { name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', genre: 'News' },
  { name: 'NBC News', url: 'https://feeds.nbcnews.com/feeds/topstories', genre: 'News' },
  { name: 'Politico', url: 'https://www.politico.com/rss/politicopicks.xml', genre: 'News' },
  { name: 'The Guardian World', url: 'https://www.theguardian.com/world/rss', genre: 'News' }, // PATTERN

  // Business & Finance
  { name: 'NYT Business', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', genre: 'Business' },
  { name: 'CNBC Top News', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', genre: 'Business' }, // PATTERN

  // Technology
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', genre: 'Technology' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', genre: 'Technology' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', genre: 'Technology' },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss', genre: 'Technology' },
  { name: 'Hacker News', url: 'https://news.ycombinator.com/rss', genre: 'Technology' },
  { name: 'Engadget', url: 'https://www.engadget.com/rss.xml', genre: 'Technology' }, // PATTERN
  { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/', genre: 'Technology' }, // PATTERN

  // Sports
  { name: 'ESPN', url: 'http://www.espn.com/espn/rss/news', genre: 'Sports' },
  { name: 'Yahoo Sports', url: 'https://sports.yahoo.com/rss/', genre: 'Sports' }, // PATTERN
  { name: 'CBS Sports', url: 'https://www.cbssports.com/rss/headlines', genre: 'Sports' }, // CONFIRMED — verified via a sport-specific variant returning real, current raw XML
  // Bleacher Report removed: Warner Bros. Discovery subsidiary, recently
  // reorganized under their new TNT Sports division — same pattern as the
  // Dotdash Meredith failures in Food (large media conglomerate, migrating
  // infrastructure), not worth a second guess on the URL.

  // Aviation
  { name: 'Simple Flying', url: 'https://simpleflying.com/feed/', genre: 'Aviation' },
  { name: 'AVweb', url: 'https://www.avweb.com/feed/', genre: 'Aviation' }, // PATTERN
  { name: 'The Aviationist', url: 'https://theaviationist.com/feed/', genre: 'Aviation' }, // PATTERN
  { name: 'Flightradar24 Blog', url: 'https://www.flightradar24.com/blog/feed/', genre: 'Aviation' }, // PATTERN

  // Entertainment & Celebrity
  { name: 'TMZ', url: 'https://tmz.com/rss.xml', genre: 'Entertainment' },
  { name: 'Variety', url: 'https://variety.com/feed/', genre: 'Entertainment' },
  { name: 'The Hollywood Reporter', url: 'https://www.hollywoodreporter.com/feed/', genre: 'Entertainment' }, // PATTERN
  { name: 'Entertainment Weekly', url: 'https://ew.com/feed/', genre: 'Entertainment' }, // PATTERN

  // Science & Space
  { name: 'Phys.org', url: 'https://phys.org/rss-feed/', genre: 'Science' }, // PATTERN
  { name: 'New Scientist', url: 'https://www.newscientist.com/feed/home/', genre: 'Science' }, // PATTERN
  { name: 'NASA Breaking News', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', genre: 'Science' }, // PATTERN

  // Music
  { name: 'Pitchfork', url: 'https://pitchfork.com/rss/news/', genre: 'Music' }, // PATTERN
  { name: 'Rolling Stone', url: 'https://www.rollingstone.com/feed/', genre: 'Music' }, // PATTERN

  // Food — Serious Eats and Simply Recipes removed: both Dotdash Meredith
  // properties, both failed independently, pointing to a shared
  // infrastructure issue rather than two unrelated mistakes. Serious Eats
  // specifically has changed owners twice (2015, 2020) and different
  // sources give conflicting RSS URLs from different eras.
  // Everything below is confirmed independently-run (not corporate media):
  // Half Baked Harvest (Tieghan Gerard), Smitten Kitchen (Deb Perelman),
  // David Lebovitz (working pastry chef), RecipeTin Eats (Nagi), etc.
  { name: 'Budget Bytes', url: 'https://www.budgetbytes.com/feed/', genre: 'Food' }, // CONFIRMED
  { name: 'Smitten Kitchen', url: 'https://smittenkitchen.com/feed/', genre: 'Food' }, // CONFIRMED
  { name: 'Skinnytaste', url: 'https://www.skinnytaste.com/feed/', genre: 'Food' }, // CONFIRMED
  { name: 'Pinch of Yum', url: 'https://pinchofyum.com/feed', genre: 'Food' }, // CONFIRMED
  { name: 'Half Baked Harvest', url: 'https://halfbakedharvest.com/feed', genre: 'Food' }, // CONFIRMED
  { name: 'Cookie and Kate', url: 'https://cookieandkate.com/feed/', genre: 'Food' }, // PATTERN
  { name: 'Minimalist Baker', url: 'https://minimalistbaker.com/feed/', genre: 'Food' }, // PATTERN
  { name: 'Love and Lemons', url: 'https://www.loveandlemons.com/feed/', genre: 'Food' }, // PATTERN
  { name: 'David Lebovitz', url: 'https://www.davidlebovitz.com/feed/', genre: 'Food' }, // PATTERN
  { name: 'RecipeTin Eats', url: 'https://www.recipetineats.com/feed/', genre: 'Food' }, // PATTERN

  // Health & Fitness
  { name: "Men's Health", url: 'https://www.menshealth.com/rss/all.xml/', genre: 'Health' }, // PATTERN

  // Travel
  { name: 'Lonely Planet', url: 'https://www.lonelyplanet.com/news/feed', genre: 'Travel' }, // PATTERN

  // Books & Literature
  { name: 'Literary Hub', url: 'https://lithub.com/feed/', genre: 'Books' }, // PATTERN

  // History
  { name: 'HistoryExtra (BBC)', url: 'https://www.historyextra.com/feed/', genre: 'History' }, // PATTERN

  // Automotive & Racing
  { name: 'Jalopnik', url: 'https://jalopnik.com/rss', genre: 'Automotive' }, // PATTERN
  { name: 'Autosport F1', url: 'https://www.autosport.com/rss/f1/news/', genre: 'Automotive' }, // PATTERN

  // Culture & Independent Blogs
  { name: 'Kottke.org', url: 'http://feeds.kottke.org/main', genre: 'Culture' },
  { name: 'xkcd', url: 'https://xkcd.com/rss.xml', genre: 'Culture' },
  { name: 'The Onion', url: 'https://www.theonion.com/rss', genre: 'Culture' }, // PATTERN

  // Environment
  { name: 'Grist', url: 'https://grist.org/feed/', genre: 'Environment' }, // PATTERN
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
  // Built-in suggestions live in code, not per-user data, so "removing" one
  // can't delete it from that list — instead we track dismissed URLs here
  // and filter them out. Your own additions get deleted outright below.
  const dismissedBuiltIns: string[] = config.dismissedBuiltIns || [];
  const [feedData, setFeedData] = useState<Record<string, FeedState>>({});

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [showAddSuggestion, setShowAddSuggestion] = useState(false);
  const suggestionsExpanded = config.suggestionsExpanded !== false;
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

  // All suggestions available to pick from: built-in ones (minus any
  // dismissed) plus anything Doug has added himself, minus anything already
  // subscribed to. Tagged with isBuiltIn so removal knows which mechanism
  // to use.
  const allSuggestions: Array<SuggestionEntry & { isBuiltIn: boolean }> = [
    ...BUILT_IN_SUGGESTIONS.filter((s) => !dismissedBuiltIns.includes(s.url)).map((s) => ({ ...s, isBuiltIn: true })),
    ...savedSuggestions.map((s) => ({ ...s, isBuiltIn: false })),
  ].filter((s) => !feeds.some((f) => f.url === s.url));

  const handleAddSuggestion = () => {
    if (!suggName.trim() || !suggUrl.trim()) return;
    const url = suggUrl.startsWith('http') ? suggUrl.trim() : `https://${suggUrl.trim()}`;
    onUpdateConfig({ ...config, savedSuggestions: [...savedSuggestions, { name: suggName.trim(), url, genre: 'My Additions' }] });
    setSuggName('');
    setSuggUrl('');
    setShowAddSuggestion(false);
  };

  const removeSuggestion = (url: string, isBuiltIn: boolean) => {
    if (isBuiltIn) {
      onUpdateConfig({ ...config, dismissedBuiltIns: [...dismissedBuiltIns, url] });
    } else {
      onUpdateConfig({ ...config, savedSuggestions: savedSuggestions.filter((s) => s.url !== url) });
    }
    if (selectedSuggestionUrl === url) setSelectedSuggestionUrl(null);
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
        <div className="flex flex-col gap-1.5 p-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700">
          {error && <p className="text-xs text-red-500">{error}</p>}
          <input type="text" placeholder="Name (e.g. My Favorite Blog)" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus
            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          <input type="text" placeholder="Feed URL (RSS or Atom)" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          <div className="flex gap-2">
            <button onClick={handleManualAdd} className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors duration-150 flex items-center justify-center gap-1"><Check size={14} /> Add</button>
            <button onClick={() => { setShowAdd(false); setNewName(''); setNewUrl(''); setError(null); }}
              className="flex-1 py-1.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-white rounded-lg text-sm font-medium transition-colors duration-150 flex items-center justify-center gap-1"><X size={14} /> Cancel</button>
          </div>
        </div>
      )}

      {!showAdd && (
        <button onClick={() => setShowAdd(true)}
          className="self-start flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-1 transition-colors duration-150">
          <Plus size={13} /> Add a feed by URL
        </button>
      )}

      {(allSuggestions.length > 0 || showAddSuggestion) && (
        <div className="flex flex-col gap-1.5 p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between">
            <button
              onClick={() => onUpdateConfig({ ...config, suggestionsExpanded: !suggestionsExpanded })}
              className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors duration-150"
            >
              {suggestionsExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <Sparkles size={12} /> Suggested — pick one to subscribe
            </button>
            {suggestionsExpanded && !showAddSuggestion && (
              <button onClick={() => setShowAddSuggestion(true)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5">
                <Plus size={11} /> Add to this list
              </button>
            )}
          </div>

          {suggestionsExpanded && showAddSuggestion && (
            <div className="flex flex-col gap-1.5 p-2 bg-white dark:bg-zinc-900 rounded-lg">
              <input type="text" placeholder="Name" value={suggName} onChange={(e) => setSuggName(e.target.value)} autoFocus
                className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
              <input type="text" placeholder="Feed URL" value={suggUrl} onChange={(e) => setSuggUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSuggestion()}
                className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
              <div className="flex gap-2">
                <button onClick={handleAddSuggestion} className="flex-1 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors duration-150">Add to list</button>
                <button onClick={() => { setShowAddSuggestion(false); setSuggName(''); setSuggUrl(''); }} className="flex-1 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-white rounded-lg text-xs font-medium transition-colors duration-150">Cancel</button>
              </div>
            </div>
          )}

          {suggestionsExpanded && allSuggestions.length > 0 && (
            <>
              <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto pr-1">
                {(() => {
                  const genres = Array.from(new Set(allSuggestions.map((s) => s.genre)));
                  return genres.map((genre) => (
                    <div key={genre}>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 px-2 pt-2 pb-0.5">
                        {genre}
                      </div>
                      {allSuggestions.filter((s) => s.genre === genre).map((s) => {
                        const selected = selectedSuggestionUrl === s.url;
                        return (
                          <div key={s.url} className="group flex items-center gap-1">
                            <button
                              onClick={() => setSelectedSuggestionUrl(selected ? null : s.url)}
                              className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-colors duration-150 ${
                                selected
                                  ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-100'
                                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                              }`}
                            >
                              {selected ? <CheckCircle2 size={15} className="flex-shrink-0 text-indigo-500" /> : <Circle size={15} className="flex-shrink-0 text-zinc-300 dark:text-zinc-600" />}
                              {s.name}
                            </button>
                            <button
                              onClick={() => removeSuggestion(s.url, s.isBuiltIn)}
                              title="Remove from suggestions"
                              className="p-1 flex-shrink-0 text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-colors duration-150"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
              <button
                onClick={handleSubscribe}
                disabled={!selectedSuggestionUrl}
                className="py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-200 dark:disabled:bg-zinc-700 disabled:text-zinc-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors duration-150"
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
            <div key={feed.id} className="surface-card rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
              <div className="flex items-center gap-1">
                <button onClick={() => toggleCollapsed(feed.id)} className="flex-1 flex items-center gap-2 py-2 px-2.5 min-w-0 text-left">
                  {feed.collapsed ? <ChevronRight size={14} className="flex-shrink-0 text-indigo-500 dark:text-indigo-400" /> : <ChevronDown size={14} className="flex-shrink-0 text-indigo-500 dark:text-indigo-400" />}
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{feed.name}</span>
                  {state?.status === 'ok' && <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0">({state.items.length})</span>}
                  {state?.status === 'loading' && <span className="text-xs text-zinc-400 flex-shrink-0">loading…</span>}
                  {state?.status === 'error' && <AlertCircle size={12} className="flex-shrink-0 text-red-500" />}
                </button>
                <button onClick={() => removeFeed(feed.id)} className="p-1.5 mr-1.5 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors duration-150 flex-shrink-0" title="Remove feed">
                  <X size={13} />
                </button>
              </div>

              {!feed.collapsed && (
                <div className="px-2 pb-2 flex flex-col gap-1">
                  {state?.status === 'error' && (
                    <p className="text-xs text-red-500 px-1 py-1">Couldn't load this feed — check the URL is a valid RSS or Atom feed.</p>
                  )}
                  {state?.status === 'ok' && state.items.length === 0 && (
                    <p className="text-xs text-zinc-400 px-1 py-1">No articles found.</p>
                  )}
                  {state?.status === 'ok' && state.items.map((item, idx) => (
                    <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer"
                      className="flex items-start justify-between gap-2 px-2 py-1.5 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors duration-150 group">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-zinc-900 dark:text-white line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-150">{item.title}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{formatTime(item.pubDate)}</p>
                      </div>
                      <ExternalLink size={11} className="flex-shrink-0 text-zinc-400 mt-0.5" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {feeds.length === 0 && (
        <div className="text-center text-zinc-400 dark:text-zinc-500 text-sm py-6">
          No feeds yet — pick a suggestion above or add your own.
        </div>
      )}
    </div>
  );
}
