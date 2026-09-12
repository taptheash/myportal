import { getWidgetConfig } from './portalStorage';
import { getAllTaskItems } from '../components/widgets/Notes';

// "What needs your attention today" — a calm, factual summary, not a
// notification center. Deliberately just counts: tasks due today/overdue,
// and calendar events happening today. No AI summarization, no alerts UI.

export interface AttentionSummary {
  tasksDueToday: number;
  tasksOverdue: number;
  eventsToday: number;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getAttentionSummary(): AttentionSummary {
  const tasksConfig = getWidgetConfig('tasks');
  const allTasks = getAllTaskItems(tasksConfig);
  const today = todayKey();

  let tasksDueToday = 0;
  let tasksOverdue = 0;
  for (const t of allTasks) {
    if (t.done || !t.dueDate) continue;
    if (t.dueDate === today) tasksDueToday += 1;
    else if (t.dueDate < today) tasksOverdue += 1;
  }

  // Calendar events are fetched from a backend API at render time by the
  // Calendar widget itself (not persisted to localStorage), so this summary
  // can't count them synchronously from storage — Home's own "Today" module
  // fetches /api/calendar/events directly and combines the count itself.
  return { tasksDueToday, tasksOverdue, eventsToday: 0 };
}
