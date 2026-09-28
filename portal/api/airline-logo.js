// Vercel Serverless Function — airline logo by ICAO airline code.
//
// GET /api/airline-logo?code=DAL
//
// Serves logos from the free community set at github.com/sexym0nk3y/airline-logos
// (90×90 PNGs named by ICAO code). Going through here lets Vercel's CDN cache
// each logo for a month, so the portal isn't hotlinking GitHub on every poll.
// Missing logos return 404, which the page shows as an LED plane icon.

const SOURCE = 'https://raw.githubusercontent.com/sexym0nk3y/airline-logos/main/logos';

module.exports = async (req, res) => {
  const code = String(req.query.code || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return res.status(400).json({ error: 'Invalid airline code' });
  try {
    const resp = await fetch(`${SOURCE}/${code}.png`, { headers: { 'User-Agent': 'MyPortal (personal homepage)' } });
    if (!resp.ok) {
      res.setHeader('Cache-Control', 'public, s-maxage=86400');
      return res.status(404).json({ error: 'No logo' });
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=2592000');
    return res.status(200).send(buf);
  } catch (err) {
    return res.status(502).json({ error: err.message || 'Logo fetch failed' });
  }
};
