// Vercel Serverless Function — ESPN proxy for the Sports widget.
//
// GET /api/espn?path=sports/football/nfl/teams/ne
// GET /api/espn?path=sports/football/nfl/teams/ne/schedule
// GET /api/espn?path=sports/football/nfl/scoreboard
// GET /api/espn?path=sports/football/nfl/teams
//
// The widget used to call site.api.espn.com straight from the browser. That
// breaks whenever the browser refuses the cross-origin call (ESPN's CORS
// headers, blockers, VPN/DNS filters) even though the same URL opens fine in
// a tab. Calling it from here has none of those limits. Only ESPN's public
// site API paths below are allowed, so this can't be used as an open proxy.

const ALLOWED = /^sports\/[a-z-]{2,20}\/[a-z0-9-]{2,30}\/(scoreboard|teams|teams\/[a-z0-9-]{1,10}|teams\/[a-z0-9-]{1,10}\/schedule)$/;
const PASS_PARAMS = ['seasontype', 'limit', 'dates', 'season'];

module.exports = async (req, res) => {
  try {
    const path = String(req.query.path || '');
    if (!ALLOWED.test(path)) return res.status(400).json({ error: 'Unsupported ESPN path' });

    const params = new URLSearchParams();
    for (const k of PASS_PARAMS) {
      const v = req.query[k];
      if (v != null && /^[0-9-]{1,20}$/.test(String(v))) params.set(k, String(v));
    }
    const qs = params.toString();
    const url = `https://site.api.espn.com/apis/site/v2/${path}${qs ? `?${qs}` : ''}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let resp;
    try {
      resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MyPortal/1.0; personal homepage)', Accept: 'application/json' },
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!resp.ok) return res.status(502).json({ error: `ESPN returned HTTP ${resp.status}` });
    const data = await resp.json();
    // Live scores poll every 60s; a short edge cache absorbs bursts.
    res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=60');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: err.name === 'AbortError' ? 'ESPN timed out' : (err.message || 'ESPN lookup failed') });
  }
};
