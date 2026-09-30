import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { X } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { Tracked, RouteInfo, FlightArea, typeName, emergency } from '../../lib/flights';
import MovingPlane from './MapAircraft';
import { fetchHistory, pathFor, FlightHistory } from '../../lib/flightTrack';

// Map view of an area: every aircraft the Wall/Board shows, as a moving
// silhouette. Hover for callsign, altitude and speed; click one to draw the
// path it has flown since takeoff, with a button to track it.

// Clicking empty map clears the selected plane's path.
function ClearOnMapClick({ onClear }: { onClear: () => void }) {
  useMapEvents({ click: onClear });
  return null;
}

function FitArea({ area }: { area: FlightArea }) {
  const map = useMap();
  useEffect(() => {
    const d = area.radiusMi / 69;
    map.fitBounds([[area.lat - d, area.lon - d * 1.4], [area.lat + d, area.lon + d * 1.4]], { padding: [10, 10] });
    // Only when the area itself changes, never on a data update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area.id, area.lat, area.lon, area.radiusMi, map]);
  return null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function tipHtml(f: Tracked, route: RouteInfo | undefined, tracked: boolean): string {
  const name = f.callsign || f.reg || f.hex.toUpperCase();
  const rt = route?.found ? `${route.origin?.iata || route.origin?.icao || '???'} → ${route.destination?.iata || route.destination?.icao || '???'}` : '';
  const alt = f.onGround ? 'On the ground' : f.alt === null ? '—' : `${f.alt.toLocaleString('en-US')} ft`;
  const vs = f.vs === null || Math.abs(f.vs) < 300 ? '' : f.vs > 0 ? ' ▲' : ' ▼';
  const spd = f.gs === null ? '—' : `${Math.round(f.gs)} kt`;
  const emerg = emergency(f.squawk);
  return `<div class="aircraft-tip-body">`
    + `<div class="t1">${esc(name)}${rt ? ` <span class="rt">${esc(rt)}</span>` : ''}</div>`
    + `<div class="t2">${esc(alt)}${vs} · ${esc(spd)}</div>`
    + `<div class="t3">${esc(typeName(f.type) || 'Unknown type')}${f.reg && f.reg !== name ? ` · ${esc(f.reg)}` : ''}</div>`
    + (emerg ? `<div class="t4">SQUAWK ${esc(f.squawk || '')} · ${emerg}</div>` : '')
    + `<div class="t5">${tracked ? 'Tracking · click to show its path' : 'Click to show its path'}</div>`
    + `</div>`;
}

export default function AreaMap({ area, flights, routes, isTracked, onTrack }: {
  area: FlightArea;
  flights: Tracked[];
  routes: Record<string, RouteInfo>;
  isTracked: (f: Tracked) => boolean;
  onTrack: (f: Tracked) => void;
}) {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [history, setHistory] = useState<FlightHistory | null | undefined>(undefined);
  const selected = selectedHex ? flights.find((f) => f.hex === selectedHex) ?? null : null;

  // Drop the selection when that plane leaves the area.
  useEffect(() => {
    if (selectedHex && !selected) setSelectedHex(null);
  }, [selectedHex, selected]);

  // Load its path since takeoff; refresh every couple of minutes while shown.
  useEffect(() => {
    setHistory(undefined);
    if (!selectedHex) return;
    let cancelled = false;
    const load = () => fetchHistory(selectedHex).then((h) => { if (!cancelled) setHistory(h); });
    load();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 2 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [selectedHex]);

  const path = selected ? pathFor(history, [], selected) : [];
  const selName = selected ? selected.callsign || selected.reg || selected.hex.toUpperCase() : '';
  const selRoute = selected?.callsign ? routes[selected.callsign] : undefined;
  const selRt = selRoute?.found ? `${selRoute.origin?.iata || selRoute.origin?.icao || '???'} → ${selRoute.destination?.iata || selRoute.destination?.icao || '???'}` : '';

  return (
    <div className="relative" style={{ height: 640 }}>
      <MapContainer center={[area.lat, area.lon]} zoom={10} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          url={isDark ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
          attribution={isDark ? '&copy; OpenStreetMap &copy; CARTO' : '&copy; OpenStreetMap contributors'}
        />
        <FitArea area={area} />
        <Circle center={[area.lat, area.lon]} radius={area.radiusMi * 1609.34}
          pathOptions={{ color: '#f59e0b', weight: 1.5, dashArray: '6 6', fillOpacity: 0.04, interactive: false }} />
        <ClearOnMapClick onClear={() => setSelectedHex(null)} />
        {path.length > 1 && (
          <Polyline positions={path} pathOptions={{ color: '#22d3ee', weight: 3, opacity: 0.9, interactive: false }} />
        )}
        {flights.map((f) => {
          const t = isTracked(f);
          return (
            <MovingPlane key={f.hex} a={f} hover highlight={t || f.hex === selectedHex}
              label={tipHtml(f, f.callsign ? routes[f.callsign] : undefined, t)}
              onClick={() => setSelectedHex((h) => (h === f.hex ? null : f.hex))} />
          );
        })}
      </MapContainer>
      {selected && (
        <div className="absolute right-3 top-3 z-[1000] flex items-center gap-3 px-3 py-2 rounded-xl bg-white/95 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-700 shadow-lg text-sm">
          <div className="min-w-0">
            <div className="font-semibold text-zinc-900 dark:text-white">
              {selName}{selRt && <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">{selRt}</span>}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {history === undefined ? 'Loading path since takeoff…'
                : history && path.length > 1 ? 'Path since takeoff'
                : 'No earlier path available for this flight'}
            </div>
          </div>
          <button onClick={() => onTrack(selected)}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white">
            {isTracked(selected) ? 'Open its tab' : 'Track'}
          </button>
          <button onClick={() => setSelectedHex(null)} aria-label="Hide path"
            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            <X size={14} />
          </button>
        </div>
      )}
      {flights.length === 0 && (
        <div className="absolute inset-x-0 top-3 z-[1000] flex justify-center pointer-events-none">
          <span className="led-panel led-text led-amber text-lg px-3 py-1 rounded-lg border border-zinc-800">CLEAR SKIES · NO AIRCRAFT IN THE AIR RIGHT NOW</span>
        </div>
      )}
    </div>
  );
}
