// Vercel Serverless Function — OpenWeatherMap proxy.
// The API key stays on the server. Before this, it was a REACT_APP_ variable,
// which Create React App compiles into the public JavaScript that anyone
// visiting the site can read.
//
// GET /api/weather?kind=weather|forecast&q=<city or zip,US>
// GET /api/weather?kind=weather|forecast&lat=<n>&lon=<n>

// OPENWEATHER_API_KEY is the new server-only name. The old REACT_APP_ name is
// still accepted so this deploys without any Vercel changes; once the key is
// rotated into OPENWEATHER_API_KEY, the REACT_APP_ variable can be deleted.
const KEY = () => process.env.OPENWEATHER_API_KEY || process.env.REACT_APP_WEATHER_API_KEY;

module.exports = async (req, res) => {
  try {
    const key = KEY();
    if (!key) return res.status(503).json({ error: 'Weather API key is not set in Vercel', code: 'unconfigured' });

    const kind = String(req.query.kind || 'weather');
    if (kind !== 'weather' && kind !== 'forecast') {
      return res.status(400).json({ error: 'kind must be weather or forecast' });
    }

    const params = new URLSearchParams({ appid: key, units: 'imperial' });
    const { q, lat, lon } = req.query;
    if (q) {
      params.set('q', String(q).slice(0, 100));
    } else if (lat !== undefined && lon !== undefined && isFinite(Number(lat)) && isFinite(Number(lon))) {
      params.set('lat', String(Number(lat)));
      params.set('lon', String(Number(lon)));
    } else {
      return res.status(400).json({ error: 'Provide q, or lat and lon' });
    }

    const resp = await fetch(`https://api.openweathermap.org/data/2.5/${kind}?${params.toString()}`);
    const data = await resp.json().catch(() => ({}));
    // Weather changes slowly; a 5-minute edge cache keeps repeat loads cheap.
    if (resp.ok) res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(resp.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown server error' });
  }
};
