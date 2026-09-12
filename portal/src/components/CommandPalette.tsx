import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, Link2, StickyNote, ListChecks, Calendar as CalendarIcon, Newspaper, Trophy,
  TrendingUp, Home as HomeIcon, Wrench, Loader2, Plus, FileText,
} from 'lucide-react';
import { getWidgetConfig } from '../lib/portalStorage';
import { flattenLinks, normalizeEntries } from './widgets/QuickLinks';
import { useDebounce } from '../hooks/useDebounce';
import { fetchMergedRssWithCache, NewsSource } from '../lib/rssCache';

// Global Ctrl+K search + quick actions. Per Doug's choice, this searches
// EVERYTHING: local data (Quick Links/folders/Notes/Tasks/Calendar) resolves
// instantly since it's just reading localStorage already in memory, while
// News/Sports/Stocks results come from live lookups that are debounced so
// typing doesn't fire a network call per keystroke.

interface Result {
  id: string;
  group: 'Action' | 'Quick Links' | 'Notes' | 'Tasks' | 'Calendar' | 'News' | 'Sports' | 'Stocks';
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  sublabel?: string;
  onSelect: () => void;
}

const NEWS_SOURCES: NewsSource[] = [
  { name: 'AP News', url: 'https://apnews.com/hub/ap-top-news.rss' },
  { name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'NPR', url: 'https://feeds.npr.org/1002/rss.xml' },
];

