import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, CalendarClock, ChevronDown, ChevronRight } from 'lucide-react';
import { CalendarEvent, eventTime } from './TodayAgenda';

// A calm one-line-per-fact summary — explicitly NOT a notification center.
// No dismiss buttons, no badges, no red dots. Just "here's what's on your
// plate today," in plain restrained text. Renders nothing dramatic when
// there's nothing due — the empty state is the whole point of "calm."

export interface AttentionCounts {
  tasksDueToday: number;
  tasksOverdue: number;
  eventsToday: number;
}

export default function AttentionSummary({ counts, events = [] }: { counts: AttentionCounts; events?: CalendarEvent[] }) {
  const { tasksDueToday, tasksOverdue, eventsToday } = counts;
  const [showEvents, setShowEvents] = useState(false);
  const hasAnything = tasksDueToday > 0 || tasksOverdue > 0 || eventsToday > 0;

  if (!hasAnything) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
        Nothing urgent today — you're caught up.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {tasksOverdue > 0 && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle size={15} className="flex-shrink-0" />
          {tasksOverdue} task{tasksOverdue === 1 ? '' : 's'} overdue
        </div>
      )}
      {tasksDueToday > 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <CheckCircle2 size={15} className="flex-shrink-0" />
          {tasksDueToday} task{tasksDueToday === 1 ? '' : 's'} due today
        </div>
      )}
      {eventsToday > 0 && (
        <div>
          {/* Click to see what the events are. */}
          <button onClick={() => setShowEvents(!showEvents)} aria-expanded={showEvents}
            className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
            <CalendarClock size={15} className="flex-shrink-0" />
            {eventsToday} event{eventsToday === 1 ? '' : 's'} today
            {showEvents ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {showEvents && (
            <div className="mt-1.5 ml-6 flex flex-col gap-1">
              {events.map((e) => {
                const row = (
                  <>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums w-16 flex-shrink-0">{eventTime(e)}</span>
                    <span className="text-sm text-zinc-800 dark:text-zinc-100 truncate">{e.summary || '(No title)'}</span>
                  </>
                );
                return e.htmlLink ? (
                  <a key={e.id} href={e.htmlLink} target="_blank" rel="noopener noreferrer" title="Open in Google Calendar"
                    className="flex items-center gap-2 rounded-md px-1.5 py-0.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60">{row}</a>
                ) : (
                  <div key={e.id} className="flex items-center gap-2 px-1.5 py-0.5">{row}</div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
