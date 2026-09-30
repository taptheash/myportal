// "Track a flight": look up one flight anywhere by flight number or tail
// number, keep a short trail of where it has been, and work out progress,
// a rough ETA, and alert-worthy changes (started descent, landed, entered
// your Home area).
import { Aircraft, RouteInfo, milesBetween, FlightArea, isOnGround } from './flights';

export interface TrackedFlight {
  id: string;
  query: string;            // what you typed, e.g. "DL1234"
  kind: 'callsign' | 'reg';
  value: string;            // what the feeds are asked for, e.g. "DAL1234"
  alerts: boolean;
  addedAt: number;
}

export const MAX_TRACKED = 5;

// True when an aircraft is one of the flights on your watch list.
export function isFollowed(a: { callsign: string | null; reg: string | null }, tracked: TrackedFlight[]): boolean {
  const cs = (a.callsign || '').toUpperCase();
  const reg = (a.reg || '').toUpperCase();
  return tracked.some((t) => (t.kind === 'callsign' ? t.value === cs : t.value === reg));
}

// Airline IATA (what's on your ticket) -> ICAO (what ADS-B transmits).
const AIRLINES: Record<string, string> = {
  AA: 'AAL', DL: 'DAL', UA: 'UAL', WN: 'SWA', B6: 'JBU', AS: 'ASA', NK: 'NKS', F9: 'FFT', G4: 'AAY', SY: 'SCX',
  HA: 'HAL', MX: 'MXY', QX: 'QXE', OO: 'SKW', YX: 'RPA', MQ: 'ENY', OH: 'JIA', '9E': 'EDV', YV: 'ASH', PT: 'PDT', ZW: 'AWI', C5: 'UCA', G7: 'GJS',
  AC: 'ACA', WS: 'WJA', PD: 'POE', TS: 'TSC', BA: 'BAW', VS: 'VIR', AF: 'AFR', KL: 'KLM', LH: 'DLH', LX: 'SWR', OS: 'AUA', SN: 'BEL',
  IB: 'IBE', EI: 'EIN', FI: 'ICE', SK: 'SAS', AY: 'FIN', TP: 'TAP', AZ: 'ITY', TK: 'THY', EK: 'UAE', QR: 'QTR', EY: 'ETD',
  AM: 'AMX', CM: 'CMP', AV: 'AVA', LA: 'LAN', JL: 'JAL', NH: 'ANA', KE: 'KAL', CX: 'CPA', SQ: 'SIA', QF: 'QFA', NZ: 'ANZ',
  '5X': 'UPS', FX: 'FDX',
};

// "DL 1234" -> DAL1234 (callsign); "N123DL" / "C-FABC" -> registration.
export function parseFlightQuery(input: string): { kind: 'callsign' | 'reg'; value: string } | null {
  const q = input.trim().toUpperCase().replace(/\s+/g, '');
  if (!q) return null;
  if (/^N[0-9][0-9A-Z]{0,4}$/.test(q) || /^[A-Z0-9]{1,2}-[A-Z0-9]{2,5}$/.test(q)) return { kind: 'reg', value: q };
  const iata = q.match(/^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/);
  if (iata && AIRLINES[iata[1]]) return { kind: 'callsign', value: AIRLINES[iata[1]] + iata[2] };
  if (/^[A-Z]{3}\d{1,4}[A-Z]{0,2}$/.test(q)) return { kind: 'callsign', value: q };
  if (/^[A-Z0-9]{2,8}$/.test(q)) return { kind: 'callsign', value: q };
  return null;
}

export async function fetchTracked(t: TrackedFlight): Promise<Aircraft | null> {
  const res = await fetch(`/api/flight-track?${t.kind === 'reg' ? 'reg' : 'callsign'}=${encodeURIComponent(t.value)}`);
  if (!res.ok) throw new Error(`Tracking feed unavailable (HTTP ${res.status})`);
  const data = await res.json();
  return data.found ? data.aircraft : null;
}

