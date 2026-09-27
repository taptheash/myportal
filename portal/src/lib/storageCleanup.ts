// Clears out localStorage entries that pile up forever. Runs once per page
// load, before the app renders. It only touches caches the app can simply
// re-fetch, never pw6* user data:
// - daily caches from past days: on-this-day-MM-DD, national-day-MM-DD and
//   on-this-day-pick-MM-DD (one of each per calendar day, never removed)
// - rss-business-N keys left over from when Business news cached one entry
//   per article count
// - feed caches (rss-*, custom-feed-*, reddit-*) older than 7 days, e.g.
//   for a feed or subreddit that's no longer used

const DAILY = /^(on-this-day|on-this-day-pick|national-day)-(\d\d)-(\d\d)$/;
const LEGACY = /^rss-business-\d+$/;
const FEED = /^(rss-|custom-feed-|reddit-)/;
const MAX_FEED_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function cleanUpOldCaches(now: Date = new Date()): number {
  let removed = 0;
  try {
    const today = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }
    for (const key of keys) {
      if (key.startsWith('pw6')) continue; // user data and settings: never touched
      let drop = false;
      const daily = key.match(DAILY);
      if (daily) {
        drop = `${daily[2]}-${daily[3]}` !== today;
      } else if (LEGACY.test(key)) {
        drop = true;
      } else if (FEED.test(key)) {
        try {
          const ts = JSON.parse(localStorage.getItem(key) || 'null')?.timestamp;
          drop = typeof ts === 'number' && now.getTime() - ts > MAX_FEED_AGE_MS;
        } catch {
          drop = true; // unreadable cache entry
        }
      }
      if (drop) {
        localStorage.removeItem(key);
        removed++;
      }
    }
  } catch {
    // storage unavailable — nothing to clean
  }
  return removed;
}
