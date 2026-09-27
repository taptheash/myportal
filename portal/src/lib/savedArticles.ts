import { useEffect, useState } from 'react';
import { getWidgetConfig, updateWidgetConfig } from './portalStorage';

// Articles bookmarked from any News tab. They live in the 'saved' widget's
// config inside pw6, so they sync across devices like everything else, and
// they stay until removed.

export interface SavedArticle {
  link: string;
  title: string;
  source?: string;
  savedAt: number;
}

export function getSavedArticles(): SavedArticle[] {
  const items = getWidgetConfig('saved').items;
  return Array.isArray(items) ? items : [];
}

export function toggleSavedArticle(a: { link: string; title: string; source?: string }) {
  if (!a.link) return;
  const items = getSavedArticles();
  const next = items.some((i) => i.link === a.link)
    ? items.filter((i) => i.link !== a.link)
    : [{ link: a.link, title: a.title, source: a.source, savedAt: Date.now() }, ...items];
  updateWidgetConfig('saved', { items: next });
}

export function removeSavedArticle(link: string) {
  updateWidgetConfig('saved', { items: getSavedArticles().filter((i) => i.link !== link) });
}

// The set of saved links, kept current as articles are saved anywhere
// (this tab, another tab, or another synced device).
export function useSavedLinks(): Set<string> {
  const read = () => new Set(getSavedArticles().map((a) => a.link));
  const [links, setLinks] = useState<Set<string>>(read);
  useEffect(() => {
    const refresh = () => setLinks(read());
    const onSync = (e: Event) => { if ((e as CustomEvent).detail?.key === 'pw6') refresh(); };
    window.addEventListener('pw6-sync', refresh);
    window.addEventListener('portal-local-sync', onSync);
    return () => {
      window.removeEventListener('pw6-sync', refresh);
      window.removeEventListener('portal-local-sync', onSync);
    };
  }, []);
  return links;
}
