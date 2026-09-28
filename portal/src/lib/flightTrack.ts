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
