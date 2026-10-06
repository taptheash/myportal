// Tracks the links Doug actually opens, most-recent-first, capped to a small
// list. Deliberately dumb: no scoring, no "frequently used" weighting — just
// a simple recency log, per the "Do NOT over-engineer this" instruction.
// Shared across QuickLinks (which calls recordLinkClick on every open) and
// Home's Recent module (which reads getRecentLinks).

export interface RecentLink {
  id: string;
  label: string;
  url: string;
  ts: number;
  count?: number; // how many times it's been opened (for Quick Links' "Frequent")
}

const STORAGE_KEY = 'pw6-recent-links';
// Kept longer than Home's Recent list needs so open counts survive for
// the Frequent list too.
const MAX_ENTRIES = 40;

function readAll(): RecentLink[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(entries: RecentLink[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage full — not fatal, recents just won't persist this time
  }
}

// Called on every link click. De-dupes by id (a re-click just bumps it to
// the top with a fresh timestamp rather than creating a second row).
export function recordLinkClick(link: { id: string; label: string; url: string }) {
  const all = readAll();
  const prev = all.find((e) => e.id === link.id);
  const existing = all.filter((e) => e.id !== link.id);
  const next = [{ ...link, ts: Date.now(), count: (prev?.count || 1) + (prev ? 1 : 0) }, ...existing].slice(0, MAX_ENTRIES);
  writeAll(next);
}

export function getRecentLinks(limit?: number): RecentLink[] {
  const all = readAll().sort((a, b) => b.ts - a.ts);
  return typeof limit === 'number' ? all.slice(0, limit) : all;
}

// Most-opened links first (ties go to the more recent one).
export function getFrequentLinks(limit: number): RecentLink[] {
  return readAll()
    .sort((a, b) => (b.count || 1) - (a.count || 1) || b.ts - a.ts)
    .slice(0, limit);
}

export function clearRecentLinks() {
  writeAll([]);
}
