import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, X, Bell, BellOff, Map as MapIcon } from 'lucide-react';
import { Aircraft, RouteInfo, FlightArea, lookupRoute, cachedRoute, typeName, compass, emergency, logoCode, airlineCode, groupOf } from '../../lib/flights';
import AirlineLogo from './AirlineLogo';
import {
  TrackedFlight, MAX_TRACKED, parseFlightQuery, fetchTracked, addTrailPoint, getTrail, clearTrail,
  phaseOf, PHASE_LABEL, progressOf, alertFor, TrailPoint,
} from '../../lib/flightTrack';

// Watch list of specific flights, anywhere: flight number or tail number in,
// live LED status card out, with a map of the trail flown so far.

const POLL_MS = 15000;

interface Props {
  tracked: TrackedFlight[];
  onChange: (next: TrackedFlight[]) => void;
  homeArea: FlightArea;
}

interface Live { a: Aircraft | null; at: number; error?: string }

// Frames the flight once when its map opens (and again when its route
// arrives), then leaves the view alone: live updates every 15s never undo a
// zoom or pan you made. If the plane drifts off-screen it pans to follow at
// your zoom. "Fit" (refit bumps) re-frames the whole flight.
function FitTo({ flightId, points, pos, refit }: {
  flightId: string; points: Array<[number, number]>; pos: [number, number] | null; refit: number;
}) {
  const map = useMap();
  const userMoved = useRef(false);
  const programmatic = useRef(false);
  const fittedWith = useRef(0);

  useEffect(() => {
    const onStart = () => { if (!programmatic.current) userMoved.current = true; };
    const onEnd = () => { programmatic.current = false; };
    map.on('zoomstart movestart', onStart);
    map.on('moveend', onEnd);
    return () => { map.off('zoomstart movestart', onStart); map.off('moveend', onEnd); };
  }, [map]);

  const frame = () => {
    if (!points.length) return;
    programmatic.current = true;
    if (points.length === 1) map.setView(points[0], 7);
    else map.fitBounds(points, { padding: [30, 30] });
    fittedWith.current = points.length;
    release();
  };
  // If the view didn't actually change, Leaflet sends no moveend; don't let
  // the flag swallow your next real zoom.
  const release = () => { setTimeout(() => { programmatic.current = false; }, 800); };

  // New flight on the map, or the Fit button: start fresh.
  useEffect(() => {
    userMoved.current = false;
    fittedWith.current = 0;
    frame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightId, refit]);

  // More to show (route or position arrived) and you haven't moved the map yet.
  useEffect(() => {
    if (!userMoved.current && points.length > fittedWith.current) frame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length]);

  // Keep the plane on screen at your zoom.
  const posKey = pos ? `${pos[0]},${pos[1]}` : '';
  useEffect(() => {
    if (!pos || !userMoved.current) return;
    if (!map.getBounds().pad(-0.1).contains(pos)) {
      programmatic.current = true;
      map.panTo(pos, { animate: true });
      release();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posKey]);
  return null;
}

export default function TrackedFlights({ tracked, onChange, homeArea }: Props) {
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [live, setLive] = useState<Record<string, Live>>({});
  const [routes, setRoutes] = useState<Record<string, RouteInfo>>({});
  const [refit, setRefit] = useState(0);
  const [trails, setTrails] = useState<Record<string, TrailPoint[]>>({});
  const [mapId, setMapId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: number; text: string }>>([]);
  const prevRef = useRef<Record<string, Aircraft | null | undefined>>({});
  const trackedKey = tracked.map((t) => `${t.id}:${t.alerts}`).join(',');

  const toast = (text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 9000);
    try {
      if ('Notification' in window && Notification.permission === 'granted') new Notification('Flight update', { body: text });
    } catch { /* notifications unavailable */ }
  };

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      if (document.visibilityState === 'visible' && tracked.length) {
        await Promise.all(tracked.map(async (t) => {
          try {
            const a = await fetchTracked(t);
            if (cancelled) return;
            if (a) {
              addTrailPoint(t.id, a);
              const cs = a.callsign || (t.kind === 'callsign' ? t.value : null);
              if (cs && !routes[t.id]) {
                const hit = cachedRoute(cs);
                if (hit) setRoutes((r) => ({ ...r, [t.id]: hit }));
                else lookupRoute(cs).then((r) => !cancelled && setRoutes((p) => ({ ...p, [t.id]: r })));
              }
            }
            if (t.alerts) {
              const msg = alertFor(t.query, prevRef.current[t.id], a, homeArea);
              if (msg) toast(msg);
            }
            prevRef.current[t.id] = a;
            setLive((l) => ({ ...l, [t.id]: { a, at: Date.now() } }));
            setTrails((tr) => ({ ...tr, [t.id]: getTrail(t.id) }));
          } catch (e) {
            if (!cancelled) setLive((l) => ({ ...l, [t.id]: { a: l[t.id]?.a ?? null, at: l[t.id]?.at ?? 0, error: e instanceof Error ? e.message : 'Feed unavailable' } }));
          }
        }));
      }
      if (!cancelled) timer = setTimeout(run, POLL_MS);
    };
    run();
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedKey]);

  const add = () => {
    const parsed = parseFlightQuery(input);
    if (!parsed) { setInputError('Enter a flight number like DL1234 or B6 512, or a tail number like N123DL'); return; }
    if (tracked.length >= MAX_TRACKED) { setInputError(`You can track up to ${MAX_TRACKED} flights — remove one first`); return; }
    if (tracked.some((t) => t.value === parsed.value)) { setInputError('Already tracking that flight'); return; }
    const t: TrackedFlight = { id: `trk-${Date.now()}`, query: input.trim().toUpperCase(), ...parsed, alerts: false, addedAt: Date.now() };
    onChange([...tracked, t]);
    setInput('');
    setInputError('');
  };

  const remove = (id: string) => {
    clearTrail(id);
    delete prevRef.current[id];
    if (mapId === id) setMapId(null);
    onChange(tracked.filter((t) => t.id !== id));
  };

  const toggleAlerts = async (t: TrackedFlight) => {
    if (!t.alerts && 'Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch { /* ignore */ }
    }
    onChange(tracked.map((x) => (x.id === t.id ? { ...x, alerts: !x.alerts } : x)));
  };

  const mapFlight = tracked.find((t) => t.id === mapId);
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mr-1">Track a flight</h3>
        <div className="flex items-center gap-1.5 flex-1 min-w-[260px] max-w-md">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={input}
              onChange={(e) => { setInput(e.target.value); setInputError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Flight number (DL1234) or tail number (N123DL)"
              className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <button onClick={add} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors duration-150">Track</button>
        </div>
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{tracked.length}/{MAX_TRACKED}</span>
      </div>
      {inputError && <p className="-mt-2 text-xs text-red-500">{inputError}</p>}

      {tracked.length === 0 ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Nothing tracked yet. Flight numbers from your ticket work (DL1234 is sent to the feeds as DAL1234), and so do tail numbers.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {tracked.map((t) => {
            const l = live[t.id];
            const a = l?.a ?? null;
            const r = routes[t.id];
            const phase = phaseOf(a);
            const prog = progressOf(a, r);
            const emerg = emergency(a?.squawk ?? null);
            const routeLine = r?.found ? `${r.origin?.iata || r.origin?.icao || '???'} → ${r.destination?.iata || r.destination?.icao || '???'}` : null;
            return (
              <div key={t.id} id={`trk-card-${t.id}`} className="led-panel led-text rounded-xl border border-zinc-800 px-3 py-2 flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <AirlineLogo code={a ? logoCode(a) : t.kind === 'callsign' ? airlineCode(t.value) : null} size={30}
                    military={a?.military} heli={a ? groupOf(a) === 'heli' : false} title={r?.airline || undefined} />
                  <span className={`text-2xl ${emerg ? 'led-red led-blink' : 'led-amber'}`}>{t.query}</span>
                  {t.value !== t.query.replace(/\s+/g, '') && <span className="led-dim text-lg">{t.value}</span>}
                  {r?.airline && <span className="led-dim text-lg truncate">{r.airline.toUpperCase()}</span>}
                  <span className="ml-auto flex items-center gap-1.5">
                    <button onClick={() => setMapId(mapId === t.id ? null : t.id)} title="Show on map" className={`p-1 rounded ${mapId === t.id ? 'led-cyan' : 'led-dim'} hover:text-white`}><MapIcon size={14} /></button>
                    <button onClick={() => toggleAlerts(t)} title={t.alerts ? 'Alerts on: airborne, descent, landing, overhead' : 'Turn on alerts (while this page is open)'} className={`p-1 rounded ${t.alerts ? 'led-amber' : 'led-dim'} hover:text-white`}>
                      {t.alerts ? <Bell size={14} /> : <BellOff size={14} />}
                    </button>
                    <button onClick={() => remove(t.id)} title="Stop tracking" className="p-1 rounded led-dim hover:text-red-400"><X size={14} /></button>
                  </span>
                </div>
                <div className="flex items-baseline gap-3 flex-wrap text-xl">
                  <span className={phase === 'not-airborne' ? 'led-dim' : phase === 'descending' ? 'led-cyan' : 'led-green'}>
                    {l ? PHASE_LABEL[phase] : 'SEARCHING…'}
                  </span>
                  {routeLine && <span className="led-cyan">{routeLine}</span>}
                  {emerg && <span className="led-red led-blink">SQUAWK {a?.squawk} {emerg}</span>}
                </div>
                {a && (
                  <div className="led-green text-lg flex flex-wrap gap-x-4">
                    <span>{a.onGround ? 'GROUND' : a.alt === null ? '—' : `${a.alt.toLocaleString('en-US')} FT`}</span>
                    <span>{a.gs === null ? '—' : `${Math.round(a.gs)} KT`}</span>
                    <span>HDG {a.track === null ? '—' : `${String(Math.round(a.track)).padStart(3, '0')} ${compass(a.track)}`}</span>
                    <span className="led-dim">{typeName(a.type)}{a.reg ? ` · ${a.reg}` : ''}</span>
                  </div>
                )}
                {prog.pct !== null && (
                  <div className="mt-1">
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-[#22d3ee] shadow-[0_0_6px_#22d3ee]" style={{ width: `${prog.pct}%` }} />
                    </div>
                    <div className="flex justify-between text-base led-dim mt-0.5">
                      <span>{Math.round(prog.flownMi!)} MI FLOWN</span>
                      <span>{prog.eta ? `ETA ~${prog.eta.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}</span>
                      <span>{Math.round(prog.toGoMi!)} MI TO GO</span>
                    </div>
                  </div>
                )}
                {!a && l && !l.error && (
                  <div className="led-dim text-base">No transponder signal right now — it will appear once airborne and in receiver range.</div>
                )}
                {l?.error && <div className="led-red text-base">{l.error}</div>}
              </div>
            );
          })}
        </div>
      )}

      {mapFlight && (
        <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800" style={{ height: 340 }}>
          <button onClick={() => setRefit((n) => n + 1)} title="Zoom out to show the whole flight"
            className="absolute top-2 right-2 z-[1000] text-xs font-medium px-2.5 py-1 rounded-lg bg-white/90 dark:bg-zinc-900/90 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 shadow-sm hover:bg-white dark:hover:bg-zinc-800">
            Fit flight
          </button>
          {(() => {
            const trail = (trails[mapFlight.id] || []).map((p) => [p.lat, p.lon] as [number, number]);
            const a = live[mapFlight.id]?.a;
            const r = routes[mapFlight.id];
            const o = r?.origin?.lat != null && r.origin.lon != null ? ([r.origin.lat, r.origin.lon] as [number, number]) : null;
            const d = r?.destination?.lat != null && r.destination.lon != null ? ([r.destination.lat, r.destination.lon] as [number, number]) : null;
            const pos = a ? ([a.lat, a.lon] as [number, number]) : null;
            const fitPts = [o, pos, d].filter(Boolean) as Array<[number, number]>;
            const center = pos || o || [homeArea.lat, homeArea.lon];
            return (
              <MapContainer center={center} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                <TileLayer
                  url={isDark ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
                  attribution={isDark ? '&copy; OpenStreetMap &copy; CARTO' : '&copy; OpenStreetMap contributors'}
                />
                <FitTo flightId={mapFlight.id} points={fitPts.length ? fitPts : trail} pos={pos} refit={refit} />
                {o && d && <Polyline positions={[o, d]} pathOptions={{ color: '#71717a', weight: 1, dashArray: '4 6' }} />}
                {trail.length > 1 && <Polyline positions={trail} pathOptions={{ color: '#22d3ee', weight: 3 }} />}
                {o && <CircleMarker center={o} radius={5} pathOptions={{ color: '#a1a1aa', fillOpacity: 1 }}><Tooltip>{r?.origin?.iata || r?.origin?.icao} · {r?.origin?.city}</Tooltip></CircleMarker>}
                {d && <CircleMarker center={d} radius={5} pathOptions={{ color: '#a1a1aa', fillOpacity: 1 }}><Tooltip>{r?.destination?.iata || r?.destination?.icao} · {r?.destination?.city}</Tooltip></CircleMarker>}
                {pos && <CircleMarker center={pos} radius={7} pathOptions={{ color: '#f59e0b', fillColor: '#ffb000', fillOpacity: 1 }}><Tooltip permanent direction="top">{mapFlight.query}</Tooltip></CircleMarker>}
              </MapContainer>
            );
          })()}
        </div>
      )}

      {tracked.some((t) => t.alerts) && (
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
          Alerts (airborne, descent, landing, and "now over {homeArea.name}") work while the portal is open in a tab. ETA is a rough estimate from current speed and distance, not the airline's arrival time.
        </p>
      )}

      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[150] flex flex-col gap-2">
          {toasts.map((t) => (
            <div key={t.id} className="led-panel led-text led-amber text-xl rounded-xl border border-zinc-700 px-4 py-2 shadow-xl">
              ✈ {t.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
