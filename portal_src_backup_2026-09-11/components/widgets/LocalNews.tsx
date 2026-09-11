import React, { useState, useEffect } from 'react';
import { ExternalLink, AlertCircle } from 'lucide-react';
import { fetchMergedRssWithCache, NewsSource } from '../../lib/rssCache';

interface LocalNewsProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface NewsItem { title: string; link: string; pubDate: string; sourceName: string; }

// Single source for now — NH-specific outlets are a genuinely small pool,
// and I couldn't confidently verify a second working feed (Union Leader
// failed twice already; WMUR's RSS URL wasn't pinned down with confidence).
// Structured the same as the other categories so adding one later is a
// one-line change, not a rewrite.
const SOURCES: NewsSource[] = [
  { name: 'NHPR', url: 'https://www.nhpr.org/nh-news.rss' },
];

export default function LocalNews({ config, onUpdateConfig }: LocalNewsProps) {
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const articleCount = config.articleCount || 10;

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        const items = await fetchMergedRssWithCache('local', SOURCES, 2, articleCount, 3600000);
        setArticles(items);
        setError(null);
        onUpdateConfig({ ...config, articleCount, lastFetchedCount: items.length });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching news');
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
    const interval = setInterval(fetchNews, 3600000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleCount]);

  const formatTime = (pubDate: string) => {
    const date = new Date(pubDate.replace(' ', 'T') + 'Z');
    const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  if (loading) return <div className="flex items-center justify-center h-24"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-24 gap-2 text-orange-600 dark:text-orange-400"><AlertCircle size={20} /><p className="text-xs text-center">{error}</p></div>;

  return (
    <div className="flex flex-col gap-1.5">
      {articles.length === 0 && (
        <div className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">
          No articles found — the source may be temporarily unavailable.
        </div>
      )}
      {articles.map((article, idx) => (
        <a key={idx} href={article.link} target="_blank" rel="noopener noreferrer"
          className="block p-2 bg-green-50 dark:bg-slate-700 hover:bg-green-100 dark:hover:bg-slate-600 rounded-lg border-l-4 border-green-500 transition group">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2 group-hover:text-green-600 dark:group-hover:text-green-400 transition">{article.title}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-600 dark:text-gray-400">
                <span className="truncate">{article.sourceName}</span>
                <span>•</span>
                <span className="flex-shrink-0">{formatTime(article.pubDate)}</span>
              </div>
            </div>
            <ExternalLink size={14} className="flex-shrink-0 text-gray-400 mt-1" />
          </div>
        </a>
      ))}
    </div>
  );
}
