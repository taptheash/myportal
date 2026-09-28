import React, { useEffect, useState } from 'react';
import { getWidgetConfig } from '../../lib/portalStorage';
import { getActiveArea, fetchAircraft, inArea, Tracked, lookupRoute, cachedRoute, RouteInfo, emergency } from '../../lib/flights';

// Home's mini FlightWall: how many aircraft are in your active Flights area
// and the nearest few, on the same black LED panel.
export default function FlightsHighlight() {
  const [flights, setFlights] = useState<Tracked[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [routes, setRoutes] = useState<Record<string, RouteInfo>>({});
  const area = getActiveArea(getWidgetConfig('flights'));

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const list = inArea(await fetchAircraft(area), area);
          if (cancelled) return;
          setFlights(list);
          setFailed(false);
          list.slice(0, 3).forEach((f) => {
            if (!f.callsign) return;
            const hit = cachedRoute(f.callsign);
            if (hit) setRoutes((r) => ({ ...r, [f.callsign!]: hit }));
            else lookupRoute(f.callsign).then((r) => !cancelled && setRoutes((p) => ({ ...p, [f.callsign!]: r })));
          });
        } catch {
          if (!cancelled) setFailed(true);
        }
      }
      if (!cancelled) timer = setTimeout(run, 30000);
    };
    run();
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="led-panel led-text rounded-lg px-3 py-2">
      <div className="flex justify-between text-lg">
        <span className="led-amber">{area.name.toUpperCase()}</span>
        <span className={failed ? 'led-red' : 'led-green'}>
          {failed ? 'NO SIGNAL' : flights === null ? 'SCANNING…' : `${String(flights.length).padStart(2, '0')} AIRCRAFT`}
        </span>
      </div>
      {flights && flights.length === 0 && !failed && <div className="led-dim text-lg">CLEAR SKIES</div>}
      {flights?.slice(0, 3).map((f) => {
        const r = f.callsign ? routes[f.callsign] : undefined;
        const route = r?.found ? `${r.origin?.iata || r.origin?.icao || '???'}→${r.destination?.iata || r.destination?.icao || '???'}` : '';
        return (
          <div key={f.hex} className="flex gap-3 text-lg leading-tight">
            <span className={emergency(f.squawk) || f.military ? 'led-red w-20 truncate' : 'led-amber w-20 truncate'}>{f.callsign || f.reg || f.hex.toUpperCase()}</span>
            <span className="led-cyan w-20 truncate">{route}</span>
            <span className="led-green">{f.onGround ? "GND" : f.alt === null ? "—" : (Math.round(f.alt / 100) * 100).toLocaleString("en-US")}</span>
            <span className="led-dim ml-auto">{f.distMi.toFixed(1)}MI</span>
          </div>
        );
      })}
    </div>
  );
}
