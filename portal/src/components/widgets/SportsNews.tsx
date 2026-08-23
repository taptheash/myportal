import React, { useState, useEffect } from 'react';
import { ExternalLink, AlertCircle } from 'lucide-react';
import { fetchRssWithCache } from '../../lib/rssCache';

interface SportsNewsProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface NewsItem { title: string; link: string; pubDate: string; }

const FEED_URL = 'https://www.boston.com/category/sports/feed/';
const SOURCE_NAME = 'Boston.com Sports';

export default function SportsNews({ config }: SportsNewsProps) {
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const articleCount = config.articleCount || 10;

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        const items = await fetchRssWithCache(`rss-sportsnews-${articleCount}`, FEED_URL, articleCount, 3600000);
        setArticles(items);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching news');
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
    const interval = setInterval(fetchNews, 3600000);
    return () => clearInterval(interval);
  }, [articleCount]);

  const formatTime = (pubDate: string) => {
    const date = new Date(pubDate.replace(' ', 'T') + 'Z');
    const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  if (loading) return <div className="flex items-center justify-center h-24"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-700"></div></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-24 gap-2 text-blue-700"><AlertCircle size={20} /><p className="text-xs text-center">{error}</p></div>;

  return (
    <div className="flex flex-col gap-1.5">
      {articles.map((article, idx) => (
        <a key={idx} href={article.link} target="_blank" rel="noopener noreferrer"
          className="block p-2 bg-blue-50 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-slate-600 rounded-lg border-l-4 border-blue-700 transition group">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition">{article.title}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-600 dark:text-gray-400">
                <span className="truncate">{SOURCE_NAME}</span>
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
