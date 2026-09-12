import React from 'react';
import { CheckCircle2, AlertTriangle, CalendarClock } from 'lucide-react';

// A calm one-line-per-fact summary — explicitly NOT a notification center.
// No dismiss buttons, no badges, no red dots. Just "here's what's on your
// plate today," in plain restrained text. Renders nothing dramatic when
// there's nothing due — the empty state is the whole point of "calm."

export interface AttentionCounts {
  tasksDueToday: number;
  tasksOverdue: number;
  eventsToday: number;
}

export default function AttentionSummary({ counts }: { counts: AttentionCounts }) {
  const { tasksDueToday, tasksOverdue, eventsToday } = counts;
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
        <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
          <CalendarClock size={15} className="flex-shrink-0" />
          {eventsToday} event{eventsToday === 1 ? '' : 's'} today
        </div>
      )}
    </div>
  );
}
