// Daily section content (Tomorrow News, AI Blog).
//
// A scheduled task writes one JSON file per day into portal/public/daily/<kind>/
// (e.g. public/daily/news/2026-10-20.json) and keeps public/daily/<kind>/index.json
// up to date: {"dates": ["2026-10-20", "2026-10-19", ...]} newest first. Pushing
// those files to main redeploys the site, so the portal only ever reads static
// files. No API keys, no database, no cost.

export type DailyKind = 'news' | 'blog';

const BASE = process.env.PUBLIC_URL || '';

// A missing file on the dev server / Vercel falls back to index.html (200,
// text/html), so anything that isn't JSON counts as "not there".
async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}/daily/${path}`, { cache: 'no-cache' });
    if (!res.ok) return null;
    if (!(res.headers.get('content-type') || '').includes('json')) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchDailyIndex(kind: DailyKind): Promise<string[]> {
  const data = await getJson<{ dates?: unknown }>(`${kind}/index.json`);
  if (!data || !Array.isArray(data.dates)) return [];
  return (data.dates as unknown[])
    .filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();
}

export function fetchDailyEntry<T>(kind: DailyKind, date: string): Promise<T | null> {
  return getJson<T>(`${kind}/${date}.json`);
}

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "2026-10-20" -> a local Date (not UTC, so the day never shifts).
export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatDay(key: string, long = false): string {
  return parseDay(key).toLocaleDateString(undefined, long
    ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
    : { weekday: 'short', month: 'short', day: 'numeric' });
}

// Only http(s) links are ever rendered as links.
export function safeUrl(url: unknown): string | null {
  return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null;
}
