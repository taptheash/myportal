import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plane, X } from 'lucide-react';
import {
  FlightWatch, fetchWatched, describeSighting, readWatchStates, writeWatchStates,
} from '../../lib/flightWatch';
import { navigateTo } from '../../lib/portalNav';

// Runs on every page of the portal (it's mounted once, in App) and tells you
// when a watched flight number or tail number shows up on the live feed, with
// a desktop notification and an on-screen toast.
//
// "Active" means the aircraft is on the feed at all, in the air or on the
// ground. You're alerted when it goes from not-on-the-feed to on-the-feed.
// It re-arms once it has been off the feed for MISSES_TO_REARM checks in a
// row, so a dropped reading doesn't alert twice but tomorrow's flight does.
// The first time a watch is ever checked it never alerts (the list just shows
// "Active now"), so adding a flight that's already up doesn't ping you.
//
// It only runs while the portal is open in a browser tab (a background tab is
// fine; browsers slow background timers but they keep running).
const POLL_MS = 60_000;
const MISSES_TO_REARM = 3;

interface Toast { id: number; text: string }

export default function FlightWatcher({ watches }: { watches: FlightWatch[] }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const watchesRef = useRef(watches);
  watchesRef.current = watches;
  const misses = useRef<Record<string, number>>({});
  const busy = useRef(false);
  const key = watches.filter((w) => w.enabled).map((w) => `${w.id}`).join(',');

  const alertUser = useCallback((w: FlightWatch, summary: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text: `${w.query} is active: ${summary}` }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 15000);
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        // `tag` makes the OS replace a duplicate if the portal is open twice.
        const n = new Notification(`${w.query} is active`, { body: summary, tag: `flight-watch-${w.id}` });
        n.onclick = () => { window.focus(); navigateTo('flights'); n.close(); };
      }
    } catch { /* notifications unavailable */ }
  }, []);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const list = watchesRef.current.filter((w) => w.enabled);
      const states = readWatchStates();
      let changed = false;
      await Promise.all(list.map(async (w) => {
        let a;
        try { a = await fetchWatched(w); } catch { return; } // feed trouble isn't "not seen"
        const prev = states[w.id];
        const now = Date.now();
        if (a) {
          misses.current[w.id] = 0;
          const summary = describeSighting(a);
          if (prev && !prev.active) alertUser(w, summary);
          states[w.id] = { active: true, since: !prev || !prev.active ? now : prev.since, seen: now, summary };
          changed = true;
        } else {
          const m = (misses.current[w.id] || 0) + 1;
          misses.current[w.id] = m;
          if (!prev) {
            states[w.id] = { active: false, since: now, seen: 0, summary: '' };
            changed = true;
          } else if (prev.active && m >= MISSES_TO_REARM) {
            states[w.id] = { ...prev, active: false, since: now };
            changed = true;
          }
        }
      }));
      // Forget the state of watches that were removed.
      for (const id of Object.keys(states)) {
        if (!watchesRef.current.some((w) => w.id === id)) { delete states[id]; changed = true; }
      }
      if (changed) writeWatchStates(states);
    } finally {
      busy.current = false;
    }
  }, [alertUser]);

  useEffect(() => {
    if (!key) return;
    check();
    const timer = setInterval(check, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', check);
    };
  }, [key, check]);

  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[300] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div key={t.id} role="status" className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-zinc-900 text-white shadow-lg text-sm">
          <Plane size={16} className="mt-0.5 flex-shrink-0 text-amber-400" />
          <button className="flex-1 min-w-0 text-left" onClick={() => { navigateTo('flights'); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>
            {t.text}
          </button>
          <button aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-zinc-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
