import React, { useState, useRef, useEffect } from 'react';
import { Calendar, PartyPopper, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import { fetchRssWithCache } from '../lib/rssCache';

// Two small expandable header pills: "On This Day" (historical events, via
// Wikimedia's free public Feed API) and "National Day" (today's quirky/
// obscure observances, via Checkiday's free public RSS feed run through the
// same rss2json + localStorage cache pipeline already used for News). Both
// cache for 24h since the content only changes once a day.

interface OnThisDayEvent {
  text: string;
  year: number;
  sourceUrl?: string;
}

interface NationalDayEntry {
  title: string;
  link?: string;
}

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h — content only changes daily

function useOnThisDay() {
  const [events, setEvents] = useState<OnThisDayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = () => {
    if (loaded) return; // fetch once per mount — panel content doesn't change while open
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const cacheKey = `on-this-day-${mm}-${dd}`;

    const run = async () => {
      try {
        setLoading(true);
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const entry = JSON.parse(cached);
            if (Date.now() - entry.timestamp < CACHE_MAX_AGE_MS) {
              setEvents(entry.data);
              setLoading(false);
              setLoaded(true);
              return;
            }
          }
        } catch {
          // corrupted cache entry, fall through to fetch
        }

        const res = await fetch(
          `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/${mm}/${dd}`
        );
        if (!res.ok) throw new Error('Failed to fetch historical events');
        const data = await res.json();
        const items: OnThisDayEvent[] = (data.events || [])
          .filter((e: any) => typeof e.text === 'string' && typeof e.year === 'number')
          .sort((a: OnThisDayEvent, b: OnThisDayEvent) => b.year - a.year)
          .slice(0, 10)
          .map((e: any) => ({
            text: e.text,
            year: e.year,
            sourceUrl: e.pages?.[0]?.content_urls?.desktop?.page as string | undefined,
          }));

        setEvents(items);
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: items }));
        } catch {
          // localStorage full — not fatal
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load historical events');
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    };

    run();
  };

  return { events, loading, error, load };
}

function useNationalDay() {
  const [entries, setEntries] = useState<NationalDayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = () => {
    if (loaded) return;

    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const cacheKey = `national-day-${mm}-${dd}`;

    const run = async () => {
      try {
        setLoading(true);
        const items = await fetchRssWithCache(
          cacheKey,
          'https://api.checkiday.com/rss',
          40,
          CACHE_MAX_AGE_MS
        );
        setEntries(items.map((item: any) => ({ title: item.title, link: item.link })));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load today’s observances');
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    };

    run();
  };

  return { entries, loading, error, load };
}

// Shared dropdown shell: a pill trigger button plus a panel that opens
// beneath it, closing on outside click or Escape. Both cards use this so
// they behave identically — only the trigger label/icon and panel content
// differ.
function ExpandablePill({
  icon: Icon,
  label,
  accentClass,
  align = 'center',
  onOpen,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  accentClass: string;
  align?: 'left' | 'center' | 'right';
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) onOpen();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={toggle}
        aria-expanded={open}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
          open
            ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200/80 dark:ring-zinc-800'
            : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200'
        }`}
      >
        <Icon size={14} className={accentClass} />
        <span className="hidden md:inline">{label}</span>
        <ChevronDown size={13} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`surface-card absolute mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 rounded-xl overflow-hidden z-50 ${
            align === 'left'
              ? 'left-0'
              : align === 'right'
              ? 'right-0'
              : 'left-1/2 -translate-x-1/2'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function OnThisDayPill() {
  const { events, loading, error, load } = useOnThisDay();

  return (
    <ExpandablePill icon={Calendar} label="On This Day" accentClass="text-indigo-500" align="left" onOpen={load}>
      <div className="px-3.5 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
          On This Day —{' '}
          {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto no-scrollbar">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={18} className="animate-spin text-indigo-500" />
          </div>
        )}
        {error && !loading && (
          <div className="flex items-center gap-2 px-3.5 py-3 text-red-500 text-xs">
            <AlertCircle size={14} className="flex-shrink-0" />
            {error}
          </div>
        )}
        {!loading && !error && events.length === 0 && (
          <div className="px-3.5 py-3 text-xs text-zinc-400 dark:text-zinc-500">No events found for today.</div>
        )}
        {!loading && !error && events.length > 0 && (
          <ul className="py-1">
            {events.map((event, idx) => (
              <li key={idx}>
                {event.sourceUrl ? (
                  <a
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-150"
                  >
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{event.year}</span>
                    {' — '}
                    {event.text}
                  </a>
                ) : (
                  <span className="block px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{event.year}</span>
                    {' — '}
                    {event.text}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </ExpandablePill>
  );
}

export function NationalDayPill() {
  const { entries, loading, error, load } = useNationalDay();

  return (
    <ExpandablePill icon={PartyPopper} label="National Day" accentClass="text-amber-500" align="right" onOpen={load}>
      <div className="px-3.5 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
          National Day —{' '}
          {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto no-scrollbar">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={18} className="animate-spin text-amber-500" />
          </div>
        )}
        {error && !loading && (
          <div className="flex items-center gap-2 px-3.5 py-3 text-red-500 text-xs">
            <AlertCircle size={14} className="flex-shrink-0" />
            {error}
          </div>
        )}
        {!loading && !error && entries.length === 0 && (
          <div className="px-3.5 py-3 text-xs text-zinc-400 dark:text-zinc-500">No observances found for today.</div>
        )}
        {!loading && !error && entries.length > 0 && (
          <ul className="py-1">
            {entries.map((entry, idx) => (
              <li key={idx}>
                {entry.link ? (
                  <a
                    href={entry.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-150"
                  >
                    {entry.title}
                  </a>
                ) : (
                  <span className="block px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-300">
                    {entry.title}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </ExpandablePill>
  );
}
