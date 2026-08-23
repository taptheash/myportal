// Vercel Serverless Function
// Handles GET (list upcoming events) and POST (create event)
// Talks to Google Calendar using a service account — the private key
// never touches the browser, only this server-side function.

const { JWT } = require('google-auth-library');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

async function getAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !key) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY env vars');
  }

  const client = new JWT({
    email,
    key: key.replace(/\\n/g, '\n'), // Vercel env vars store \n as literal backslash-n
    scopes: SCOPES,
  });

  const { token } = await client.getAccessToken();
  return token;
}

module.exports = async (req, res) => {
  try {
    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    if (!calendarId) {
      return res.status(500).json({ error: 'Missing GOOGLE_CALENDAR_ID env var' });
    }

    const token = await getAccessToken();

    if (req.method === 'GET') {
      const timeMin = new Date().toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&maxResults=10&singleEvents=true&orderBy=startTime`;

      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await resp.json();

      if (!resp.ok) {
        return res.status(resp.status).json({ error: data.error?.message || 'Google Calendar API error' });
      }

      return res.status(200).json({ events: data.items || [] });
    }

    if (req.method === 'POST') {
      const { summary, startDateTime } = req.body || {};
      if (!summary || !startDateTime) {
        return res.status(400).json({ error: 'summary and startDateTime are required' });
      }

      const start = new Date(startDateTime);
      const end = new Date(start.getTime() + 60 * 60000); // defaults to 1 hour

      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary,
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
        }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        return res.status(resp.status).json({ error: data.error?.message || 'Google Calendar API error' });
      }

      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown server error' });
  }
};
