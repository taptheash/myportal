import React, { useState } from 'react';
import { Bell, BellOff, BellRing, X } from 'lucide-react';
import { FlightWatch, MAX_WATCHES, WatchState, newWatch, useWatchStates } from '../../lib/flightWatch';

// "Watch for a flight": get a notification when a flight number or tail number
// shows up on the live feed, from any page of the portal. The checking itself
// is FlightWatcher (mounted in App); this is the list you manage it with.

type Perm = NotificationPermission | 'unsupported';
const readPerm = (): Perm => (typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported');

function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 90) return 'just now';
  const m = Math.round(s / 60);
  if (m < 90) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 36 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

function statusOf(w: FlightWatch, st: WatchState | undefined): { dot: string; text: string } {
  if (!w.enabled) return { dot: 'bg-zinc-300 dark:bg-zinc-600', text: 'Paused' };
  if (!st) return { dot: 'bg-zinc-300 dark:bg-zinc-600', text: 'Checking…' };
  if (st.active) return { dot: 'bg-emerald-500', text: `Active now · ${st.summary}` };
  return { dot: 'bg-zinc-300 dark:bg-zinc-600', text: st.seen ? `Not on the feed · last seen ${ago(st.seen)}` : 'Not on the feed yet' };
}

export default function WatchBox({ watches, onChange }: { watches: FlightWatch[]; onChange: (next: FlightWatch[]) => void }) {
  const states = useWatchStates();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [perm, setPerm] = useState<Perm>(readPerm);

  const askPermission = async () => {
    if (perm !== 'default') return;
    try { setPerm(await Notification.requestPermission()); } catch { /* ignore */ }
  };

  const add = () => {
    const r = newWatch(input, watches);
    if ('error' in r) { setError(r.error); return; }
    askPermission(); // called straight from the click, as browsers require
    onChange([...watches, r.watch]);
    setInput('');
    setError('');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mr-1">Watch for a flight</h3>
        <div className="flex items-center gap-1.5 flex-1 min-w-[260px] max-w-md">
          <div className="relative flex-1">
            <BellRing size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Flight number (DL1234) or tail number (N123DL)"
              className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <button onClick={add} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors duration-150">Watch</button>
        </div>
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{watches.length}/{MAX_WATCHES}</span>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}

      {watches.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {watches.map((w) => {
            const s = statusOf(w, states[w.id]);
            return (
              <li key={w.id} className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} aria-hidden="true" />
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 tabular-nums">{w.query}</span>
                <span className="flex-1 min-w-0 truncate text-xs text-zinc-500 dark:text-zinc-400">{s.text}</span>
                <button
                  onClick={() => onChange(watches.map((x) => (x.id === w.id ? { ...x, enabled: !x.enabled } : x)))}
                  title={w.enabled ? 'Pause this watch' : 'Resume this watch'}
                  aria-pressed={w.enabled}
                  className="p-1 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  {w.enabled ? <Bell size={14} /> : <BellOff size={14} />}
                </button>
                <button
                  onClick={() => onChange(watches.filter((x) => x.id !== w.id))}
                  title="Stop watching"
                  aria-label={`Stop watching ${w.query}`}
                  className="p-1 rounded text-zinc-400 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {perm === 'default' && watches.length > 0 && (
        <button onClick={askPermission} className="self-start text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
          Allow desktop notifications
        </button>
      )}
      {perm === 'denied' && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Desktop notifications are blocked for this site, so you'll only see the alert inside the portal. Allow them in your browser's site settings.
        </p>
      )}
      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
        You get an alert when the flight first shows up on the feed, in the air or on the ground, on any page of MyPortal while it's open in a browser tab.
        Checked every minute. It alerts again after the flight has left the feed and comes back.
      </p>
    </div>
  );
}
