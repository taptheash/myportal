import React, { useState, useEffect } from 'react';
import { Plus, AlertCircle, ChevronRight } from 'lucide-react';

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

export default function Calendar({ config, onUpdateConfig, isEditing }: CalendarProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
  });

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
    const interval = setInterval(fetchEvents, 300000); // Refresh every 5 mins
    return () => clearInterval(interval);
  }, [isEditing]);

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

      if (!response.ok) {
        throw new Error('Failed to create event');
      }

      // Refresh events
      const eventsResponse = await fetch('/api/calendar/events');
      const data = await eventsResponse.json();
      setEvents(data.events || []);

      // Reset form
      setNewEvent({ title: '', date: new Date().toISOString().split('T')[0], time: '10:00' });
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
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

  // Get today's and tomorrow's events
  const now = new Date();
  const upcomingEvents = events
    .filter((event) => {
      const eventDate = new Date((event.start.dateTime || event.start.date) as string);
      return eventDate >= now;
    })
    .slice(0, 5);

  return (
    <div className="h-full flex flex-col">
      {/* Create Event Form */}
      {showCreateForm && (
        <div className="mb-4 p-3 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900 rounded-lg">
          <input
            type="text"
            placeholder="Event title"
            value={newEvent.title}
            onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
            className="w-full px-2 py-1 mb-2 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-600"
            autoFocus
          />
          <div className="flex gap-2 mb-2">
            <input
              type="date"
              value={newEvent.date}
              onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
              className="flex-1 px-2 py-1 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-600"
            />
            <input
              type="time"
              value={newEvent.time}
              onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
              className="flex-1 px-2 py-1 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-600"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateEvent}
              className="flex-1 px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm font-semibold transition"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="flex-1 px-2 py-1 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white rounded text-sm font-semibold transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Create Event Button */}
      {!showCreateForm && (
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
          upcomingEvents.map((event) => (
            <div
              key={event.id}
              className="p-2 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-slate-700 dark:to-slate-600 rounded-lg border-l-4 border-purple-500 hover:shadow-md transition"
            >
              <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                {event.summary}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <ChevronRight size={12} />
                {formatEventTime(event)}
              </p>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-4">
            No upcoming events
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
        {events.length} events in calendar
      </div>
    </div>
  );
}
