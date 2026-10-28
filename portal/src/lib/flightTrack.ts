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

// Looks the flight up on the live feeds. Results are shared for a few seconds,
// so the recorder (which runs everywhere) and the Flights page (which polls
// for its own display) don't both hit the feed for the same reading.
const trackedCache = new Map<string, { at: number; job: Promise<Aircraft | null> }>();

export function fetchTracked(t: Pick<TrackedFlight, 'kind' | 'value'>): Promise<Aircraft | null> {
  const key = `${t.kind}:${t.value}`;
  const hit = trackedCache.get(key);
  if (hit && Date.now() - hit.at < 10000) return hit.job;
  const job = (async () => {
    const res = await fetch(`/api/flight-track?${t.kind === 'reg' ? 'reg' : 'callsign'}=${encodeURIComponent(t.value)}`);
    if (!res.ok) throw new Error(`Tracking feed unavailable (HTTP ${res.status})`);
    const data = await res.json();
    return data.found ? (data.aircraft as Aircraft) : null;
  })();
  trackedCache.set(key, { at: Date.now(), job });
  job.catch(() => { if (trackedCache.get(key)?.job === job) trackedCache.delete(key); });
  return job;
}

// --- Trails (last 24h) ------------------------------------------------------
// Every reading of a tracked or watched flight adds a point. They are kept in
// two places: this device's own copy (written on every reading), and a copy
// that syncs to your other devices (written at most every few minutes, merged
// with whatever another device recorded). Reading a trail merges both, so the
// track you see is everything your devices have heard since the flight began.
export interface TrailPoint { lat: number; lon: number; alt: number | null; t: number }
// lat, lon, altitude ft, time (ms), on the ground (1) or in the air (0)
type StoredPoint = [number, number, number | null, number, number];
type Store = Record<string, StoredPoint[]>;

const TRAIL_KEY = 'flight-trails';
export const SYNCED_TRAIL_KEY = 'pw6-flight-trails';
export const TRAIL_EVENT = 'flight-trail-updated';
const TRAIL_MAX = 1500;                  // points kept per flight (older ones are thinned out first)
const DAY = 24 * 3600 * 1000;
const LEG_GAP = 12 * 3600 * 1000;        // no reading for this long: the next one is a new flight
const LANDED_MS = 5 * 60 * 1000;         // on the ground this long, then airborne again: a new flight
const SYNC_EVERY = 3 * 60 * 1000;
const KEY_RE = /^(callsign|reg):/;

// Trails are stored per flight number or tail number, so a flight you only
// watch has its track recorded too, and tracking it later picks that up.
export function trailKeyOf(t: { kind: string; value: string }): string {
  return `${t.kind}:${t.value}`;
}

function readStore(storageKey: string): Store {
  try {
    const v = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch { return {}; }
}

function clean(pts: unknown): StoredPoint[] {
  if (!Array.isArray(pts)) return [];
  const cutoff = Date.now() - DAY;
  const out: StoredPoint[] = [];
  for (const p of pts) {
    if (Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number' && typeof p[3] === 'number' && p[3] > cutoff) {
      out.push([p[0], p[1], typeof p[2] === 'number' ? p[2] : null, p[3], p[4] === 1 ? 1 : 0]);
    }
  }
  return out;
}

// Over the cap, keep the newest half exactly and drop every other older point.
function thin(pts: StoredPoint[], cap = TRAIL_MAX): StoredPoint[] {
  let out = pts;
  while (out.length > cap) {
    const half = Math.floor(out.length / 2);
    out = out.slice(0, half).filter((_, i) => i % 2 === 0).concat(out.slice(half));
  }
  return out;
}

function writeStore(storageKey: string, store: Store) {
  const out: Store = {};
  for (const k of Object.keys(store)) {
    if (!KEY_RE.test(k)) continue; // also drops the old per-tab entries
    const pts = thin(clean(store[k]));
    if (pts.length) out[k] = pts;
  }
  localStorage.setItem(storageKey, JSON.stringify(out));
}

// Only the current flight: cut at a long silence, or where the aircraft was on
// the ground for a few minutes and then took off again.
function currentLeg(pts: StoredPoint[]): StoredPoint[] {
  let start = 0;
  let seenAir = false;
  let groundSince = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (i > 0 && p[3] - pts[i - 1][3] > LEG_GAP) { start = i; seenAir = false; groundSince = 0; }
    if (p[4] === 0) {
      if (seenAir && groundSince && p[3] - groundSince >= LANDED_MS) start = i;
      groundSince = 0;
      seenAir = true;
    } else if (seenAir && !groundSince) {
      groundSince = p[3];
    }
  }
  return start ? pts.slice(start) : pts;
}

