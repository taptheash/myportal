import { NewsSource, fetchMergedRssWithCache, fetchRssWithCache } from './rssCache';
import { getWidgetConfig } from './portalStorage';
import { SOURCES as HEADLINES } from '../components/widgets/Headlines';
import { SOURCES as US } from '../components/widgets/UsNews';
import { SOURCES as TECH } from '../components/widgets/TechNews';
import { SOURCES as LOCAL } from '../components/widgets/LocalNews';
import { SOURCES as NESPORTS } from '../components/widgets/SportsNews';
import { SOURCES as OTHER } from '../components/widgets/WeirdNews';
import { FEED_URL as CNBC_URL, SOURCE_NAME as CNBC_NAME } from '../components/widgets/BusinessNews';

// Every News category My News and the Daily Brief can draw from. They use
// the SAME source lists and cache keys as the category tabs, so a feed
// already fetched for Headlines isn't fetched again for My News.
export interface NewsCategory {
  key: string;      // cache namespace — must match the category tab's own
  label: string;
  sources: NewsSource[];
}

export const NEWS_CATEGORIES: NewsCategory[] = [
  { key: 'headlines', label: 'Headlines', sources: HEADLINES },
  { key: 'usnews', label: 'US News', sources: US },
  { key: 'tech', label: 'Tech & AI', sources: TECH },
  { key: 'local', label: 'NH Local', sources: LOCAL },
  { key: 'sportsnews', label: 'NE Sports', sources: NESPORTS },
  { key: 'business', label: 'Business', sources: [{ name: CNBC_NAME, url: CNBC_URL }] },
  { key: 'weird', label: 'Other', sources: OTHER },
];

export const DEFAULT_MY_NEWS = ['headlines', 'local', 'tech'];

// --- Fetching ---------------------------------------------------------------

export interface TaggedArticle {
  title: string;
  link: string;
  pubDate: string;
  sourceName: string;
  categoryKey: string;
  categoryLabel: string;
}

// Custom feeds (News › Feeds) offered as extra My News categories.
export function customFeedCategories(): NewsCategory[] {
  const feeds: any[] = getWidgetConfig('feeds').feeds || [];
  return feeds.map((f) => ({ key: `custom:${f.id}`, label: f.name, sources: [{ name: f.name, url: f.url }] }));
}

export function allCategories(): NewsCategory[] {
  return [...NEWS_CATEGORIES, ...customFeedCategories()];
}

export async function fetchCategory(cat: NewsCategory, force = false): Promise<TaggedArticle[]> {
  const tag = (items: any[], sourceName?: string): TaggedArticle[] =>
    items.map((i) => ({ ...i, sourceName: i.sourceName || sourceName || cat.label, categoryKey: cat.key, categoryLabel: cat.label }));

  if (cat.key.startsWith('custom:')) {
    const id = cat.key.slice(7);
    const src = cat.sources[0];
    return tag(await fetchRssWithCache(`custom-feed-${id}`, src.url, 15, 3600000, force, src.name), src.name);
  }
  if (cat.key === 'business') {
    const src = cat.sources[0];
    return tag(await fetchRssWithCache('rss-business', src.url, 30, 3600000, force, src.name), src.name);
  }
  // All of the category's sources (not a random subset), newest first.
  return tag(await fetchMergedRssWithCache(cat.key, cat.sources, cat.sources.length, 60, 3600000, force));
}

function time(a: { pubDate: string }) {
  const t = new Date((a.pubDate || '').replace(' ', 'T') + 'Z').getTime();
  return isNaN(t) ? 0 : t;
}

// Several categories merged into one list: deduped by link, newest first.
export async function fetchCategories(keys: string[], force = false): Promise<{ articles: TaggedArticle[]; failed: string[] }> {
  const cats = allCategories().filter((c) => keys.includes(c.key));
  const results = await Promise.allSettled(cats.map((c) => fetchCategory(c, force)));
  const failed: string[] = [];
  const seen = new Set<string>();
  const articles: TaggedArticle[] = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected') { failed.push(cats[i].label); return; }
    for (const a of r.value) {
      const k = a.link || a.title;
      if (!k || seen.has(k)) continue;
      seen.add(k);
      articles.push(a);
    }
  });
  articles.sort((a, b) => time(b) - time(a));
  return { articles, failed };
}
