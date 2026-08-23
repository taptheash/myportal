import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, ExternalLink } from 'lucide-react';
import { rssCache } from '../../lib/rssCache';

interface Article {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  content?: string;
}

interface NewsWidgetProps {
  feedUrl: string;
  defaultArticleCount?: number;
}

export default function NewsWidget({
  feedUrl,
  defaultArticleCount = 5,
}: NewsWidgetProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(defaultArticleCount);

  useEffect(() => {
    fetchFeed();
  }, [feedUrl]);

  const fetchFeed = async () => {
    try {
      setLoading(true);
      setError(null);

      const cacheKey = feedUrl;
      const cached = rssCache.get(cacheKey);

      if (cached) {
        setArticles(cached);
        setLoading(false);
        return;
      }

      const apiKey = process.env.REACT_APP_RSS2JSON_API_KEY;
      if (!apiKey) {
        throw new Error('RSS API key not configured');
      }

      const rssUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(
        feedUrl
      )}&api_key=${apiKey}`;

      const response = await fetch(rssUrl);
      if (!response.ok) throw new Error('Failed to fetch feed');

      const data = await response.json();

      if (data.status !== 'ok') {
        throw new Error('Feed parsing failed');
      }

      const parsedArticles: Article[] = (data.items || []).map((item: any) => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        description: item.description,
        content: item.content,
      }));

      setArticles(parsedArticles);
      rssCache.set(cacheKey, parsedArticles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading feed');
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  const visibleArticles = articles.slice(0, displayCount);

  if (loading) {
    return <div className="text-sm text-gray-600 dark:text-gray-400">Loading...</div>;
  }

  if (error) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-red-600">{error}</div>
        <button
          onClick={fetchFeed}
          className="w-full px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Articles list */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {visibleArticles.length === 0 ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">No articles available</div>
        ) : (
          visibleArticles.map((article, idx) => (
            <div
              key={idx}
              className="p-2 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span className="flex-1 line-clamp-2">{article.title}</span>
                <ExternalLink size={14} className="flex-shrink-0 mt-0.5" />
              </a>
              {article.pubDate && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {new Date(article.pubDate).toLocaleDateString()}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Article count controls */}
      {articles.length > 0 && (
        <div className="flex items-center justify-between gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
          <button
            onClick={() => setDisplayCount(Math.max(1, displayCount - 1))}
            disabled={displayCount <= 1}
            className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronUp size={16} />
          </button>
          <span className="text-xs text-gray-700 dark:text-gray-300">
            {displayCount} / {articles.length}
          </span>
          <button
            onClick={() => setDisplayCount(Math.min(articles.length, displayCount + 1))}
            disabled={displayCount >= articles.length}
            className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
