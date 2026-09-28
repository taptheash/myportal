import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Tracked, RouteInfo, FlightArea, typeName, emergency } from '../../lib/flights';
import MovingPlane from './MapAircraft';

// Map view of an area: every aircraft the Wall/Board shows, as a moving
// silhouette. Hover for callsign, altitude and speed; click to track it.

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
    + `<div class="t5">${tracked ? 'Tracking · click to show its card' : 'Click to track'}</div>`
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
        {flights.map((f) => {
          const t = isTracked(f);
          return (
            <MovingPlane key={f.hex} a={f} hover highlight={t}
              label={tipHtml(f, f.callsign ? routes[f.callsign] : undefined, t)}
              onClick={() => onTrack(f)} />
          );
        })}
      </MapContainer>
      {flights.length === 0 && (
        <div className="absolute inset-x-0 top-3 z-[1000] flex justify-center pointer-events-none">
          <span className="led-panel led-text led-amber text-lg px-3 py-1 rounded-lg border border-zinc-800">CLEAR SKIES · NO AIRCRAFT IN THE AIR RIGHT NOW</span>
        </div>
      )}
    </div>
  );
}
