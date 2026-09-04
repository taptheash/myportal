import React, { useState, useEffect } from 'react';
import { ExternalLink, AlertCircle } from 'lucide-react';
import { fetchMergedRssWithCache, NewsSource } from '../../lib/rssCache';

interface HeadlinesProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface NewsItem { title: string; link: string; pubDate: string; sourceName: string; }

// NYT was dropped from this pool — its articles hit a subscription wall,
// which made headlines you couldn't actually read past the first paragraph.
// These three are free, no-paywall wire/public sources.
const SOURCES: NewsSource[] = [
  { name: 'AP News', url: 'https://apnews.com/hub/ap-top-news.rss' },
  { name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'NPR', url: 'https://feeds.npr.org/1002/rss.xml' },
];

export default function Headlines({ config, onUpdateConfig }: HeadlinesProps) {
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const articleCount = config.articleCount || 10;

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        // Pulls a random 2-3 of the 3 available sources each refresh, merged
        // and sorted by recency — different mix over time rather than one
        // fixed outlet always shown.
        const items = await fetchMergedRssWithCache('headlines', SOURCES, 3, articleCount, 3600000);
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

  if (loading) return <div className="flex items-center justify-center h-24"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500"></div></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-24 gap-2 text-red-600"><AlertCircle size={20} /><p className="text-xs text-center">{error}</p></div>;

  return (
    <div className="flex flex-col gap-1.5">
      {articles.length === 0 && (
        <div className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">
          No articles found — the source may be temporarily unavailable.
        </div>
      )}
      {articles.map((article, idx) => (
        <a key={idx} href={article.link} target="_blank" rel="noopener noreferrer"
          className="block p-2 bg-red-50 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-slate-600 rounded-lg border-l-4 border-red-500 transition group">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2 group-hover:text-red-600 dark:group-hover:text-red-400 transition">{article.title}</p>
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
