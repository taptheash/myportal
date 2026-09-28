import React, { useEffect, useMemo, useState } from 'react';
import { Monitor, Rows3, MapPinned, Pause, Play } from 'lucide-react';
import {
  Tracked, RouteInfo, FlightArea, getAreas, getActiveArea, inArea, fetchAircraft,
  lookupRoute, cachedRoute, typeName, compass, emergency,
} from '../../lib/flights';
import AreaEditor from './AreaEditor';

interface Props {
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
}

const POLL_MS = 15000;
const ROTATE_MS = 8000;

const fmtAlt = (a: Tracked) => (a.onGround ? 'GROUND' : a.alt === null ? '—' : `${a.alt.toLocaleString('en-US')} FT`);
const vsArrow = (vs: number | null) => (vs === null || Math.abs(vs) < 300 ? '' : vs > 0 ? '▲' : '▼');
const label = (a: Tracked) => a.callsign || a.reg || a.hex.toUpperCase();

function routeText(r: RouteInfo | undefined): { short: string; long: string } | null {
  if (!r || !r.found || (!r.origin && !r.destination)) return null;
  const code = (p?: RouteInfo['origin']) => p?.iata || p?.icao || '???';
  return {
    short: `${code(r.origin)} → ${code(r.destination)}`,
    long: [r.origin?.city, r.destination?.city].filter(Boolean).join(' → '),
  };
}

