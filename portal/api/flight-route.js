// Vercel Serverless Function — origin/destination and airline for a callsign.
//
// GET /api/flight-route?callsign=DAL1234
//
// Uses adsbdb.com (free, no key). ADS-B itself doesn't carry routes, so
// this is a lookup of the flight's usual scheduled route. Occasionally it
// is out of date, and private/GA flights have none. Cached for a day.

module.exports = async (req, res) => {
  const cs = String(req.query.callsign || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(cs)) return res.status(400).json({ error: 'Invalid callsign' });
  try {
    const resp = await fetch(`https://api.adsbdb.com/v0/callsign/${cs}`, { headers: { 'User-Agent': 'MyPortal (personal homepage)' } });
    const data = await resp.json().catch(() => ({}));
    const fr = data?.response?.flightroute;
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    if (!fr) return res.status(200).json({ callsign: cs, found: false });
    const place = (p) => (p ? {
      iata: p.iata_code || null,
      icao: p.icao_code || null,
      city: p.municipality || null,
      name: p.name || null,
      lat: typeof p.latitude === 'number' ? p.latitude : null,
      lon: typeof p.longitude === 'number' ? p.longitude : null,
    } : null);
    return res.status(200).json({
      callsign: cs,
      found: true,
      airline: fr.airline?.name || null,
      origin: place(fr.origin),
      destination: place(fr.destination),
    });
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Route lookup failed' });
  }
};
