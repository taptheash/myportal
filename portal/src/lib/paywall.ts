import { useSyncExternalStore } from 'react';

// Sites whose articles usually sit behind a paywall or a sign-in wall. An
// article from one of them gets a small lock icon with links to archived
// copies. You can add or remove sites (News > the lock button in the toolbar);
// your changes are stored as a difference from this list, so improvements to
// the list reach you without undoing your edits.
export const DEFAULT_PAYWALLED = [
  'nytimes.com', 'wsj.com', 'washingtonpost.com', 'boston.com', 'bostonglobe.com', 'bostonherald.com',
  'concordmonitor.com', 'unionleader.com', 'seacoastonline.com', 'fosters.com', 'nhbr.com',
  'bloomberg.com', 'ft.com', 'economist.com', 'newyorker.com', 'theatlantic.com', 'wired.com',
  'businessinsider.com', 'barrons.com', 'latimes.com', 'theathletic.com', 'hbr.org', 'technologyreview.com',
];

export interface PaywallPrefs { added: string[]; removed: string[] }

export const PAYWALL_KEY = 'pw6-paywall-sites';

function parsePrefs(raw: string | null): PaywallPrefs {
  try {
    const v = raw ? JSON.parse(raw) : null;
    const list = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : []);
    return { added: list(v?.added), removed: list(v?.removed) };
  } catch {
    return { added: [], removed: [] };
  }
}

function sitesFrom(prefs: PaywallPrefs): string[] {
  const out = DEFAULT_PAYWALLED.filter((s) => !prefs.removed.includes(s));
  for (const s of prefs.added) if (!out.includes(s)) out.push(s);
  return out.sort();
}

export function readPrefs(): PaywallPrefs {
  try { return parsePrefs(localStorage.getItem(PAYWALL_KEY)); } catch { return { added: [], removed: [] }; }
}

export function paywallSites(): string[] {
  return sitesFrom(readPrefs());
}

function writePrefs(prefs: PaywallPrefs) {
  try {
    const empty = prefs.added.length === 0 && prefs.removed.length === 0;
    if (empty) localStorage.removeItem(PAYWALL_KEY);
    else localStorage.setItem(PAYWALL_KEY, JSON.stringify(prefs));
  } catch { /* storage unavailable */ }
  window.dispatchEvent(new CustomEvent('portal-local-sync', { detail: { key: PAYWALL_KEY } }));
}

// "https://www.nytimes.com/2026/x" or "NYTimes.com" -> "nytimes.com"
export function normalizeSite(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0].replace(/^www\./, '');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : null;
}

export function addSite(site: string) {
  const prefs = readPrefs();
  const removed = prefs.removed.filter((s) => s !== site);
  const added = DEFAULT_PAYWALLED.includes(site) || prefs.added.includes(site) ? prefs.added : prefs.added.concat(site);
  writePrefs({ added, removed });
}

export function removeSite(site: string) {
  const prefs = readPrefs();
  const added = prefs.added.filter((s) => s !== site);
  const removed = DEFAULT_PAYWALLED.includes(site) && !prefs.removed.includes(site) ? prefs.removed.concat(site) : prefs.removed;
  writePrefs({ added, removed });
}

export function resetSites() {
  writePrefs({ added: [], removed: [] });
}

export function hostOf(link: string): string | null {
  try { return new URL(link).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
}

// The listed site this article is from, if any ("www.nytimes.com" and
// "cooking.nytimes.com" both match "nytimes.com").
export function siteFor(link: string, sites: string[]): string | null {
  const host = hostOf(link);
  if (!host) return null;
  return sites.find((s) => host === s || host.endsWith(`.${s}`)) ?? null;
}

// Without the tracking parameters, so the archives recognise the page.
function cleanLink(link: string): string {
  try {
    const u = new URL(link);
    Array.from(u.searchParams.keys()).forEach((k) => {
      if (/^(utm_|fbclid|gclid|mc_|cmp$|smid$|referringsource$)/i.test(k)) u.searchParams.delete(k);
    });
    return u.toString();
  } catch { return link; }
}

// The first two take the article address straight after their own; the third
// takes it as a query parameter. They are plain links; the portal never loads
// the article itself.
export function archiveLinks(link: string): { wayback: string; archiveToday: string; removePaywall: string } {
  const url = cleanLink(link);
  return {
    wayback: `https://web.archive.org/web/${url}`,
    archiveToday: `https://archive.today/newest/${url}`,
    removePaywall: `https://www.removepaywall.com/search?url=${encodeURIComponent(url)}`,
  };
}

// --- React hook: the current site list, kept current across the page ---------
let snapRaw: string | null | undefined;
let snapSites: string[] = sitesFrom({ added: [], removed: [] });

function getSnapshot(): string[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(PAYWALL_KEY); } catch { /* unavailable */ }
  if (raw !== snapRaw) {
    snapRaw = raw;
    snapSites = sitesFrom(parsePrefs(raw));
  }
  return snapSites;
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('portal-local-sync', cb); // our own edits, and cloud sync from another device
  window.addEventListener('storage', cb);           // another tab
  return () => {
    window.removeEventListener('portal-local-sync', cb);
    window.removeEventListener('storage', cb);
  };
}

export function usePaywallSites(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
