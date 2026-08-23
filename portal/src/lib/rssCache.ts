// Fetches an RSS feed via rss2json.com (handles CORS + XML->JSON conversion)
// and caches the result in localStorage so repeated page loads don't
// re-hit the API within maxAgeMs.

interface CacheEntry {
  timestamp: number;
  data: any[];
}

const RSS2JSON_BASE = 'https://api.rss2json.com/v1/api.json';

export async function fetchRssWithCache(
  cacheKey: string,
  feedUrl: string,
  count: number,
  maxAgeMs: number
): Promise<any[]> {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const entry: CacheEntry = JSON.parse(cached);
      if (Date.now() - entry.timestamp < maxAgeMs) {
        return entry.data;
      }
    }
  } catch {
    // corrupted cache entry, fall through to fetch
  }

  const apiKey = process.env.REACT_APP_RSS2JSON_API_KEY;
  const params = new URLSearchParams({ rss_url: feedUrl });
  if (apiKey) {
    params.set('api_key', apiKey);
    params.set('count', String(count));
    params.set('order_by', 'pubDate');
    params.set('order_dir', 'desc');
  }

  const response = await fetch(`${RSS2JSON_BASE}?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch RSS feed');
  const json = await response.json();
  if (json.status !== 'ok') throw new Error(json.message || 'RSS feed error');

  const items = (json.items || []).slice(0, count);

  try {
    localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: items }));
  } catch {
    // localStorage full — not fatal
  }

  return items;
}
