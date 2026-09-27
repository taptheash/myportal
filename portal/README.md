# MyPortal

Doug's personal homepage: a modern, customizable take on iGoogle. It's live at **portal.taptheash.us**, and also at myportal-gilt.vercel.app.

The front end is React 19, TypeScript and Tailwind (Create React App). The server side is a set of Vercel serverless functions in `api/`. Data is stored in each browser's localStorage, with optional Google sign-in that syncs it through Firebase Firestore.

## What's on it

- **Home**: a customizable set of cards.
  - Today's summary, weather, today's calendar, favorite and recent links, Scratchpad, On This Day, top stories, sports and markets.
  - Click Customize to show, hide or reorder them.
- **Tools**: Weather (forecast, radar, current-location button), Quick Links, Google Calendar, Notes, Tasks with due dates.
  - Quick Links has folders, favorites and drag-to-reorder.
  - Right-click a link, or use its ⋯ button, for more actions: open, copy URL, duplicate, move, set folder color.
- **News**: Headlines, US, Tech & AI, NH Local, NE Sports, Business, Other, and your own RSS feeds.
- **Reddit**: posts from the subreddits you pick.
- **Sports**: your teams with live scores, the NFL schedule, and Patriots/Red Sox/Celtics/Bruins schedules.
- **Stocks**: a watchlist and a market overview, with charts.
- **Header**: live clock, On This Day and National Day, search (**Ctrl+K**), cloud sync button, and the light/dark/system theme toggle.

## Deploying

Vercel builds automatically from GitHub. Only the **`main`** branch goes to the live site; pushes to other branches create Preview deployments. The Vercel project's Root Directory is `portal`.

```powershell
cd C:\Users\dwcha\Claude\MyPortal
git status
git add <files>
git commit -m "..."
git push
```

After a push, check the new deployment in Vercel, then hard-refresh the site (Ctrl+Shift+R).

## Environment variables (set in Vercel)

| Variable | Type | Used by |
|---|---|---|
| `PORTAL_API_KEY` | Secret | Calendar passcode, checked by `api/calendar/events.js` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID` | Secret | Google Calendar |
| `OPENWEATHER_API_KEY` | Secret | `api/weather.js` |
| `RSS2JSON_API_KEY` | Secret | `api/rss.js` (optional; without it each feed returns only 10 items) |
| `FINNHUB_API_KEY` | Secret | `api/finnhub.js` |
| `REACT_APP_FIREBASE_*` (6) | Config | Cloud sync. This config is public by design; `../firebase/firestore.rules` protects the data. |

Never put a secret in a variable whose name starts with `REACT_APP_`. Create React App builds those into the public page. After changing a variable, redeploy for it to take effect.

## Running locally

```powershell
cd C:\Users\dwcha\Claude\MyPortal\portal
npm install
npm start                        # the page only — weather, news, stocks and calendar need the /api functions
npx vercel dev                   # page + /api functions (needs the Vercel CLI and your env vars)
npm test -- --watchAll=false     # tests
npm run build                    # production build
```

Local variables go in `portal/.env.local`, which is never committed. A fresh clone won't have it; copy it from another machine.

If `npm install` on Windows rewrites `package-lock.json`, run `git restore portal/package-lock.json` before switching branches. The committed lock file is the correct one.

## Security notes

- Every keyed third-party API is called through `api/`, so no API key is ever in the browser.
- The calendar API needs the portal passcode. Each browser asks for it once, in Tools › Calendar.
- Cloud sync signs in with Google and is limited to taptheash@gmail.com, both in the app and in the Firestore rules. The calendar passcode is never synced.
- The portal works fully when signed out, so Firebase can't lock you out.

## Hidden links page

The 1-pixel dot in the bottom-left corner opens a separate private link list. Those links open through a local `openpriv://` protocol handler, which launches a Chrome incognito or Edge InPrivate window. The handler has to be installed on each Windows machine. Its setup file, `README-private-links.md`, isn't in this repo yet.