// --- Trails (per device, last 24h, capped) ------------------------------
export interface TrailPoint { lat: number; lon: number; alt: number | null; t: number }
const TRAIL_KEY = 'flight-trails';
const TRAIL_MAX = 400;
const DAY = 24 * 3600 * 1000;

function readTrails(): Record<string, TrailPoint[]> {
  try { return JSON.parse(localStorage.getItem(TRAIL_KEY) || '{}') || {}; } catch { return {}; }
}

export function getTrail(id: string): TrailPoint[] {
  return (readTrails()[id] || []).filter((p) => Date.now() - p.t < DAY);
}

export function addTrailPoint(id: string, a: Aircraft) {
  try {
    const all = readTrails();
    const pts = (all[id] || []).filter((p) => Date.now() - p.t < DAY);
    const last = pts[pts.length - 1];
    if (!last || last.lat !== a.lat || last.lon !== a.lon) pts.push({ lat: a.lat, lon: a.lon, alt: a.alt, t: Date.now() });
    all[id] = pts.slice(-TRAIL_MAX);
    localStorage.setItem(TRAIL_KEY, JSON.stringify(all));
  } catch { /* storage full — trail just stops growing */ }
}

export function clearTrail(id: string) {
  try {
    const all = readTrails();
    delete all[id];
    localStorage.setItem(TRAIL_KEY, JSON.stringify(all));
  } catch { /* not fatal */ }
}

// --- Full path from takeoff (OpenSky, via /api/flight-history) ----------
// The live feeds only say where a plane is now; this is where it has been
// on its current flight. Shared by the tracked-flight tabs and the area map.
export type HistoryPoint = [number, number, number, number | null, boolean]; // [unix s, lat, lon, alt ft, on ground]
export interface FlightHistory { start: number; end: number; points: HistoryPoint[] }

const HISTORY_MAX_AGE = 2 * 60 * 1000;
const historyCache = new Map<string, { at: number; job: Promise<FlightHistory | null> }>();

