import React, { useEffect, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { getWidgetConfig } from '../../lib/portalStorage';
import { getAreas } from '../../lib/flights';
import { TrackedFlight, parseFlightQuery } from '../../lib/flightTrack';
import TrackedFlights from './TrackedFlights';

// One flight in its own browser tab: /?track=DL1234 (opened by the Track box on
// the Flights page). The tab is titled with the flight number. Nothing is saved
// to the portal's tracked list; close the tab and it stops tracking.
export default function TrackPage({ query }: { query: string }) {
  useTheme(); // applies the portal's light/dark setting to this tab too
  const q = query.trim().toUpperCase().replace(/\s+/g, ' ');
  const parsed = parseFlightQuery(q);
  const [tracked, setTracked] = useState<TrackedFlight[]>(() =>
    parsed
      // Stable id, so reopening the same flight picks its trail back up.
      ? [{ id: `tab-${parsed.value}`, query: q, ...parsed, alerts: false, addedAt: Date.now() }]
      : []
  );
  const homeArea = getAreas(getWidgetConfig('flights'))[0];

  useEffect(() => {
    document.title = q || 'Flight';
  }, [q]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 sm:p-6">
      <div className="mx-auto" style={{ maxWidth: 900 }}>
        {parsed ? (
          <TrackedFlights tracked={tracked} onChange={setTracked} homeArea={homeArea} standalone />
        ) : (
          <p className="text-sm text-red-500">
            "{q}" isn't a flight number or tail number. Try something like DL1234 or N123DL.
          </p>
        )}
      </div>
    </div>
  );
}
