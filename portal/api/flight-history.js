// Vercel Serverless Function — the path an aircraft has flown on its current
// (or most recent) flight, from takeoff until now.
//
// GET /api/flight-history?hex=abd77e
//
// Uses OpenSky Network's free track endpoint (no key needed). The live feeds
// behind /api/flights only give where a plane is right now; this fills in
// where it has been, so a flight you start watching mid-trip still shows its
// whole route. Returns { found: false } when OpenSky has no track for it
// (not heard recently, or outside OpenSky's receiver coverage).
//
// Points come back as [unixSeconds, lat, lon, altFeet|null, onGround].

const M_TO_FT = 3.28084;

module.exports = async (req, res) => {
  const hex = String(req.query.hex || '').trim().toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(hex)) return res.status(400).json({ error: 'Give a 6-character transponder hex' });
  try {
    const resp = await fetch(`https://opensky-network.org/api/tracks/all?icao24=${hex}&time=0`, {
      headers: { 'User-Agent': 'MyPortal (personal homepage)' },
    });
    // OpenSky answers 404 when it simply has no track for this aircraft.
    if (resp.status === 404) {
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
      return res.status(200).json({ found: false, hex });
    }
    if (!resp.ok) return res.status(502).json({ error: `OpenSky returned HTTP ${resp.status}` });
    const data = await resp.json().catch(() => null);
    const path = Array.isArray(data?.path) ? data.path : [];
    const points = path
      .filter((p) => Array.isArray(p) && typeof p[1] === 'number' && typeof p[2] === 'number')
      .map((p) => [p[0], p[1], p[2], typeof p[3] === 'number' ? Math.round(p[3] * M_TO_FT) : null, !!p[5]]);
    // A minute of caching keeps several open tabs (and OpenSky's rate limit) happy.
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    if (points.length < 2) return res.status(200).json({ found: false, hex });
    return res.status(200).json({
      found: true,
      hex,
      callsign: String(data.callsign || '').trim() || null,
      start: data.startTime || points[0][0],
      end: data.endTime || points[points.length - 1][0],
      points,
    });
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Track lookup failed' });
  }
};
