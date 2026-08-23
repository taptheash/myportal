const CACHE_DURATION = 3600000; // 1 hour in milliseconds

interface CacheEntry {
  data: any;
  timestamp: number;
}

export const rssCache = {
  get: (key: string): any | null => {
    try {
      const cached = localStorage.getItem(`rss_cache_${key}`);
      if (!cached) return null;

      const entry: CacheEntry = JSON.parse(cached);
      const now = Date.now();

      // Check if cache has expired
      if (now - entry.timestamp > CACHE_DURATION) {
        localStorage.removeItem(`rss_cache_${key}`);
        return null;
      }

      return entry.data;
    } catch (err) {
      return null;
    }
  },

  set: (key: string, data: any): void => {
    try {
      const entry: CacheEntry = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(`rss_cache_${key}`, JSON.stringify(entry));
    } catch (err) {
      console.error('Failed to cache:', err);
    }
  },

  clear: (key: string): void => {
    try {
      localStorage.removeItem(`rss_cache_${key}`);
    } catch (err) {
      console.error('Failed to clear cache:', err);
    }
  },
};
