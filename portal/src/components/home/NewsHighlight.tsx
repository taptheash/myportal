import React, { useState, useEffect } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { fetchMergedRssWithCache, NewsSource } from '../../lib/rssCache';

// Home's top-stories teaser — reuses Headlines.tsx's exact same cached
// sources/key, so this never causes an extra network fetch beyond what
// Headlines already does within the same hour (fetchMergedRssWithCache
// caches by key regardless of which component calls it first).

const SOURCES: NewsSource[] = [
  { name: 'AP News', url: 'https://apnews.com/hub/ap-top-news.rss' },
  { name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'NPR', url: 'https://feeds.npr.org/1002/rss.xml' },
];

interface NewsItem { title: string; link: string; sourceName: string; }

export default function NewsHighlight() {
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const items = await fetchMergedRssWithCache('headlines', SOURCES, 3, 4, 3600000);
        setArticles(items);
      } catch {
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-2">
        <Loader2 size={14} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  if (articles.length === 0) {
    return <p className="text-xs text-zinc-400 dark:text-zinc-500 py-1">No headlines available right now.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {articles.slice(0, 3).map((a, idx) => (
        <a
          key={idx}
          href={a.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors duration-150 group"
        >
          <span className="text-sm text-zinc-800 dark:text-zinc-100 line-clamp-2 flex-1">{a.title}</span>
          <ExternalLink size={12} className="text-zinc-300 dark:text-zinc-600 flex-shrink-0 mt-0.5 group-hover:text-indigo-500" />
        </a>
      ))}
    </div>
  );
}
