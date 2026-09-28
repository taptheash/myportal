// Shared bits for the Flights section (FlightWall) and its Home card.

export interface Aircraft {
  hex: string;
  callsign: string | null;
  reg: string | null;
  type: string | null;
  alt: number | null;
  onGround: boolean;
  gs: number | null;
  track: number | null;
  vs: number | null;
  lat: number;
  lon: number;
  squawk: string | null;
  military: boolean;
  category?: string | null; // ADS-B emitter category: A1 light … A5 heavy, A7 helicopter
}

export interface FlightArea {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radiusMi: number;
  minFt: number;
  maxFt: number;
  types?: AircraftGroup[]; // which kinds of aircraft to show; missing = all
}

export interface RouteInfo {
  found: boolean;
  airline?: string | null;
  origin?: { iata: string | null; icao: string | null; city: string | null; lat?: number | null; lon?: number | null } | null;
  destination?: { iata: string | null; icao: string | null; city: string | null; lat?: number | null; lon?: number | null } | null;
}

export const DEFAULT_AREAS: FlightArea[] = [
  { id: 'home', name: 'Home', lat: 43.3151, lon: -71.6206, radiusMi: 15, minFt: 0, maxFt: 60000 },
];

export function getAreas(config: Record<string, any>): FlightArea[] {
  return Array.isArray(config.areas) && config.areas.length ? config.areas : DEFAULT_AREAS;
}

export function getActiveArea(config: Record<string, any>): FlightArea {
  const areas = getAreas(config);
  return areas.find((a) => a.id === config.activeAreaId) || areas[0];
}

