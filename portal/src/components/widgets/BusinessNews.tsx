import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, AlertCircle } from 'lucide-react';
import { fetchRssWithCache } from '../../lib/rssCache';

interface BusinessNewsProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface NewsItem { title: string; link: string; pubDate: string; }

const FEED_URL = 'https://www.cnbc.com/id/100003114/device/rss/rss.html';
const SOURCE_NAME = 'CNBC';

export default function BusinessNews({ config, onUpdateConfig }: BusinessNewsProps) {
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const articleCount = config.articleCount || 10;
  // Tracks the last refreshNonce we've seen so a manual refresh (App.tsx
  // bumping config.refreshNonce via the header's refresh button) can be told
  // apart from a mount or the normal hourly interval — only the manual case
  // bypasses the cache.
  const lastNonceRef = useRef(config.refreshNonce);

  useEffect(() => {
    const forceRefresh = config.refreshNonce !== undefined && config.refreshNonce !== lastNonceRef.current;
    lastNonceRef.current = config.refreshNonce;

    const fetchNews = async (force: boolean) => {
      try {
        setLoading(true);
        // One fixed-size fetch under one cache key, sliced for display. Keying
        // the cache (and the fetch size) on articleCount meant every +/- click
        // fired a brand-new network request and left another stale
        // rss-business-N entry in localStorage.
        const pool = await fetchRssWithCache('rss-business', FEED_URL, Math.max(30, articleCount), 3600000, force);
        const items = pool.slice(0, articleCount);
        setArticles(items);
        setError(null);
        onUpdateConfig({ ...config, articleCount, lastFetchedCount: items.length });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching news');
      } finally {
        setLoading(false);
      }
    };
    fetchNews(forceRefresh);
    const interval = setInterval(() => fetchNews(false), 3600000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleCount, config.refreshNonce]);

  const formatTime = (pubDate: string) => {
    const date = new Date(pubDate.replace(' ', 'T') + 'Z');
    const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  if (loading && articles.length === 0) return <div className="flex items-center justify-center h-24"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div></div>;

  if (error && articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-24 gap-2 text-orange-600 dark:text-orange-400">
        <AlertCircle size={20} />
        <p className="text-xs text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {articles.length > 0 ? (
        articles.map((article, idx) => (
          <div key={idx} className="surface-card p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl border-l-4 border-indigo-500 transition-all duration-150">
            <a href={article.link} target="_blank" rel="noopener noreferrer"
              className="flex items-start justify-between gap-2 group">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-150 line-clamp-2">
                  {article.title}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{formatTime(article.pubDate)}</p>
              </div>
              <ExternalLink size={14} className="flex-shrink-0 text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-150 mt-0.5" />
            </a>
          </div>
        ))
      ) : (
        <p className="text-center text-zinc-500 dark:text-zinc-400 text-sm py-4">No articles</p>
      )}
      <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center mt-2">
        {articles.length} articles • {SOURCE_NAME}
      </p>
    </div>
  );
}
