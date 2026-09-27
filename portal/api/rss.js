// Vercel Serverless Function — rss2json proxy (RSS -> JSON, no CORS issues).
// Keeps the rss2json API key on the server instead of in the public bundle.
//
// GET /api/rss?rss_url=<feed url>&count=<n>

const KEY = () => process.env.RSS2JSON_API_KEY || process.env.REACT_APP_RSS2JSON_API_KEY;

module.exports = async (req, res) => {
  try {
    const rssUrl = String(req.query.rss_url || '');
    if (!/^https?:\/\//i.test(rssUrl) || rssUrl.length > 1000) {
      return res.status(400).json({ status: 'error', message: 'Invalid rss_url' });
    }
    const count = Math.min(100, Math.max(1, parseInt(String(req.query.count || '20'), 10) || 20));

    const params = new URLSearchParams({ rss_url: rssUrl });
    const key = KEY();
    // Without a key rss2json ignores count/order and returns its default 10.
    if (key) {
      params.set('api_key', key);
      params.set('count', String(count));
      params.set('order_by', 'pubDate');
      params.set('order_dir', 'desc');
    }

    const resp = await fetch(`https://api.rss2json.com/v1/api.json?${params.toString()}`);
    const data = await resp.json().catch(() => ({ status: 'error', message: 'Bad response from rss2json' }));
    // The browser already caches feeds for an hour in localStorage; a short
    // edge cache just absorbs bursts. A manual refresh adds a unique `_`
    // param, so it always gets a fresh copy.
    if (resp.ok && data.status === 'ok') {
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    }
    return res.status(resp.status).json(data);
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message || 'Unknown server error' });
  }
};