// Distance in statute miles.
export function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function bearingTo(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function compass(deg: number | null): string {
  if (deg === null) return '—';
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
}

export type Tracked = Aircraft & { distMi: number; bearing: number };

// ---- Aircraft groups (for the per-area type filter) ----

export type AircraftGroup = 'airline' | 'cargo' | 'ga' | 'military' | 'heli';

export const GROUPS: { id: AircraftGroup; label: string; hint: string }[] = [
  { id: 'airline', label: 'Airline', hint: 'Scheduled passenger flights, including regionals' },
  { id: 'cargo', label: 'Cargo', hint: 'FedEx, UPS, Amazon, DHL and other freight carriers' },
  { id: 'ga', label: 'Private / GA', hint: 'Small planes, business jets, charters, and anything unidentified' },
  { id: 'military', label: 'Military', hint: 'Aircraft flagged as military in the ADS-B database' },
  { id: 'heli', label: 'Helicopters', hint: 'Medical, police, news and other rotorcraft' },
];
export const ALL_GROUPS: AircraftGroup[] = GROUPS.map((g) => g.id);

const CARGO = new Set(['FDX', 'UPS', 'GTI', 'ABX', 'ATN', 'CKS', 'PAC', 'CLX', 'BOX', 'GEC', 'CAO', 'AJT', 'NCR', 'KFS', 'SRR', 'WGN', 'DHK', 'BCS', 'ABW', 'NCA', 'TAY', 'MPH', 'GSS', 'AMF', 'CFS', 'MTN', 'FRG']);
// Fractional-ownership and charter operators fly airline-style callsigns
// (EJA123) but are business jets, so they count as Private / GA.
const BIZJET_OPS = new Set(['EJA', 'LXJ', 'XOJ', 'JTL', 'WUP', 'EJM', 'TWY', 'VJA', 'FWK', 'GAJ', 'JAS', 'SIO', 'PJC', 'CNS', 'LNX', 'KOW', 'MMD', 'EDG', 'JRE']);
const HELI_TYPES = new Set(['EC35', 'EC45', 'EC30', 'EC55', 'EC20', 'EC25', 'EC75', 'AS50', 'AS55', 'AS65', 'AS32', 'A109', 'A119', 'A139', 'A169', 'A189', 'B06', 'B06T', 'B407', 'B412', 'B429', 'B505', 'B212', 'B222', 'B230', 'B430', 'R22', 'R44', 'R66', 'S76', 'S92', 'S70', 'H60', 'H47', 'H53', 'H64', 'UH1', 'MD52', 'MD60', 'EXPL', 'BK17', 'H160', 'H500', 'V22']);

// The 3-letter ICAO airline code from an airline-style callsign ("DAL1234" → "DAL").
export function airlineCode(callsign: string | null): string | null {
  const m = /^([A-Z]{3})\d/.exec((callsign || '').toUpperCase());
  return m ? m[1] : null;
}

export function groupOf(a: Aircraft): AircraftGroup {
  if (a.military) return 'military';
  if (a.category === 'A7' || (a.type && HELI_TYPES.has(a.type.toUpperCase()))) return 'heli';
  const code = airlineCode(a.callsign);
  if (code && CARGO.has(code)) return 'cargo';
  if (code && !BIZJET_OPS.has(code) && !/^N\d/.test(a.callsign || '')) return 'airline';
  return 'ga';
}

// Only airline and cargo flights have a logo worth fetching.
export function logoCode(a: Aircraft): string | null {
  const g = groupOf(a);
  return g === 'airline' || g === 'cargo' ? airlineCode(a.callsign) : null;
}

export function areaTypes(area: FlightArea): AircraftGroup[] {
  return Array.isArray(area.types) ? area.types : ALL_GROUPS;
}

// Parked or taxiing: reported on the ground, or barely moving near the surface.
export function isOnGround(a: Aircraft): boolean {
  return a.onGround || (a.alt !== null && a.alt < 100 && (a.gs ?? 0) < 60);
}

// Airborne aircraft inside the area, nearest first, limited to the area's
// aircraft types. Aircraft on the ground or of a hidden type are left out
// unless `keep` says it's one you're following.
export function inArea(list: Aircraft[], area: FlightArea, keep?: (a: Aircraft) => boolean): Tracked[] {
  const types = new Set(areaTypes(area));
  return list
    .filter((a) => (keep && keep(a)) || (!isOnGround(a) && types.has(groupOf(a))))
    .map((a) => ({ ...a, distMi: milesBetween(area.lat, area.lon, a.lat, a.lon), bearing: bearingTo(area.lat, area.lon, a.lat, a.lon) }))
    .filter((a) => a.distMi <= area.radiusMi)
    .filter((a) => a.alt === null || (a.alt >= area.minFt && a.alt <= area.maxFt))
    .sort((a, b) => a.distMi - b.distMi);
}

export async function fetchAircraft(area: FlightArea): Promise<Aircraft[]> {
  const nm = Math.ceil(area.radiusMi / 1.15078);
  const res = await fetch(`/api/flights?lat=${area.lat}&lon=${area.lon}&dist=${nm}`);
  if (!res.ok) throw new Error(`Flight feed unavailable (HTTP ${res.status})`);
  const data = await res.json();
  return Array.isArray(data.aircraft) ? data.aircraft : [];
}

// Route lookups, remembered per callsign (in memory and localStorage for a
// day) so each flight is looked up once.
const ROUTE_KEY = 'flight-routes';
const ROUTE_TTL = 24 * 3600 * 1000;
const memRoutes = new Map<string, RouteInfo>();
const pending = new Map<string, Promise<RouteInfo>>();

function readRouteCache(): Record<string, { t: number; r: RouteInfo }> {
  try { return JSON.parse(localStorage.getItem(ROUTE_KEY) || '{}') || {}; } catch { return {}; }
}

export function cachedRoute(callsign: string | null): RouteInfo | undefined {
  if (!callsign) return undefined;
  if (memRoutes.has(callsign)) return memRoutes.get(callsign);
  const hit = readRouteCache()[callsign];
  if (hit && Date.now() - hit.t < ROUTE_TTL) {
    memRoutes.set(callsign, hit.r);
    return hit.r;
  }
  return undefined;
}

export function lookupRoute(callsign: string | null): Promise<RouteInfo> {
  if (!callsign) return Promise.resolve({ found: false });
  const hit = cachedRoute(callsign);
  if (hit) return Promise.resolve(hit);
  if (pending.has(callsign)) return pending.get(callsign)!;
  const p = fetch(`/api/flight-route?callsign=${encodeURIComponent(callsign)}`)
    .then((r) => (r.ok ? r.json() : { found: false }))
    .catch(() => ({ found: false }))
    .then((r: RouteInfo) => {
      memRoutes.set(callsign, r);
      try {
        const all = readRouteCache();
        all[callsign] = { t: Date.now(), r };
        const keys = Object.keys(all);
        if (keys.length > 300) keys.sort((a, b) => all[a].t - all[b].t).slice(0, keys.length - 300).forEach((k) => delete all[k]);
        localStorage.setItem(ROUTE_KEY, JSON.stringify(all));
      } catch { /* not fatal */ }
      pending.delete(callsign);
      return r;
    });
  pending.set(callsign, p);
  return p;
}

// Friendly names for common ICAO type codes seen over New England.
const TYPES: Record<string, string> = {
  A319: 'Airbus A319', A320: 'Airbus A320', A321: 'Airbus A321', A20N: 'Airbus A320neo', A21N: 'Airbus A321neo',
  A332: 'Airbus A330-200', A333: 'Airbus A330-300', A339: 'Airbus A330-900', A359: 'Airbus A350-900', A35K: 'Airbus A350-1000',
  A388: 'Airbus A380', BCS1: 'Airbus A220-100', BCS3: 'Airbus A220-300',
  B712: 'Boeing 717', B737: 'Boeing 737-700', B738: 'Boeing 737-800', B739: 'Boeing 737-900', B38M: 'Boeing 737 MAX 8', B39M: 'Boeing 737 MAX 9',
  B752: 'Boeing 757-200', B753: 'Boeing 757-300', B763: 'Boeing 767-300', B764: 'Boeing 767-400',
  B772: 'Boeing 777-200', B77L: 'Boeing 777-200LR', B77W: 'Boeing 777-300ER', B788: 'Boeing 787-8', B789: 'Boeing 787-9', B78X: 'Boeing 787-10',
  B744: 'Boeing 747-400', B748: 'Boeing 747-8',
  E170: 'Embraer 170', E75L: 'Embraer 175', E75S: 'Embraer 175', E190: 'Embraer 190', E195: 'Embraer 195', E290: 'Embraer E190-E2',
  CRJ2: 'Bombardier CRJ200', CRJ7: 'Bombardier CRJ700', CRJ9: 'Bombardier CRJ900', DH8D: 'Dash 8-400',
  C172: 'Cessna 172', C182: 'Cessna 182', C152: 'Cessna 152', C208: 'Cessna Caravan', P28A: 'Piper Cherokee', PA28: 'Piper Cherokee',
  SR22: 'Cirrus SR22', SR20: 'Cirrus SR20', BE36: 'Beech Bonanza', PC12: 'Pilatus PC-12',
  C56X: 'Citation Excel', C68A: 'Citation Latitude', C700: 'Citation Longitude', CL35: 'Challenger 350', GLF4: 'Gulfstream IV', GLF5: 'Gulfstream V',
  GLF6: 'Gulfstream G650', GL5T: 'Global 5000', GLEX: 'Global Express', E55P: 'Phenom 300', LJ45: 'Learjet 45',
  C17: 'Boeing C-17', C130: 'Lockheed C-130', K35R: 'KC-135', KC46: 'KC-46', H60: 'Black Hawk', EC35: 'Airbus H135', A139: 'AW139',
};

export function typeName(code: string | null): string {
  if (!code) return '';
  return TYPES[code.toUpperCase()] || code.toUpperCase();
}

// 7500 hijack, 7600 radio failure, 7700 emergency.
export function emergency(squawk: string | null): string | null {
  return squawk === '7700' ? 'EMERGENCY' : squawk === '7600' ? 'RADIO OUT' : squawk === '7500' ? 'HIJACK' : null;
}