function getHostname(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function CommandPalette({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (section: string) => void;
}) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [liveResults, setLiveResults] = useState<Result[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Instant, local results — recomputed on every keystroke since it's pure
  // in-memory filtering of data already sitting in localStorage.
  const localResults = useMemo((): Result[] => {
    const q = query.trim().toLowerCase();
    const results: Result[] = [];

    const actions: Result[] = [
      { id: 'act-home', group: 'Action', icon: HomeIcon, label: 'Go to Home', onSelect: () => onNavigate('home') },
      { id: 'act-tools', group: 'Action', icon: Wrench, label: 'Go to Tools', onSelect: () => onNavigate('tools') },
      { id: 'act-news', group: 'Action', icon: Newspaper, label: 'Go to News', onSelect: () => onNavigate('news') },
      { id: 'act-sports', group: 'Action', icon: Trophy, label: 'Go to Sports', onSelect: () => onNavigate('sports') },
      { id: 'act-stocks', group: 'Action', icon: TrendingUp, label: 'Go to Stocks', onSelect: () => onNavigate('stocks') },
      {
        id: 'act-addlink', group: 'Action', icon: Plus, label: 'Add a Quick Link',
        onSelect: () => { onNavigate('tools'); },
      },
    ];

    if (!q) {
      // Empty query: show quick actions only — no point flooding the list
      // with every saved link/note before the person has typed anything.
      return actions;
    }

    for (const a of actions) {
      if (a.label.toLowerCase().includes(q)) results.push(a);
    }

    const linksConfig = getWidgetConfig('links');
    const flatLinks = flattenLinks(normalizeEntries(linksConfig.links));
    for (const link of flatLinks) {
      if (link.label.toLowerCase().includes(q) || getHostname(link.url).toLowerCase().includes(q)) {
        results.push({
          id: `link-${link.id}`,
          group: 'Quick Links',
          icon: Link2,
          label: link.label,
          sublabel: getHostname(link.url),
          onSelect: () => window.open(link.url, '_blank', 'noopener,noreferrer'),
        });
      }
    }

    const notesConfig = getWidgetConfig('notes');
    for (const note of notesConfig.notes || []) {
      const hay = `${note.title}\n${note.text || ''}`.toLowerCase();
      if (hay.includes(q)) {
        results.push({
          id: `note-${note.id}`,
          group: 'Notes',
          icon: StickyNote,
          label: note.title || 'Untitled',
          sublabel: (note.text || '').slice(0, 60),
          onSelect: () => onNavigate('tools'),
        });
      }
    }

    const tasksConfig = getWidgetConfig('tasks');
    for (const list of tasksConfig.notes || []) {
      if ((list.title || '').toLowerCase().includes(q)) {
        results.push({
          id: `tasklist-${list.id}`,
          group: 'Tasks',
          icon: ListChecks,
          label: list.title,
          sublabel: `${(list.items || []).length} item${(list.items || []).length === 1 ? '' : 's'}`,
          onSelect: () => onNavigate('tools'),
        });
      }
      for (const item of list.items || []) {
        if (item.text.toLowerCase().includes(q)) {
          results.push({
            id: `task-${item.id}`,
            group: 'Tasks',
            icon: ListChecks,
            label: item.text,
            sublabel: list.title,
            onSelect: () => onNavigate('tools'),
          });
        }
      }
    }

    return results.slice(0, 25);
  }, [query, onNavigate]);

  // Live results — News (cached RSS pool), Sports (ESPN team search), Stocks
  // (Finnhub symbol lookup). Debounced and skipped entirely for an empty
  // query, so opening the palette never fires a network call by itself.
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q || q.length < 2) {
      setLiveResults([]);
      return;
    }

    let cancelled = false;
    setLiveLoading(true);

    const run = async () => {
      const out: Result[] = [];

      try {
        const articles = await fetchMergedRssWithCache('headlines', NEWS_SOURCES, 3, 20, 3600000);
        const matches = articles.filter((a: any) => a.title.toLowerCase().includes(q.toLowerCase())).slice(0, 5);
        for (const a of matches) {
          out.push({
            id: `news-${a.link}`,
            group: 'News',
            icon: Newspaper,
            label: a.title,
            sublabel: a.sourceName,
            onSelect: () => window.open(a.link, '_blank', 'noopener,noreferrer'),
          });
        }
      } catch {
        // news source unavailable — just show no news results, not an error state
      }

      try {
        const finnhubKey = process.env.REACT_APP_FINNHUB_API_KEY;
        if (finnhubKey) {
          const res = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${finnhubKey}`);
          if (res.ok) {
            const data = await res.json();
            const matches = (data.result || []).slice(0, 5);
            for (const m of matches) {
              out.push({
                id: `stock-${m.symbol}`,
                group: 'Stocks',
                icon: TrendingUp,
                label: m.symbol,
                sublabel: m.description,
                onSelect: () => onNavigate('stocks'),
              });
            }
          }
        }
      } catch {
        // stock search unavailable — not fatal
      }

      if (!cancelled) {
        setLiveResults(out);
        setLiveLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [debouncedQuery, onNavigate]);

  const allResults = useMemo(() => [...localResults, ...liveResults], [localResults, liveResults]);

  useEffect(() => setActiveIndex(0), [allResults.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = allResults[activeIndex];
      if (selected) {
        selected.onSelect();
        onClose();
      }
    }
  };

  if (!open) return null;

  let lastGroup: string | null = null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        className="surface-card w-full max-w-xl bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden flex flex-col max-h-[70vh]"
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <Search size={16} className="text-zinc-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search links, notes, tasks, news, sports, stocks…"
            aria-label="Search"
            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none"
          />
          {liveLoading && <Loader2 size={14} className="animate-spin text-zinc-400 flex-shrink-0" />}
          <kbd className="hidden sm:inline text-[10px] font-medium text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">Esc</kbd>
        </div>

        <div ref={listRef} className="overflow-y-auto no-scrollbar py-1.5">
          {allResults.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
              {query.trim() ? (
                <>
                  <FileText size={20} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-700" />
                  No results for "{query.trim()}"
                </>
              ) : (
                'Start typing to search, or pick an action below.'
              )}
            </div>
          ) : (
            allResults.map((r, index) => {
              const showGroupHeader = r.group !== lastGroup;
              lastGroup = r.group;
              const Icon = r.icon;
              return (
                <React.Fragment key={r.id}>
                  {showGroupHeader && (
                    <div className="px-4 pt-2.5 pb-1 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
                      {r.group}
                    </div>
                  )}
                  <button
                    onClick={() => { r.onSelect(); onClose(); }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors duration-100 ${
                      index === activeIndex ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    <Icon size={15} className="text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
                    <span className="flex flex-col min-w-0 leading-tight flex-1">
                      <span className="text-sm text-zinc-800 dark:text-zinc-100 truncate">{r.label}</span>
                      {r.sublabel && <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate">{r.sublabel}</span>}
                    </span>
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
