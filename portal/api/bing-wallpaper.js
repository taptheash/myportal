// Vercel Serverless Function
// Fetches Bing's "Image of the Day" server-side and returns just the image URL.
// This has to happen server-side: Bing's HPImageArchive endpoint does not send
// Access-Control-Allow-Origin headers, so a direct fetch() from the browser is
// blocked by CORS regardless of how the request is formed. Server-to-server
// requests aren't subject to CORS (it's a browser-only restriction), so this
// function makes the call on the portal's behalf and the frontend calls this
// same-origin route instead.

module.exports = async (req, res) => {
  try {
    const bingUrl = 'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=en-US';
    const resp = await fetch(bingUrl);

    if (!resp.ok) {
      return res.status(resp.status).json({ error: 'Bing returned an error' });
    }

    const data = await resp.json();
    const image = data.images && data.images[0];

    if (!image || !image.url) {
      return res.status(502).json({ error: 'Unexpected response shape from Bing' });
    }

    const imageUrl = `https://www.bing.com${image.url}`;

    // The wallpaper only changes once a day; let the browser cache it for an hour.
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json({ imageUrl, title: image.title || '' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown server error' });
  }
};
