import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getFeedHealth, FeedHealthEntry, NewsSource } from '../../lib/rssCache';

// Small "Sources" footer for a News tab. A collapsed line says how many of
// the tab's feeds are working; expanding it lists each feed with when it
// last loaded, or why it's failing. This is how to spot a feed that has
// quietly died (it just thins the list otherwise) and needs replacing.

function ago(ts?: number): string {
  if (!ts) return 'never';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

type State = 'ok' | 'empty' | 'failing' | 'unknown';
function stateOf(h: FeedHealthEntry | undefined): State {
  if (!h || (!h.lastOk && !h.lastError)) return 'unknown';
  if (h.lastError && (!h.lastOk || h.lastError >= h.lastOk)) return h.items === 0 && h.lastOk ? 'empty' : 'failing';
  return 'ok';
}
const DOT: Record<State, string> = {
  ok: 'bg-emerald-500',
  empty: 'bg-amber-400',
  failing: 'bg-red-500',
  unknown: 'bg-zinc-300 dark:bg-zinc-600',
};

export default function FeedHealth({ sources }: { sources: NewsSource[] }) {
  const [health, setHealth] = useState(getFeedHealth);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const refresh = () => setHealth(getFeedHealth());
    window.addEventListener('feed-health', refresh);
    return () => window.removeEventListener('feed-health', refresh);
  }, []);

  const rows = sources.map((s) => ({ ...s, h: health[s.url], state: stateOf(health[s.url]) }));
  const bad = rows.filter((r) => r.state === 'failing' || r.state === 'empty').length;
  const ok = rows.filter((r) => r.state === 'ok').length;

  return (
    <div className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-150"
        title="Show each source's status"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Sources: {ok} of {rows.length} working
        {bad > 0 && <span className="text-red-500 dark:text-red-400">· {bad} failing</span>}
      </button>
      {open && (
        <ul className="mt-1.5 ml-4 flex flex-col gap-1">
          {rows.map((r) => (
            <li key={r.url} className="flex items-start gap-2">
              <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT[r.state]}`} aria-hidden="true" />
              <span className="min-w-0">
                <span className="font-medium text-zinc-600 dark:text-zinc-300">{r.name}</span>
                {' — '}
                {r.state === 'ok' && <>loaded {ago(r.h?.lastOk)}{typeof r.h?.items === 'number' ? ` · ${r.h.items} item${r.h.items === 1 ? '' : 's'}` : ''}</>}
                {r.state === 'empty' && <>returned no articles {ago(r.h?.lastError)}</>}
                {r.state === 'failing' && (
                  <>
                    <span className="text-red-500 dark:text-red-400">failing</span> since {ago(r.h?.lastError)}
                    {r.h?.lastOk ? `, last worked ${ago(r.h.lastOk)}` : ', never worked on this browser'}
                    {r.h?.error ? <span className="block truncate" title={r.h.error}>{r.h.error}</span> : null}
                  </>
                )}
                {r.state === 'unknown' && <>not loaded yet on this browser</>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
