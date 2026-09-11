// Fetches an RSS feed via rss2json.com (handles CORS + XML->JSON conversion)
// and caches the result in localStorage so repeated page loads don't
// re-hit the API within maxAgeMs.

interface CacheEntry {
  timestamp: number;
  data: any[];
}

const RSS2JSON_BASE = 'https://api.rss2json.com/v1/api.json';

// Some publishers (Entertainment Weekly does this to italicize show titles)
// embed HTML markup directly in their RSS <title> text — e.g. a title
// containing literal <i><em>Lanterns</em></i>. When that markup is
// XML-escaped inside the feed and rss2json passes it through without fully
// unescaping it, the result is literal "&lt;i&gt;&lt;em&gt;" text showing
// up on screen instead of either real formatting or clean plain text.
// This decodes those entities and then strips any resulting tags, so
// titles always render as plain text regardless of what the source feed
// embedded.
function cleanTitle(raw: string): string {
  const decoded = raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
  return decoded.replace(/<[^>]*>/g, '');
}

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

  const items = (json.items || [])
    .slice(0, count)
    .map((item: any) => ({ ...item, title: item.title ? cleanTitle(item.title) : item.title }));

  try {
    localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: items }));
  } catch {
    // localStorage full — not fatal
  }

  return items;
}

export interface NewsSource {
  name: string;
  url: string;
}

// Randomly selects `count` sources from a pool — a different combination
// each time this runs, which in practice means each poll cycle (every
// ~hour, matching the outer widget's refresh interval).
function pickRandomSources(pool: NewsSource[], count: number): NewsSource[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, pool.length));
}

// Fetched once per source at a generous fixed size, then re-sliced purely
// for display based on whatever count is currently requested. This is
// deliberately NOT scaled to the requested total — doing that previously
// caused uneven jumps (e.g. for 3 sources, requesting 10, 11, or 12 all
// rounded up to the same per-source fetch size, but crossing to 13 jumped
// to a bigger one, so a single click could suddenly surface several extra
// articles at once). A stable, generous pool means clicking + always
// reveals exactly one more article, evenly, up to the pool's real size.
const PER_SOURCE_POOL_SIZE = 20;

// Fetches a random subset of sources from the pool, tags each article with
// which outlet it came from, and merges them into one list sorted by
// recency. Each source still goes through the same per-source cache as
// fetchRssWithCache (title cleaning included), so this doesn't multiply
// real network calls beyond what the random subset actually needs.
export async function fetchMergedRssWithCache(
  categoryKey: string,
  pool: NewsSource[],
  sourcesPerRefresh: number,
  totalCount: number,
  maxAgeMs: number
): Promise<Array<any & { sourceName: string }>> {
  const chosen = pickRandomSources(pool, sourcesPerRefresh);

  const results = await Promise.allSettled(
    chosen.map(async (source) => {
      const items = await fetchRssWithCache(
        `rss-${categoryKey}-${source.name}`,
        source.url,
        PER_SOURCE_POOL_SIZE,
        maxAgeMs
      );
      return items.map((item) => ({ ...item, sourceName: source.name }));
    })
  );

  const merged = results
    .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  merged.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  return merged.slice(0, totalCount);
}
