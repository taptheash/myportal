import React, { useState, useEffect } from 'react';
import { Calendar, Loader2 } from 'lucide-react';

// Home's "Did You Know" style highlight — a single On This Day fact, picked
// once per day (not re-randomized on every render). Reuses the exact same
// Wikimedia endpoint + per-date cache key as TodayFacts.tsx's OnThisDayPill,
// so the two never disagree and a cache warmed by one warms the other.

interface OnThisDayEvent {
  text: string;
  year: number;
  sourceUrl?: string;
}

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export default function OnThisDayHighlight() {
  const [event, setEvent] = useState<OnThisDayEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const cacheKey = `on-this-day-${mm}-${dd}`;
    // A second, date-scoped key so the "which fact did we pick to feature
    // today" choice is itself stable across re-renders/reloads, without
    // re-fetching or disturbing the OnThisDayPill's own cache entry.
    const pickKey = `on-this-day-pick-${mm}-${dd}`;

    const pickFrom = (items: OnThisDayEvent[]) => {
      if (items.length === 0) return null;
      try {
        const stored = localStorage.getItem(pickKey);
        if (stored) {
          const idx = JSON.parse(stored);
          if (typeof idx === 'number' && items[idx]) return items[idx];
        }
      } catch {
        // fall through to a fresh pick
      }
      const idx = Math.floor(Math.random() * items.length);
      try { localStorage.setItem(pickKey, JSON.stringify(idx)); } catch { /* not fatal */ }
      return items[idx];
    };

    const run = async () => {
      try {
        setLoading(true);
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const entry = JSON.parse(cached);
            if (Date.now() - entry.timestamp < CACHE_MAX_AGE_MS) {
              setEvent(pickFrom(entry.data));
              setLoading(false);
              return;
            }
          }
        } catch {
          // corrupted cache entry, fall through to fetch
        }

        const res = await fetch(`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/${mm}/${dd}`);
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        const items: OnThisDayEvent[] = (data.events || [])
          .filter((e: any) => typeof e.text === 'string' && typeof e.year === 'number')
          .sort((a: OnThisDayEvent, b: OnThisDayEvent) => b.year - a.year)
          .slice(0, 10)
          .map((e: any) => ({ text: e.text, year: e.year, sourceUrl: e.pages?.[0]?.content_urls?.desktop?.page }));

        try { localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: items })); } catch { /* not fatal */ }
        setEvent(pickFrom(items));
      } catch {
        setEvent(null);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-2">
        <Loader2 size={14} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!event) {
    return <p className="text-xs text-zinc-400 dark:text-zinc-500">No historical highlight available today.</p>;
  }

  const content = (
    <>
      <span className="font-semibold text-indigo-600 dark:text-indigo-400">{event.year}</span>
      {' — '}
      {event.text}
    </>
  );

  return (
    <div className="flex items-start gap-2">
      <Calendar size={14} className="text-indigo-400 flex-shrink-0 mt-0.5" />
      {event.sourceUrl ? (
        <a
          href={event.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-150"
        >
          {content}
        </a>
      ) : (
        <span className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">{content}</span>
      )}
    </div>
  );
}
