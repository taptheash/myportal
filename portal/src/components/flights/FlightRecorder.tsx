import { useCallback, useEffect, useRef } from 'react';
import { TrackedFlight, fetchTracked, addTrailPoint, trailKeyOf } from '../../lib/flightTrack';

// Records the track of every flight you are tracking. It is mounted once, in
// App, so it keeps going on every page of the portal and while the tab is in
// the background or another window is in front (browsers slow a background
// tab's timers to about once a minute, which is still plenty for a track).
// The Flights page only reads what this has saved.
//
// It can't record while the browser is closed. When you come back, the gap is
// filled from OpenSky's path-since-takeoff where OpenSky has it.
const POLL_MS = 15000;

export default function FlightRecorder({ tracked }: { tracked: TrackedFlight[] }) {
  const trackedRef = useRef(tracked);
  trackedRef.current = tracked;
  const busy = useRef(false);
  const key = tracked.map((t) => `${t.kind}:${t.value}`).join(',');

  const record = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      await Promise.all(trackedRef.current.map(async (t) => {
        try {
          const a = await fetchTracked(t);
          if (a) addTrailPoint(trailKeyOf(t), a);
        } catch { /* feed trouble: try again next time */ }
      }));
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (!key) return;
    record();
    const timer = setInterval(record, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') record(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', record);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', record);
    };
  }, [key, record]);

  return null;
}
