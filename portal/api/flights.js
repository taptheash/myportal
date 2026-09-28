// Vercel Serverless Function — live aircraft around a point, for the
// Flights (FlightWall) section.
//
// GET /api/flights?lat=43.3151&lon=-71.6206&dist=13   (dist in nautical miles, max 100)
//
// Uses the free community ADS-B feeds adsb.lol, falling back to
// airplanes.live and then adsb.fi. Both use the readsb JSON format, need no key and have no
// daily cap. Proxied server-side so the browser has one stable, cached
// endpoint and neither feed sees a stream of requests from every tab.

const SOURCES = [
  (lat, lon, d) => `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${d}`,
  (lat, lon, d) => `https://api.airplanes.live/v2/point/${lat}/${lon}/${d}`,
  (lat, lon, d) => `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${d}`,
];
const NAMES = ['adsb.lol', 'airplanes.live', 'adsb.fi'];

function num(v) {
  return typeof v === 'number' && isFinite(v) ? v : null;
}

function normalize(a) {
  const alt = a.alt_baro === 'ground' ? 0 : num(a.alt_baro) ?? num(a.alt_geom);
  return {
    hex: String(a.hex || '').toLowerCase(),
    callsign: String(a.flight || '').trim() || null,
    reg: a.r || null,
    type: a.t || null,
    alt,                                   // feet (barometric); 0 = on the ground
    onGround: a.alt_baro === 'ground',
    gs: num(a.gs),                         // knots
    track: num(a.track) ?? num(a.true_heading) ?? num(a.mag_heading), // degrees
    vs: num(a.baro_rate) ?? num(a.geom_rate), // ft/min
    lat: num(a.lat),
    lon: num(a.lon),
    squawk: a.squawk || null,
    category: a.category || null,
    military: typeof a.dbFlags === 'number' ? (a.dbFlags & 1) === 1 : false,
    seen: num(a.seen_pos) ?? num(a.seen),
  };
}

module.exports = async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const dist = Math.min(100, Math.max(1, Math.round(Number(req.query.dist) || 15)));
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return res.status(400).json({ error: 'lat and lon are required' });
  }
  const la = lat.toFixed(4);
  const lo = lon.toFixed(4);

  let lastError = 'No feed responded';
  for (const [i, url] of SOURCES.entries()) {
    try {
      const resp = await fetch(url(la, lo, dist), { headers: { 'User-Agent': 'MyPortal (personal homepage)' } });
      if (!resp.ok) { lastError = `Feed ${i + 1} returned HTTP ${resp.status}`; continue; }
      const data = await resp.json();
      const list = Array.isArray(data.ac) ? data.ac : Array.isArray(data.aircraft) ? data.aircraft : [];
      const aircraft = list.map(normalize).filter((a) => a.lat !== null && a.lon !== null);
      // Positions change every few seconds; a short shared cache keeps
      // several open tabs from multiplying requests to the feed.
      res.setHeader('Cache-Control', 'public, s-maxage=8, stale-while-revalidate=20');
      return res.status(200).json({ source: NAMES[i], now: Date.now(), aircraft });
    } catch (err) {
      lastError = err.message || String(err);
    }
  }
  return res.status(502).json({ error: lastError });
};