function merge(a: StoredPoint[], b: StoredPoint[]): StoredPoint[] {
  const all = a.concat(b).sort((x, y) => x[3] - y[3]);
  const out: StoredPoint[] = [];
  for (const p of all) {
    const last = out[out.length - 1];
    if (last && p[3] - last[3] < 2000) continue; // the same reading, seen twice
    out.push(p);
  }
  return thin(currentLeg(out));
}

export function getTrail(key: string): TrailPoint[] {
  const pts = merge(clean(readStore(TRAIL_KEY)[key]), clean(readStore(SYNCED_TRAIL_KEY)[key]));
  return pts.map(([lat, lon, alt, t]) => ({ lat, lon, alt, t }));
}

let trailsDirty = true;
let lastSyncAt = 0;

// Copies this device's trails into the synced key (merged with what other
// devices wrote). Cloud sync then uploads that key, so it is throttled to keep
// the number of cloud writes small.
function syncTrails(force: boolean) {
  if (!trailsDirty) return;
  const now = Date.now();
  if (now - lastSyncAt < (force ? 30000 : SYNC_EVERY)) return;
  try {
    const mine = readStore(TRAIL_KEY);
    const cloud = readStore(SYNCED_TRAIL_KEY);
    const out: Store = {};
    for (const k of Object.keys(mine).concat(Object.keys(cloud))) {
      if (!KEY_RE.test(k) || k in out) continue;
      const m = merge(clean(mine[k]), clean(cloud[k]));
      if (m.length) out[k] = m;
    }
    // Stay well under the cloud copy's size limit.
    let cap = TRAIL_MAX;
    let json = JSON.stringify(out);
    while (json.length > 800000 && cap > 100) {
      cap = Math.floor(cap / 2);
      for (const k of Object.keys(out)) out[k] = thin(out[k], cap);
      json = JSON.stringify(out);
    }
    if (json !== localStorage.getItem(SYNCED_TRAIL_KEY)) localStorage.setItem(SYNCED_TRAIL_KEY, json);
    trailsDirty = false;
    lastSyncAt = now;
  } catch { /* storage full or unavailable: try again later */ }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => syncTrails(true));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') syncTrails(true); });
}

export function addTrailPoint(key: string, a: Aircraft) {
  try {
    const now = Date.now();
    const store = readStore(TRAIL_KEY);
    const pts = clean(store[key]);
    const last = pts[pts.length - 1];
    // Parked or hovering: one point every few minutes is enough.
    if (last && now - last[3] < 5 * 60 * 1000 && milesBetween(last[0], last[1], a.lat, a.lon) < 0.1) return;
    pts.push([Math.round(a.lat * 1e5) / 1e5, Math.round(a.lon * 1e5) / 1e5, a.alt, now, isOnGround(a) ? 1 : 0]);
    store[key] = thin(currentLeg(pts));
    writeStore(TRAIL_KEY, store);
    trailsDirty = true;
    window.dispatchEvent(new Event(TRAIL_EVENT));
    syncTrails(false);
  } catch { /* storage full: the track just stops growing */ }
}

export function clearTrail(key: string) {
  try {
    for (const storageKey of [TRAIL_KEY, SYNCED_TRAIL_KEY]) {
      const store = readStore(storageKey);
      if (key in store) { delete store[key]; writeStore(storageKey, store); }
    }
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