export function fetchHistory(hex: string): Promise<FlightHistory | null> {
  const key = hex.toLowerCase();
  const hit = historyCache.get(key);
  if (hit && Date.now() - hit.at < HISTORY_MAX_AGE) return hit.job;
  const job = (async () => {
    try {
      const res = await fetch(`/api/flight-history?hex=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.found || !Array.isArray(data.points)) return null;
      return { start: data.start, end: data.end, points: data.points } as FlightHistory;
    } catch {
      historyCache.delete(key); // try again next time instead of remembering the failure
      return null;
    }
  })();
  historyCache.set(key, { at: Date.now(), job });
  return job;
}

// One line for the map: OpenSky's path from takeoff, then anything this
// browser has seen since (the feeds are often a little ahead of OpenSky),
// then the plane's current position so the line meets the icon. Without a
// usable history it falls back to just the locally collected trail.
export function pathFor(
  history: FlightHistory | null | undefined,
  trail: TrailPoint[],
  pos: { lat: number; lon: number } | null,
): Array<[number, number]> {
  // A track that ended hours ago is the plane's previous flight, not this one.
  const fresh = history && Date.now() / 1000 - history.end < 3 * 3600 ? history : null;
  const out: Array<[number, number]> = fresh ? fresh.points.map((p) => [p[1], p[2]] as [number, number]) : [];
  const after = fresh ? fresh.end * 1000 : 0;
  for (const p of trail) if (p.t > after) out.push([p.lat, p.lon]);
  if (pos) {
    const last = out[out.length - 1];
    if (!last || last[0] !== pos.lat || last[1] !== pos.lon) out.push([pos.lat, pos.lon]);
  }
  return out;
}

// --- Status, progress, ETA ----------------------------------------------
export type Phase = 'not-airborne' | 'ground' | 'climbing' | 'cruising' | 'descending';

export function phaseOf(a: Aircraft | null): Phase {
  if (!a) return 'not-airborne';
  if (isOnGround(a)) return 'ground';
  if (a.vs !== null && a.vs > 500) return 'climbing';
  if (a.vs !== null && a.vs < -500) return 'descending';
  return 'cruising';
}

export const PHASE_LABEL: Record<Phase, string> = {
  'not-airborne': 'NO SIGNAL',
  ground: 'ON THE GROUND',
  climbing: 'CLIMBING',
  cruising: 'CRUISING',
  descending: 'DESCENDING',
};

export interface Progress { flownMi: number | null; toGoMi: number | null; pct: number | null; eta: Date | null }

export function progressOf(a: Aircraft | null, route: RouteInfo | undefined): Progress {
  const o = route?.origin; const d = route?.destination;
  if (!a || !o || !d || o.lat == null || o.lon == null || d.lat == null || d.lon == null) {
    return { flownMi: null, toGoMi: null, pct: null, eta: null };
  }
  const flown = milesBetween(o.lat, o.lon, a.lat, a.lon);
  const toGo = milesBetween(a.lat, a.lon, d.lat, d.lon);
  const pct = Math.max(0, Math.min(100, (flown / (flown + toGo)) * 100));
  const mph = a.gs ? a.gs * 1.15078 : 0;
  // Rough: straight line at current ground speed, plus ~10 min for the approach.
  const eta = mph > 80 && phaseOf(a) !== 'ground' ? new Date(Date.now() + (toGo / mph) * 3600000 + 10 * 60000) : null;
  return { flownMi: flown, toGoMi: toGo, pct, eta };
}

// Compares the previous and current reading and returns alert text, if any.
export function alertFor(label: string, prev: Aircraft | null | undefined, cur: Aircraft | null, home: FlightArea): string | null {
  if (prev === undefined) return null; // first reading since the page opened
  const p = phaseOf(prev ?? null);
  const c = phaseOf(cur);
  if (p === 'not-airborne' && (c === 'climbing' || c === 'cruising')) return `${label} is airborne`;
  if (p !== 'descending' && c === 'descending' && (cur?.alt ?? 0) > 5000) return `${label} has started its descent`;
  if (p !== 'ground' && p !== 'not-airborne' && c === 'ground') return `${label} has landed`;
  if (prev && cur) {
    const was = milesBetween(home.lat, home.lon, prev.lat, prev.lon) <= home.radiusMi;
    const now = milesBetween(home.lat, home.lon, cur.lat, cur.lon) <= home.radiusMi;
    if (!was && now) return `${label} is now over ${home.name} — look up!`;
  }
  return null;
}

// --- Aircraft photo (Planespotters.net) ------------------------------------
// Free public API, one photo per airframe, looked up by transponder hex (the
// current aircraft) and then by tail number. Their terms: show the photographer
// credit next to the image, link it to the photo's page on planespotters.net
// (plain link, no nofollow), and load the image from their URL, never a copy.
export interface AircraftPhoto { src: string; width: number; height: number; link: string; photographer: string }

const photoCache = new Map<string, Promise<AircraftPhoto | null>>();

export function lookupPhoto(hex: string | null, reg: string | null): Promise<AircraftPhoto | null> {
  const key = `${(hex || '').toLowerCase()}|${(reg || '').toUpperCase()}`;
  const cached = photoCache.get(key);
  if (cached) return cached;
  const job = (async () => {
    const paths = [
      hex ? `hex/${encodeURIComponent(hex.toLowerCase())}` : null,
      reg ? `reg/${encodeURIComponent(reg.toUpperCase())}` : null,
    ].filter(Boolean) as string[];
    let failed = false;
    for (const path of paths) {
      try {
        const res = await fetch(`https://api.planespotters.net/pub/photos/${path}`);
        if (!res.ok) { failed = true; continue; }
        const data = await res.json();
        const p = Array.isArray(data?.photos) ? data.photos[0] : null;
        const img = p?.thumbnail;
        if (img?.src && p.link) {
          return { src: img.src, width: img.size?.width || 200, height: img.size?.height || 133, link: p.link, photographer: p.photographer || 'unknown' };
        }
      } catch { failed = true; }
    }
    // Remember "no photo", but let a network failure try again later.
    if (failed) photoCache.delete(key);
    return null;
  })();
  photoCache.set(key, job);
  return job;
}
