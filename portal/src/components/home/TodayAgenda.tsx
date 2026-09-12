import React, { useState, useEffect } from 'react';
import { ChevronRight, Loader2, AlertCircle } from 'lucide-react';

// Home's compact "today only" calendar view — same /api/calendar/events
// endpoint the full Calendar tab uses, filtered down to just today's events.
// Reports its count upward via onCount so the Attention module can fold
// "events today" into its summary without a second fetch.

interface CalendarEvent {
  id: string;
  summary: string;
  htmlLink?: string;
  start: { dateTime?: string; date?: string };
}

export default function TodayAgenda({ onCount }: { onCount?: (n: number) => void }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/calendar/events');
        if (!res.ok) throw new Error('Failed to fetch calendar events');
        const data = await res.json();
        const now = new Date();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        const todays = (data.events || []).filter((e: CalendarEvent) => {
          const start = e.start.dateTime || e.start.date;
          if (!start) return false;
          const d = new Date(start);
          return d >= now && d <= endOfDay;
        });
        setEvents(todays);
        onCount?.(todays.length);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load calendar');
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 size={16} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-zinc-400 dark:text-zinc-500">
        <AlertCircle size={13} /> Calendar unavailable
      </div>
    );
  }

  if (events.length === 0) {
    return <p className="text-xs text-zinc-400 dark:text-zinc-500 py-1">Nothing left on your calendar today.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {events.map((e) => {
        const start = e.start.dateTime || e.start.date;
        const time = start
          ? new Date(start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          : '';
        const Row = (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors duration-150">
            <ChevronRight size={12} className="text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
            <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums flex-shrink-0 w-16">{time}</span>
            <span className="text-sm text-zinc-800 dark:text-zinc-100 truncate">{e.summary}</span>
          </div>
        );
        return e.htmlLink ? (
          <a key={e.id} href={e.htmlLink} target="_blank" rel="noopener noreferrer">{Row}</a>
        ) : (
          <div key={e.id}>{Row}</div>
        );
      })}
    </div>
  );
}
