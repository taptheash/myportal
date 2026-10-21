// Flight watch list: flight numbers or tail numbers you want to hear about
// when they show up on the live ADS-B feed. Unlike "Track a flight" (which only
// runs while the Flights page is open), the watcher in components/flights/
// FlightWatcher.tsx runs on every page of the portal.
import { useEffect, useState } from 'react';
import { Aircraft, isOnGround, typeName } from './flights';
import { parseFlightQuery } from './flightTrack';

export interface FlightWatch {
  id: string;
  query: string;            // what you typed, e.g. "DL1234" or "N718BA"
  kind: 'callsign' | 'reg';
  value: string;            // what the feed is asked for, e.g. "DAL1234"
  enabled: boolean;
  addedAt: number;
}

export const MAX_WATCHES = 10;

// The watch list itself lives in localStorage under this key (and syncs with
// your other devices). What the watcher last saw is per device, below.
export const WATCH_KEY = 'pw6-flight-watch';

export interface WatchState {
  active: boolean;   // on the feed right now
  since: number;     // when it last changed between active and not
  seen: number;      // last time it was on the feed (0 = never)
  summary: string;   // e.g. "airborne at 12,400 ft · 280 kt"
}
export type WatchStates = Record<string, WatchState>;

const STATE_KEY = 'pw6-flight-watch-state';
const STATE_EVENT = 'pw6-flight-watch-state';

export function readWatchStates(): WatchStates {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}') || {}; } catch { return {}; }
}

export function writeWatchStates(states: WatchStates) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(states)); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(STATE_EVENT));
}

// Re-renders when the watcher records a change.
export function useWatchStates(): WatchStates {
  const [states, setStates] = useState<WatchStates>(readWatchStates);
  useEffect(() => {
    const refresh = () => setStates(readWatchStates());
    window.addEventListener(STATE_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(STATE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return states;
}

// Turns what you typed into a watch, or says why it can't.
export function newWatch(input: string, existing: FlightWatch[]): { watch: FlightWatch } | { error: string } {
  const parsed = parseFlightQuery(input);
  if (!parsed) return { error: "That doesn't look like a flight number (DL1234) or tail number (N123DL)." };
  if (existing.some((w) => w.kind === parsed.kind && w.value === parsed.value)) return { error: `You're already watching ${input.trim().toUpperCase()}.` };
  if (existing.length >= MAX_WATCHES) return { error: `You can watch up to ${MAX_WATCHES} flights. Remove one first.` };
  return {
    watch: {
      id: `${parsed.kind}:${parsed.value}`,
      query: input.trim().toUpperCase().replace(/\s+/g, ''),
      kind: parsed.kind,
      value: parsed.value,
      enabled: true,
      addedAt: Date.now(),
    },
  };
}

// Same endpoint "Track a flight" uses. Resolves null when the flight isn't on
// the feed; throws when the feed itself is unavailable.
export async function fetchWatched(w: Pick<FlightWatch, 'kind' | 'value'>): Promise<Aircraft | null> {
  const res = await fetch(`/api/flight-track?${w.kind === 'reg' ? 'reg' : 'callsign'}=${encodeURIComponent(w.value)}`);
  if (!res.ok) throw new Error(`Tracking feed unavailable (HTTP ${res.status})`);
  const data = await res.json();
  return data.found ? data.aircraft : null;
}

// One line saying what the aircraft is doing, for the alert and the list.
export function describeSighting(a: Aircraft): string {
  const parts: string[] = [];
  const who = [a.callsign, a.reg].filter(Boolean).join(' / ');
  if (who) parts.push(who);
  if (a.type) parts.push(typeName(a.type));
  if (isOnGround(a)) {
    parts.push('on the ground');
  } else {
    parts.push(a.alt !== null ? `airborne at ${a.alt.toLocaleString('en-US')} ft` : 'airborne');
    if (a.gs !== null) parts.push(`${Math.round(a.gs)} kt`);
  }
  return parts.join(' · ');
}
