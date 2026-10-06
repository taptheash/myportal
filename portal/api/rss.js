// Vercel Serverless Function — RSS/Atom -> JSON for the News and Reddit
// widgets, in rss2json's response shape so the widgets don't change.
//
// GET /api/rss?rss_url=<feed url>&count=<n>
//
// Reads the feed directly first. rss2json is only the backup now: its free
// plan caps how many different feeds an account may use, and once the
// portal hit that cap every newly added feed (a new subreddit, a custom feed)
// failed with "You are using all the available feeds for your account".
// Direct reading has no such cap. rss2json still steps in when a site turns
// away the direct request (some block cloud servers) and rss2json already
// knows that feed.

const { parseFeed } = require('./_feed');

const KEY = () => process.env.RSS2JSON_API_KEY || process.env.REACT_APP_RSS2JSON_API_KEY;
const UA = 'Mozilla/5.0 (compatible; MyPortal/1.0; personal homepage; +https://portal.taptheash.us)';
const TIMEOUT_MS = 8000;

async function readDirect(rssUrl, count) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(rssUrl, {
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!resp.ok) throw new Error(`Feed site returned HTTP ${resp.status}`);
    const feed = parseFeed(await resp.text());
    if (!feed) throw new Error('Feed site did not return a feed');
    if (!feed.items.length) throw new Error('Feed had no items');
    const items = feed.items
      .sort((a, b) => (b.pubDate || '').localeCompare(a.pubDate || ''))
      .slice(0, count);
    return { status: 'ok', source: 'direct', feed: { url: rssUrl, title: feed.title }, items };
  } finally {
    clearTimeout(timer);
  }
}

async function readViaRss2json(rssUrl, count) {
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
  return { httpStatus: resp.status, data: { ...data, source: 'rss2json' } };
}

module.exports = async (req, res) => {
  try {
    const rssUrl = String(req.query.rss_url || '');
    if (!/^https?:\/\//i.test(rssUrl) || rssUrl.length > 1000) {
      return res.status(400).json({ status: 'error', message: 'Invalid rss_url' });
    }
    const count = Math.min(100, Math.max(1, parseInt(String(req.query.count || '20'), 10) || 20));

    // The browser already caches feeds for an hour in localStorage; a short
    // edge cache just absorbs bursts. A manual refresh adds a unique `_`
    // param, so it always gets a fresh copy.
    const cacheOk = () => res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

    let directError;
    try {
      const data = await readDirect(rssUrl, count);
      cacheOk();
      return res.status(200).json(data);
    } catch (err) {
      directError = err.name === 'AbortError' ? 'Feed site timed out' : (err.message || String(err));
    }

    const { httpStatus, data } = await readViaRss2json(rssUrl, count);
    if (httpStatus >= 200 && httpStatus < 300 && data.status === 'ok') {
      cacheOk();
      return res.status(200).json(data);
    }
    // Both failed: report both reasons so Feed Health shows what happened.
    // 422 (not 5xx) because the widgets read the message on a 422.
    return res.status(422).json({
      status: 'error',
      message: `${directError}; backup (rss2json): ${data.message || `HTTP ${httpStatus}`}`,
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message || 'Unknown server error' });
  }
};
