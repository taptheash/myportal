// Vercel Serverless Function
// Fetches Yahoo Finance's chart endpoint server-side and returns a simplified
// { points: [{ t, price }] } shape. This has to happen server-side: Yahoo's
// query1.finance.yahoo.com/v8/finance/chart endpoint sends no
// Access-Control-Allow-Origin header, so a direct fetch() from the browser
// is blocked by CORS regardless of how the request is formed (confirmed by
// testing against the deployed portal directly — same root cause as
// bing-wallpaper.js's Bing proxy). Server-to-server requests aren't subject
// to CORS, so this function makes the call on the portal's behalf and the
// frontend calls this same-origin route instead.

// Maps the chart UI's range keys to Yahoo's `range`/`interval` query params.
// Interval is coarser for longer ranges (daily candles over 5-10 years is
// tens of thousands of points for no visual benefit at this chart's size;
// weekly/monthly keeps payloads small and renders just as legibly zoomed
// out). Verified directly against Yahoo's endpoint: all of these ranges
// return real data, including 'max' (AAPL goes back to 1984).
const RANGE_MAP = {
  '1M': { range: '1mo', interval: '1d' },
  '3M': { range: '3mo', interval: '1d' },
  '6M': { range: '6mo', interval: '1d' },
  'YTD': { range: 'ytd', interval: '1d' },
  '1Y': { range: '1y', interval: '1d' },
  '5Y': { range: '5y', interval: '1wk' },
  'ALL': { range: 'max', interval: '1mo' },
};

module.exports = async (req, res) => {
  try {
    const symbol = String(req.query.symbol || '').trim().toUpperCase();
    const rangeKey = String(req.query.range || '1M').trim();

    if (!symbol || !/^[A-Z0-9.\-]{1,10}$/.test(symbol)) {
      return res.status(400).json({ error: 'Invalid or missing symbol' });
    }

    const rangeDef = RANGE_MAP[rangeKey];
    if (!rangeDef) {
      return res.status(400).json({ error: `Unsupported range: ${rangeKey}` });
    }

    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${rangeDef.range}&interval=${rangeDef.interval}`;
    const resp = await fetch(yahooUrl);

    if (!resp.ok) {
      return res.status(resp.status).json({ error: 'Yahoo Finance returned an error' });
    }

    const data = await resp.json();
    const result = data?.chart?.result?.[0];
    const error = data?.chart?.error;

    if (error) {
      // Yahoo returns a 200 with an error payload for an unknown symbol,
      // rather than a 4xx — surface that distinctly from a real outage.
      return res.status(404).json({ error: error.description || 'Symbol not found' });
    }

    const timestamps = result?.timestamp;
    const closes = result?.indicators?.quote?.[0]?.close;

    if (!Array.isArray(timestamps) || !Array.isArray(closes) || timestamps.length === 0) {
      return res.status(502).json({ error: 'Unexpected response shape from Yahoo Finance' });
    }

    // Yahoo can return null closes for non-trading timestamps at the edges
    // of a range — drop those rather than plotting a gap/zero.
    const points = timestamps
      .map((t, i) => ({ t, price: closes[i] }))
      .filter((p) => typeof p.price === 'number');

    // Daily candles don't change intraday history once the market's closed,
    // and even during market hours this is "good enough" for a portal
    // widget — cache briefly to stay well within Vercel's function limits
    // if multiple people/tabs hit the same symbol+range.
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({ points });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown server error' });
  }
};
