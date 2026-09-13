import React, { useState, useEffect } from 'react';
import { ExternalLink, AlertCircle, Plus, X, Circle, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import { fetchMergedRssWithCache, NewsSource } from '../../lib/rssCache';

interface RedditPopularProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface NewsItem { title: string; link: string; pubDate: string; sourceName: string; }

interface Subreddit {
  name: string;      // display name, e.g. "r/popular"
  slug: string;       // the part after r/, e.g. "popular"
}

// Reddit's public .rss endpoints survived their 2023 API pricing changes —
// it was specifically the paid oauth.reddit.com JSON API that got
// expensive; www.reddit.com/r/<sub>/.rss remains free and public.
// "popular" and "all" aren't real subreddits — they're Reddit's own
// cross-subreddit aggregates — but the /r/<name>/.rss URL pattern works
// identically for them, so they're handled the same way as any other slug
// here rather than needing special-casing.
function subredditUrl(slug: string): string {
  return `https://www.reddit.com/r/${slug}/.rss`;
}

const DEFAULT_SUBREDDITS: Subreddit[] = [
  { name: 'r/popular', slug: 'popular' },
  { name: 'r/outoftheloop', slug: 'outoftheloop' },
];

// A handful of well-known, active subreddits offered as one-click suggestions.
// Not exhaustive — Doug can add any subreddit by name below.
const SUGGESTED_SUBREDDITS: Subreddit[] = [
  { name: 'r/all', slug: 'all' },
  { name: 'r/todayilearned', slug: 'todayilearned' },
  { name: 'r/worldnews', slug: 'worldnews' },
  { name: 'r/technology', slug: 'technology' },
  { name: 'r/science', slug: 'science' },
  { name: 'r/askreddit', slug: 'askreddit' },
  { name: 'r/interestingasfuck', slug: 'interestingasfuck' },
  { name: 'r/nottheonion', slug: 'nottheonion' },
  { name: 'r/explainlikeimfive', slug: 'explainlikeimfive' },
  { name: 'r/dataisbeautiful', slug: 'dataisbeautiful' },
];

function normalizeSlug(input: string): string {
  return input.trim().replace(/^\/?r\//i, '').replace(/^\/|\/$/g, '').toLowerCase();
}

export default function RedditPopular({ config, onUpdateConfig }: RedditPopularProps) {
  const subreddits: Subreddit[] = config.subreddits || DEFAULT_SUBREDDITS;
  const articleCount = config.articleCount || 10;

  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false);

  const subredditsKey = subreddits.map((s) => s.slug).join(',');

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        const pool: NewsSource[] = subreddits.map((s) => ({ name: s.name, url: subredditUrl(s.slug) }));
        // Every subscribed subreddit is fetched every refresh (sourcesPerRefresh
        // = pool.length) — unlike Headlines/UsNews, which deliberately rotate a
        // random subset of a large editorial pool, this list is short and
        // hand-picked, so Doug should see all of it, not a random sample.
        const items = await fetchMergedRssWithCache(
          `reddit-${subredditsKey}`,
          pool,
          pool.length,
          articleCount,
          3600000
        );
        setArticles(items);
        setError(null);
        onUpdateConfig({ ...config, subreddits, articleCount, lastFetchedCount: items.length });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching posts');
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
    const interval = setInterval(fetchPosts, 3600000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subredditsKey, articleCount]);

  const formatTime = (pubDate: string) => {
    const date = new Date(pubDate.replace(' ', 'T') + 'Z');
    const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const addSubreddit = (slug: string) => {
    const clean = normalizeSlug(slug);
    if (!clean) return;
    if (subreddits.some((s) => s.slug === clean)) {
      setAddError('Already added');
      return;
    }
    const next = [...subreddits, { name: `r/${clean}`, slug: clean }];
    onUpdateConfig({ ...config, subreddits: next, articleCount });
    setNewSlug('');
    setAddError(null);
    setShowAdd(false);
  };

  const removeSubreddit = (slug: string) => {
    const next = subreddits.filter((s) => s.slug !== slug);
    onUpdateConfig({ ...config, subreddits: next, articleCount });
  };

  const availableSuggestions = SUGGESTED_SUBREDDITS.filter(
    (s) => !subreddits.some((sub) => sub.slug === s.slug)
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Subscribed subreddit chips */}
      <div className="flex flex-wrap gap-1.5">
        {subreddits.map((s) => (
          <span
            key={s.slug}
            className="group flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium"
          >
            {s.name}
            <button
              onClick={() => removeSubreddit(s.slug)}
              title={`Remove ${s.name}`}
              className="p-0.5 rounded-full text-orange-400 hover:text-red-500 hover:bg-white dark:hover:bg-zinc-800 transition-colors duration-150"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 pl-2 pr-2.5 py-1 rounded-full border border-dashed border-zinc-300 dark:border-zinc-600 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-150"
          >
            <Plus size={12} /> Add subreddit
          </button>
        )}
      </div>

      {showAdd && (
        <div className="flex flex-col gap-1.5 p-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700">
          {addError && <p className="text-xs text-red-500">{addError}</p>}
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-zinc-400 flex-shrink-0">r/</span>
            <input
              type="text"
              placeholder="subredditname"
              value={newSlug}
              onChange={(e) => { setNewSlug(e.target.value); setAddError(null); }}
              onKeyDown={(e) => e.key === 'Enter' && addSubreddit(newSlug)}
              autoFocus
              className="flex-1 px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => addSubreddit(newSlug)} className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors duration-150">
              Add
            </button>
            <button onClick={() => { setShowAdd(false); setNewSlug(''); setAddError(null); }}
              className="flex-1 py-1.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-white rounded-lg text-sm font-medium transition-colors duration-150">
              Cancel
            </button>
          </div>

          {availableSuggestions.length > 0 && (
            <div className="mt-1">
              <button
                onClick={() => setSuggestionsExpanded((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors duration-150"
              >
                {suggestionsExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <Sparkles size={12} /> Suggestions
              </button>
              {suggestionsExpanded && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {availableSuggestions.map((s) => (
                    <button
                      key={s.slug}
                      onClick={() => addSubreddit(s.slug)}
                      className="flex items-center gap-1 px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 text-zinc-600 dark:text-zinc-300 hover:text-indigo-700 dark:hover:text-indigo-300 text-xs transition-colors duration-150"
                    >
                      <Circle size={9} className="flex-shrink-0" />
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-24"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div></div>
      )}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center h-24 gap-2 text-orange-600 dark:text-orange-400"><AlertCircle size={20} /><p className="text-xs text-center">{error}</p></div>
      )}

      {!loading && !error && (
        <div className="flex flex-col gap-1.5">
          {articles.length === 0 && (
            <div className="text-center text-zinc-400 dark:text-zinc-500 text-sm py-6">
              {subreddits.length === 0
                ? 'No subreddits added yet — add one above.'
                : "No posts found — Reddit's feed may be temporarily unavailable."}
            </div>
          )}
          {articles.map((article, idx) => (
            <a key={idx} href={article.link} target="_blank" rel="noopener noreferrer"
              className="surface-card block p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl border-l-4 border-orange-500 transition-all duration-150 group">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-zinc-900 dark:text-white text-sm line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-150">{article.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="truncate">{article.sourceName}</span>
                    <span>•</span>
                    <span className="flex-shrink-0">{formatTime(article.pubDate)}</span>
                  </div>
                </div>
                <ExternalLink size={14} className="flex-shrink-0 text-zinc-400 mt-1" />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
