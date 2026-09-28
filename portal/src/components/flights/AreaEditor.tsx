import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Plus, Trash2, Check, Crosshair } from 'lucide-react';
import { FlightArea, Tracked } from '../../lib/flights';

// Map editor for Flights areas: click the map to move the center, drag the
// slider for the radius, set a floor/ceiling altitude, and save named areas.

const MAX_AREAS = 8;

function ClickToMove({ onMove }: { onMove: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onMove(e.latlng.lat, e.latlng.lng) });
  return null;
}

function FitCircle({ lat, lon, radiusMi }: { lat: number; lon: number; radiusMi: number }) {
  const map = useMap();
  useEffect(() => {
    const d = radiusMi / 69; // degrees of latitude, roughly
    map.fitBounds([[lat - d, lon - d * 1.4], [lat + d, lon + d * 1.4]], { animate: true });
    // Only re-fit when the radius changes or another area is picked, not on every click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusMi, map]);
  return null;
}

export default function AreaEditor({ areas, activeId, flights, onSave }: {
  areas: FlightArea[];
  activeId: string;
  flights: Tracked[];
  onSave: (areas: FlightArea[], activeId: string) => void;
}) {
  const [draft, setDraft] = useState<FlightArea>(() => areas.find((a) => a.id === activeId) || areas[0]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    setDraft(areas.find((a) => a.id === activeId) || areas[0]);
    setConfirmDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const set = (patch: Partial<FlightArea>) => setDraft((d) => ({ ...d, ...patch }));
  const save = () => onSave(areas.map((a) => (a.id === draft.id ? { ...draft, name: draft.name.trim() || 'Area' } : a)), draft.id);
  const addArea = () => {
    if (areas.length >= MAX_AREAS) return;
    const a: FlightArea = { ...draft, id: `area-${Date.now()}`, name: `Area ${areas.length + 1}` };
    onSave([...areas, a], a.id);
  };
  const remove = () => {
    const rest = areas.filter((a) => a.id !== draft.id);
    if (rest.length) onSave(rest, rest[0].id);
  };
  const useMyLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => set({ lat: +p.coords.latitude.toFixed(4), lon: +p.coords.longitude.toFixed(4) }),
      () => { /* permission denied — keep the current center */ },
      { timeout: 15000, maximumAge: 300000 }
    );
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(areas.find((a) => a.id === draft.id));
  const input = 'px-2 py-1 text-sm rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400';

  return (
    <div className="surface-card bg-white dark:bg-zinc-900 rounded-xl p-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          Name
          <input value={draft.name} maxLength={20} onChange={(e) => set({ name: e.target.value })} className={`${input} w-32`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400 flex-1 min-w-[180px]">
          Radius: {draft.radiusMi} mi
          <input type="range" min={1} max={50} value={draft.radiusMi} onChange={(e) => set({ radiusMi: Number(e.target.value) })} className="accent-indigo-600" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          Lowest (ft)
          <input type="number" min={0} step={500} value={draft.minFt} onChange={(e) => set({ minFt: Math.max(0, Number(e.target.value) || 0) })} className={`${input} w-24`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          Highest (ft)
          <input type="number" min={0} step={1000} value={draft.maxFt} onChange={(e) => set({ maxFt: Math.max(0, Number(e.target.value) || 0) })} className={`${input} w-24`} />
        </label>
      </div>

      <div className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800" style={{ height: 320 }}>
        <MapContainer center={[draft.lat, draft.lon]} zoom={9} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer
            url={isDark ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
            attribution={isDark ? '&copy; OpenStreetMap &copy; CARTO' : '&copy; OpenStreetMap contributors'}
          />
          <FitCircle lat={draft.lat} lon={draft.lon} radiusMi={draft.radiusMi} />
          <ClickToMove onMove={(lat, lon) => set({ lat: +lat.toFixed(4), lon: +lon.toFixed(4) })} />
          <Circle center={[draft.lat, draft.lon]} radius={draft.radiusMi * 1609.34} pathOptions={{ color: '#6366f1', weight: 2, fillOpacity: 0.08 }} />
          <CircleMarker center={[draft.lat, draft.lon]} radius={4} pathOptions={{ color: '#6366f1', fillOpacity: 1 }} />
          {flights.map((f) => (
            <CircleMarker key={f.hex} center={[f.lat, f.lon]} radius={3} pathOptions={{ color: '#f59e0b', fillOpacity: 1, weight: 1 }}>
              <Tooltip>{f.callsign || f.reg || f.hex} · {f.alt ?? '—'} ft</Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 -mt-1">
        Click the map to move the center. Center: {draft.lat.toFixed(4)}, {draft.lon.toFixed(4)}. Orange dots are aircraft currently in the saved area.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={!dirty}
          className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors duration-150">
          <Check size={13} /> Save area
        </button>
        <button onClick={useMyLocation}
          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors duration-150">
          <Crosshair size={13} /> Center on my location
        </button>
        <button onClick={addArea} disabled={areas.length >= MAX_AREAS}
          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors duration-150"
          title="Add another area (starts as a copy of this one)">
          <Plus size={13} /> Add area
        </button>
        {areas.length > 1 && (confirmDelete ? (
          <span className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300">
            Delete "{draft.name}"?
            <button onClick={remove} className="px-2 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium">Delete</button>
            <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800">Cancel</button>
          </span>
        ) : (
          <button onClick={() => setConfirmDelete(true)}
            className="ml-auto flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-zinc-500 hover:text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150">
            <Trash2 size={13} /> Delete area
          </button>
        ))}
      </div>
    </div>
  );
}
