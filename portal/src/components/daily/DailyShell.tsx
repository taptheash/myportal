import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';
import { DailyKind, fetchDailyIndex, fetchDailyEntry, todayKey, formatDay } from '../../lib/dailyContent';

interface Props<T> {
  kind: DailyKind;
  emptyText: string;
  render: (entry: T, date: string) => React.ReactNode;
}

// Shared frame for the three Daily tabs: loads the day index, shows the
// newest entry, and lets you page back through the archive. If the newest
// entry isn't today's (a scheduled run failed or hasn't happened yet) it says
// so instead of quietly showing old content.
export default function DailyShell<T extends { sample?: boolean }>({ kind, emptyText, render }: Props<T>) {
  const [dates, setDates] = useState<string[] | null>(null);
  const [pos, setPos] = useState(0);
  const [entry, setEntry] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const cache = useRef(new Map<string, T>());

  useEffect(() => {
    let cancelled = false;
    fetchDailyIndex(kind).then((d) => {
      if (cancelled) return;
      setDates(d);
      if (d.length === 0) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [kind]);

  useEffect(() => {
    if (!dates || dates.length === 0) return;
    const date = dates[pos];
    const hit = cache.current.get(date);
    if (hit) {
      setEntry(hit);
      setFailed(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchDailyEntry<T>(kind, date).then((e) => {
      if (cancelled) return;
      if (e) {
        cache.current.set(date, e);
        setEntry(e);
        setFailed(false);
      } else {
        setFailed(true);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [dates, pos, kind]);

  if (dates === null) {
    return <div className="py-16 flex justify-center"><Loader2 size={18} className="animate-spin text-zinc-400" /></div>;
  }
  if (dates.length === 0) {
    return <p className="py-16 text-center text-sm text-zinc-400">{emptyText}</p>;
  }

  const date = dates[pos];
  const stale = pos === 0 && date !== todayKey();
  const navBtn = 'p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors duration-150';

  return (
    <div className="flex flex-col gap-3 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button className={navBtn} onClick={() => setPos(pos + 1)} disabled={pos >= dates.length - 1} aria-label="Older">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 min-w-[9rem] text-center">{formatDay(date, true)}</span>
          <button className={navBtn} onClick={() => setPos(pos - 1)} disabled={pos <= 0} aria-label="Newer">
            <ChevronRight size={16} />
          </button>
        </div>
        {pos > 0 && (
          <button onClick={() => setPos(0)} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
            Back to latest
          </button>
        )}
      </div>

      {stale && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs px-3 py-2">
          <AlertTriangle size={13} className="flex-shrink-0" />
          Not updated today. Showing the latest available, from {formatDay(date)}.
        </div>
      )}
      {entry?.sample && !failed && (
        <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs px-3 py-2">
          Sample content. The first real entry appears after the daily task runs.
        </div>
      )}

      {loading && <div className="py-12 flex justify-center"><Loader2 size={18} className="animate-spin text-zinc-400" /></div>}
      {!loading && failed && <p className="py-12 text-center text-sm text-zinc-400">Couldn't load {formatDay(date)}.</p>}
      {!loading && !failed && entry && render(entry, date)}
    </div>
  );
}
