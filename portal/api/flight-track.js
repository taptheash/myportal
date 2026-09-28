// Vercel Serverless Function — find ONE aircraft anywhere, by callsign or
// registration, for the Flights "Track a flight" watch list.
//
// GET /api/flight-track?callsign=DAL1234
// GET /api/flight-track?reg=N123DL
//
// Same free community feeds as /api/flights (adsb.lol, airplanes.live,
// adsb.fi). Returns { found: false } when the aircraft isn't currently
// transmitting (not airborne yet, parked, or out of receiver coverage).

const { normalize } = require('./_adsb');

const FEEDS = [
  { name: 'adsb.lol',       cs: (v) => `https://api.adsb.lol/v2/callsign/${v}`,           reg: (v) => `https://api.adsb.lol/v2/reg/${v}` },
  { name: 'airplanes.live', cs: (v) => `https://api.airplanes.live/v2/callsign/${v}`,     reg: (v) => `https://api.airplanes.live/v2/reg/${v}` },
  { name: 'adsb.fi',        cs: (v) => `https://opendata.adsb.fi/api/v2/callsign/${v}`,   reg: (v) => `https://opendata.adsb.fi/api/v2/registration/${v}` },
];

module.exports = async (req, res) => {
  const callsign = String(req.query.callsign || '').trim().toUpperCase();
  const reg = String(req.query.reg || '').trim().toUpperCase();
  const kind = callsign ? 'cs' : 'reg';
  const value = callsign || reg;
  if (!/^[A-Z0-9-]{2,10}$/.test(value)) return res.status(400).json({ error: 'Give a callsign or registration' });

  let lastError = 'No feed responded';
  for (const feed of FEEDS) {
    try {
      const resp = await fetch(feed[kind](encodeURIComponent(value)), { headers: { 'User-Agent': 'MyPortal (personal homepage)' } });
      if (!resp.ok) { lastError = `${feed.name} returned HTTP ${resp.status}`; continue; }
      const data = await resp.json();
      const list = (Array.isArray(data.ac) ? data.ac : Array.isArray(data.aircraft) ? data.aircraft : [])
        .map(normalize)
        .filter((a) => a.lat !== null && a.lon !== null);
      res.setHeader('Cache-Control', 'public, s-maxage=8, stale-while-revalidate=20');
      if (!list.length) return res.status(200).json({ found: false, source: feed.name, now: Date.now() });
      // Most recently heard position wins if a callsign matched more than one.
      list.sort((a, b) => (a.seen ?? 99) - (b.seen ?? 99));
      return res.status(200).json({ found: true, source: feed.name, now: Date.now(), aircraft: list[0] });
    } catch (err) {
      lastError = err.message || String(err);
    }
  }
  return res.status(502).json({ error: lastError });
};
