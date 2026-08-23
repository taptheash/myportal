import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
}

export default function Calendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newEvent, setNewEvent] = useState({
    summary: '',
    description: '',
    startTime: '',
    endTime: '',
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/calendar/events');
      if (!response.ok) throw new Error('Failed to fetch events');
      const data = await response.json();
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading events');
    } finally {
      setLoading(false);
    }
  };

  const addEvent = async () => {
    if (!newEvent.summary.trim() || !newEvent.startTime || !newEvent.endTime) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: newEvent.summary,
          description: newEvent.description,
          startTime: newEvent.startTime,
          endTime: newEvent.endTime,
        }),
      });

      if (!response.ok) throw new Error('Failed to create event');
      setNewEvent({ summary: '', description: '', startTime: '', endTime: '' });
      setShowAdd(false);
      await fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating event');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateTimeString?: string) => {
    if (!dateTimeString) return '';
    const date = new Date(dateTimeString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && events.length === 0) {
    return <div className="text-sm text-gray-600 dark:text-gray-400">Loading...</div>;
  }

  if (error && events.length === 0) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-red-600">{error}</div>
        <button
          onClick={fetchEvents}
          className="w-full px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Events list */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {events.length === 0 ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">No upcoming events</div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="p-2 rounded bg-gray-100 dark:bg-gray-800 text-sm"
            >
              <div className="font-semibold text-gray-900 dark:text-gray-100">
                {event.summary}
              </div>
              {event.description && (
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {event.description}
                </div>
              )}
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formatTime(event.start?.dateTime)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add event form */}
      {showAdd ? (
        <div className="space-y-2 p-3 bg-gray-100 dark:bg-gray-800 rounded">
          <input
            type="text"
            placeholder="Event title"
            value={newEvent.summary}
            onChange={(e) => setNewEvent({ ...newEvent, summary: e.target.value })}
            className="w-full px-2 py-1 text-sm rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newEvent.description}
            onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
            className="w-full px-2 py-1 text-sm rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <input
            type="datetime-local"
            value={newEvent.startTime}
            onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
            className="w-full px-2 py-1 text-sm rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <input
            type="datetime-local"
            value={newEvent.endTime}
            onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
            className="w-full px-2 py-1 text-sm rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <div className="flex gap-2">
            <button
              onClick={addEvent}
              className="flex-1 px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
            >
              Create
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="flex-1 px-3 py-1 text-sm bg-gray-400 text-white rounded hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Add Event
        </button>
      )}
    </div>
  );
}
