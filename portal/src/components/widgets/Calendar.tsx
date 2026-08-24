import React, { useState, useEffect } from 'react';
import { Plus, AlertCircle, ChevronRight, Trash2, Pencil } from 'lucide-react';

interface CalendarProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
}

interface EventFormValues {
  title: string;
  date: string;
  time: string;
}

function toLocalDateTimeParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function EventForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  values: EventFormValues;
  onChange: (values: EventFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="p-3 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900 rounded-lg">
      <input
        type="text"
        placeholder="Event title"
        value={values.title}
        onChange={(e) => onChange({ ...values, title: e.target.value })}
        className="w-full px-2 py-1 mb-2 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-600"
        autoFocus
      />
      <div className="flex gap-2 mb-2">
        <input
          type="date"
          value={values.date}
          onChange={(e) => onChange({ ...values, date: e.target.value })}
          className="flex-1 px-2 py-1 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-600"
        />
        <input
          type="time"
          value={values.time}
          onChange={(e) => onChange({ ...values, time: e.target.value })}
          className="flex-1 px-2 py-1 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-600"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          className="flex-1 px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm font-semibold transition"
        >
          {submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 px-2 py-1 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white rounded text-sm font-semibold transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Calendar({ config, onUpdateConfig, isEditing }: CalendarProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEvent, setNewEvent] = useState<EventFormValues>({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEvent, setEditEvent] = useState<EventFormValues>({ title: '', date: '', time: '' });

  // Fetch events from backend
  useEffect(() => {
    if (isEditing) return;

    const fetchEvents = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/calendar/events');

        if (!response.ok) {
          throw new Error('Failed to fetch calendar events');
        }

        const data = await response.json();
        setEvents(data.events || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching events');
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 3600000); // Refresh every hour
    return () => clearInterval(interval);
  }, [isEditing]);

  const refreshEvents = async () => {
    const response = await fetch('/api/calendar/events');
    const data = await response.json();
    setEvents(data.events || []);
  };

  const handleCreateEvent = async () => {
    if (!newEvent.title.trim()) return;

    try {
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: newEvent.title,
          startDateTime: `${newEvent.date}T${newEvent.time}:00`,
        }),
      });

      if (!response.ok) throw new Error('Failed to create event');

      await refreshEvents();
      setNewEvent({ title: '', date: new Date().toISOString().split('T')[0], time: '10:00' });
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    }
  };

  const startEdit = (event: CalendarEvent) => {
    const source = event.start.dateTime || event.start.date;
    const parts = source ? toLocalDateTimeParts(source) : { date: '', time: '10:00' };
    setEditEvent({ title: event.summary, date: parts.date, time: parts.time });
    setEditingId(event.id);
    setShowCreateForm(false);
  };

  const handleUpdateEvent = async () => {
    if (!editingId || !editEvent.title.trim()) return;

    try {
      const response = await fetch(`/api/calendar/events?id=${encodeURIComponent(editingId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: editEvent.title,
          startDateTime: `${editEvent.date}T${editEvent.time}:00`,
        }),
      });

      if (!response.ok) throw new Error('Failed to update event');

      await refreshEvents();
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    const previous = events;
    setEvents(events.filter((e) => e.id !== eventId)); // optimistic
    try {
      const response = await fetch(`/api/calendar/events?id=${encodeURIComponent(eventId)}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete event');
    } catch (err) {
      setEvents(previous); // revert on failure
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    }
  };

  const formatEventTime = (event: CalendarEvent) => {
    const start = event.start.dateTime || event.start.date;
    if (!start) return '';

    const date = new Date(start);
    return date.toLocaleTimeString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isEditing) {
    return (
      <div className="text-center text-gray-600 dark:text-gray-400 text-sm">
        <p className="mb-3">📅 Google Calendar Setup</p>
        <p className="text-xs leading-relaxed">
          To enable calendar integration:
        </p>
        <ol className="text-xs mt-2 space-y-1 text-left text-gray-600 dark:text-gray-400">
          <li>1. Create service account on Google Cloud</li>
          <li>2. Enable Google Calendar API</li>
          <li>3. Share calendar with service account email</li>
          <li>4. Add service account JSON to backend</li>
        </ol>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-current"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-amber-600 dark:text-amber-500">
        <AlertCircle size={20} />
        <p className="text-xs text-center">{error}</p>
        <p className="text-xs text-gray-500">Check backend configuration</p>
      </div>
    );
  }

  // Get upcoming events, capped to the user's configured display count
  const now = new Date();
  const eventCount = config.eventCount || 5;
  const upcomingEvents = events
    .filter((event) => {
      const eventDate = new Date((event.start.dateTime || event.start.date) as string);
      return eventDate >= now;
    })
    .slice(0, eventCount);

  return (
    <div className="h-full flex flex-col">
      {/* Create Event Form */}
      {showCreateForm && (
        <div className="mb-4">
          <EventForm
            values={newEvent}
            onChange={setNewEvent}
            onSubmit={handleCreateEvent}
            onCancel={() => setShowCreateForm(false)}
            submitLabel="Create"
          />
        </div>
      )}

      {/* Create Event Button */}
      {!showCreateForm && !editingId && (
        <button
          onClick={() => setShowCreateForm(true)}
          className="mb-3 w-full px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition text-sm"
        >
          <Plus size={16} />
          New Event
        </button>
      )}

      {/* Events List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {upcomingEvents.length > 0 ? (
          upcomingEvents.map((event) =>
            editingId === event.id ? (
              <EventForm
                key={event.id}
                values={editEvent}
                onChange={setEditEvent}
                onSubmit={handleUpdateEvent}
                onCancel={() => setEditingId(null)}
                submitLabel="Save"
              />
            ) : (
              <div
                key={event.id}
                className="group p-2 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-slate-700 dark:to-slate-600 rounded-lg border-l-4 border-purple-500 hover:shadow-md transition flex items-start justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                    {event.summary}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <ChevronRight size={12} />
                    {formatEventTime(event)}
                  </p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => startEdit(event)}
                    title="Edit event"
                    className="p-1 rounded-md text-gray-400 hover:bg-purple-200 hover:text-purple-700 dark:hover:bg-purple-900/40 dark:hover:text-purple-300 transition"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    title="Delete event"
                    className="p-1 rounded-md text-gray-400 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/40 dark:hover:text-red-400 transition"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          )
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-4">
            No upcoming events
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
        {upcomingEvents.length} events shown
      </div>
    </div>
  );
}