export default function FlightWall({ config, onUpdateConfig }: Props) {
  const areas = getAreas(config);
  const area = getActiveArea(config);
  const mode: 'panel' | 'board' = config.mode === 'board' ? 'board' : 'panel';
  const [flights, setFlights] = useState<Tracked[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [routes, setRoutes] = useState<Record<string, RouteInfo>>({});
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [editing, setEditing] = useState(false);
  const areaKey = `${area.lat},${area.lon},${area.radiusMi},${area.minFt},${area.maxFt}`;

  // Poll the feed while this tab is visible.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const list = await fetchAircraft(area);
          if (cancelled) return;
          setFlights(inArea(list, area));
          setStatus('ok');
          setError('');
          setUpdatedAt(Date.now());
        } catch (e) {
          if (cancelled) return;
          setStatus('error');
          setError(e instanceof Error ? e.message : 'Flight feed unavailable');
        }
      }
      if (!cancelled) timer = setTimeout(run, POLL_MS);
    };
    setStatus('loading');
    run();
    const onVis = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); run(); } };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelled = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaKey]);

  // Look up routes for everything in view (cached per callsign).
  useEffect(() => {
    flights.slice(0, 25).forEach((f) => {
      if (!f.callsign || routes[f.callsign]) return;
      const hit = cachedRoute(f.callsign);
      if (hit) { setRoutes((r) => ({ ...r, [f.callsign!]: hit })); return; }
      lookupRoute(f.callsign).then((r) => setRoutes((prev) => ({ ...prev, [f.callsign!]: r })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flights]);

  // Rotate the featured flight.
  useEffect(() => {
    if (mode !== 'panel' || paused || flights.length < 2) return;
    const t = setInterval(() => setIndex((i) => i + 1), ROTATE_MS);
    return () => clearInterval(t);
  }, [mode, paused, flights.length]);

  const featured = flights.length ? flights[index % flights.length] : null;
  const setArea = (id: string) => onUpdateConfig({ ...config, activeAreaId: id });
  const saveAreas = (next: FlightArea[], activeId: string) => {
    onUpdateConfig({ ...config, areas: next, activeAreaId: activeId });
  };

  const clock = useMemo(
    () => (updatedAt ? new Date(updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : '--:--'),
    [updatedAt]
  );

  const btn = 'flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors duration-150';

  return (
    <div className="flex flex-col gap-3">
      {/* Controls (normal UI, outside the LED panel) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
          {areas.map((a) => (
            <button key={a.id} onClick={() => setArea(a.id)}
              className={`${btn} ${a.id === area.id ? 'bg-white dark:bg-zinc-950 shadow-sm text-zinc-900 dark:text-white font-medium' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
              {a.name}
            </button>
          ))}
        </div>
        <button onClick={() => setEditing(!editing)}
          className={`${btn} ${editing ? 'bg-indigo-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>
          <MapPinned size={13} /> {editing ? 'Done' : 'Edit areas'}
        </button>
        <div className="ml-auto flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
          <button onClick={() => onUpdateConfig({ ...config, mode: 'panel' })} title="FlightWall panel: one flight at a time"
            className={`${btn} ${mode === 'panel' ? 'bg-white dark:bg-zinc-950 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>
            <Monitor size={13} /> Wall
          </button>
          <button onClick={() => onUpdateConfig({ ...config, mode: 'board' })} title="Departure board: every flight in the area"
            className={`${btn} ${mode === 'board' ? 'bg-white dark:bg-zinc-950 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>
            <Rows3 size={13} /> Board
          </button>
        </div>
      </div>

      {editing && (
        <AreaEditor areas={areas} activeId={area.id} flights={flights} onSave={saveAreas} />
      )}

      {/* The LED wall */}
      <div className="led-panel rounded-xl border border-zinc-800 overflow-hidden select-none">
        <div className="led-text flex items-center justify-between px-4 py-2 text-lg border-b border-white/5">
          <span className="led-amber">{area.name.toUpperCase()} · {area.radiusMi} MI</span>
          <span className="led-green">{String(flights.length).padStart(2, '0')} AIRCRAFT</span>
          <span className="led-dim">{status === 'error' ? <span className="led-red led-blink">FEED DOWN</span> : clock}</span>
        </div>

        {status === 'loading' && flights.length === 0 ? (
          <div className="led-text led-amber text-3xl px-4 py-12 text-center led-blink">SCANNING…</div>
        ) : status === 'error' && flights.length === 0 ? (
          <div className="led-text px-4 py-10 text-center">
            <div className="led-red text-3xl">NO SIGNAL</div>
            <div className="led-dim text-lg mt-1">{error}</div>
          </div>
        ) : flights.length === 0 ? (
          <div className="led-text px-4 py-12 text-center">
            <div className="led-amber text-3xl">CLEAR SKIES</div>
            <div className="led-dim text-lg mt-1">NO AIRCRAFT WITHIN {area.radiusMi} MI RIGHT NOW</div>
          </div>
        ) : mode === 'panel' && featured ? (
          <FeaturedFlight key={featured.hex + (index % flights.length)} f={featured} route={featured.callsign ? routes[featured.callsign] : undefined}
            count={flights.length} position={index % flights.length} paused={paused}
            onTogglePause={() => setPaused(!paused)} onPick={(i) => setIndex(i)} />
        ) : (
          <Board flights={flights} routes={routes} />
        )}
      </div>
      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
        Live ADS-B from community feeds (adsb.lol, airplanes.live, adsb.fi), updated every 15 seconds while this page is open.
        Routes are the flight's usual scheduled route (adsbdb.com) and are occasionally out of date.
      </p>
    </div>
  );
}

function FeaturedFlight({ f, route, count, position, paused, onTogglePause, onPick }: {
  f: Tracked; route: RouteInfo | undefined; count: number; position: number; paused: boolean;
  onTogglePause: () => void; onPick: (i: number) => void;
}) {
  const rt = routeText(route);
  const emerg = emergency(f.squawk);
  return (
    <div className="led-text led-in px-5 py-5 flex flex-col gap-1.5">
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className={`text-5xl leading-none ${emerg ? 'led-red led-blink' : 'led-amber'}`}>{label(f)}</span>
        {route?.airline && <span className="led-dim text-2xl">{route.airline.toUpperCase()}</span>}
        {f.military && <span className="led-red text-xl">MILITARY</span>}
        {emerg && <span className="led-red text-2xl led-blink">SQUAWK {f.squawk} · {emerg}</span>}
      </div>
      <div className="led-cyan text-4xl leading-tight">
        {rt ? rt.short : f.onGround ? 'ON THE GROUND' : 'ROUTE UNKNOWN'}
        {rt?.long && <span className="led-dim text-2xl ml-3">{rt.long.toUpperCase()}</span>}
      </div>
      <div className="led-green text-3xl flex flex-wrap gap-x-6">
        <span>{fmtAlt(f)} {vsArrow(f.vs)}</span>
        <span>{f.gs === null ? '—' : `${Math.round(f.gs)} KT`}</span>
        <span>HDG {f.track === null ? '—' : `${String(Math.round(f.track)).padStart(3, '0')}° ${compass(f.track)}`}</span>
      </div>
      <div className="led-dim text-2xl flex flex-wrap gap-x-4">
        <span>{typeName(f.type) || 'UNKNOWN TYPE'}</span>
        {f.reg && <span>{f.reg}</span>}
        <span>{f.distMi.toFixed(1)} MI {compass(f.bearing)}</span>
      </div>
      {count > 1 && (
        <div className="flex items-center gap-2 mt-3">
          <button onClick={onTogglePause} className="led-dim hover:text-white transition-colors" title={paused ? 'Resume rotation' : 'Hold this flight'}>
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: Math.min(count, 30) }).map((_, i) => (
              <button key={i} onClick={() => onPick(i)} aria-label={`Show flight ${i + 1}`}
                className={`w-2 h-2 rounded-full ${i === position ? 'bg-[#ffb000] shadow-[0_0_6px_#ffb000]' : 'bg-white/15 hover:bg-white/40'}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Board({ flights, routes }: { flights: Tracked[]; routes: Record<string, RouteInfo> }) {
  const cell = 'px-3 py-1 whitespace-nowrap';
  return (
    <div className="led-text overflow-x-auto">
      <table className="w-full text-xl">
        <thead>
          <tr className="led-dim text-left text-lg">
            <th className={cell}>FLIGHT</th><th className={cell}>ROUTE</th><th className={cell}>TYPE</th>
            <th className={`${cell} text-right`}>ALT</th><th className={`${cell} text-right`}>SPD</th>
            <th className={`${cell} text-right`}>HDG</th><th className={`${cell} text-right`}>DIST</th>
          </tr>
        </thead>
        <tbody>
          {flights.map((f) => {
            const rt = routeText(f.callsign ? routes[f.callsign] : undefined);
            const emerg = emergency(f.squawk);
            return (
              <tr key={f.hex} className="border-t border-white/5">
                <td className={`${cell} ${emerg ? 'led-red led-blink' : f.military ? 'led-red' : 'led-amber'}`}>{label(f)}</td>
                <td className={`${cell} led-cyan`}>{rt ? rt.short : '—'}</td>
                <td className={`${cell} led-dim`}>{f.type || '—'}</td>
                <td className={`${cell} led-green text-right`}>{f.onGround ? 'GND' : f.alt === null ? '—' : `${Math.round(f.alt / 100).toString().padStart(3, '0')}${vsArrow(f.vs)}`}</td>
                <td className={`${cell} led-green text-right`}>{f.gs === null ? '—' : Math.round(f.gs)}</td>
                <td className={`${cell} led-green text-right`}>{f.track === null ? '—' : String(Math.round(f.track)).padStart(3, '0')}</td>
                <td className={`${cell} led-dim text-right`}>{f.distMi.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="led-dim text-base px-3 py-1.5 border-t border-white/5">ALT IN HUNDREDS OF FT · SPD KT · DIST MI</div>
    </div>
  );
}
