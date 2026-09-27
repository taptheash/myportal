// Vercel Serverless Function — Finnhub proxy (stock quotes and symbol search).
// Keeps the Finnhub key on the server instead of in the public bundle.
//
// GET /api/finnhub?endpoint=quote&symbol=AAPL
// GET /api/finnhub?endpoint=search&q=apple

const KEY = () => process.env.FINNHUB_API_KEY || process.env.REACT_APP_FINNHUB_API_KEY;

module.exports = async (req, res) => {
  try {
    const key = KEY();
    if (!key) return res.status(503).json({ error: 'Finnhub API key is not set in Vercel', code: 'unconfigured' });

    const endpoint = String(req.query.endpoint || '');
    const params = new URLSearchParams({ token: key });
    if (endpoint === 'quote') {
      const symbol = String(req.query.symbol || '').trim().toUpperCase();
      if (!/^[A-Z0-9.\-^]{1,15}$/.test(symbol)) return res.status(400).json({ error: 'Invalid symbol' });
      params.set('symbol', symbol);
    } else if (endpoint === 'search') {
      const q = String(req.query.q || '').trim().slice(0, 50);
      if (!q) return res.status(400).json({ error: 'Missing q' });
      params.set('q', q);
    } else {
      return res.status(400).json({ error: 'endpoint must be quote or search' });
    }

    const resp = await fetch(`https://finnhub.io/api/v1/${endpoint}?${params.toString()}`);
    const data = await resp.json().catch(() => ({}));
    if (resp.ok) res.setHeader('Cache-Control', endpoint === 'quote' ? 'public, s-maxage=30' : 'public, s-maxage=3600');
    return res.status(resp.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown server error' });
  }
};
