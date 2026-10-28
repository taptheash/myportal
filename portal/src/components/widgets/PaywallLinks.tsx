import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LockOpen, History, Archive, Link2, Ban } from 'lucide-react';
import { usePaywallSites, siteFor, archiveLinks, removeSite } from '../../lib/paywall';

// A small lock on articles from sites that are usually paywalled. Clicking it
// opens a menu with links to an archived copy of the article. It sits next to
// the bookmark (SaveButton renders it), inside the article's link, so it stops
// the click from also opening the article.
//
// The menu is drawn on the page body, not inside the article row, so a scrolling
// or clipped list can't cut it off.
const MENU_W = 248;

export default function PaywallLinks({ link, size = 14 }: { link: string; size?: number }) {
  const sites = usePaywallSites();
  const site = siteFor(link, sites);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (btn.current?.contains(t) || t?.closest?.('[data-paywall-menu]')) return;
      setPos(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPos(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  if (!site) return null;

  const stop = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); };
  const { wayback, archiveToday, removePaywall } = archiveLinks(link);
  const open = (url: string) => (e: React.MouseEvent) => {
    stop(e);
    window.open(url, '_blank', 'noopener,noreferrer');
    setPos(null);
  };
  const item = 'w-full flex items-start gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150';

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={(e) => {
          stop(e);
          if (pos) { setPos(null); return; }
          const r = btn.current?.getBoundingClientRect();
          if (!r) return;
          setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8)) });
        }}
        title={`${site} is usually paywalled: read an archived copy`}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        className="flex-shrink-0 mt-0.5 text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300 transition-colors duration-150"
      >
        <LockOpen size={size} />
      </button>
      {pos && createPortal(
        <div
          data-paywall-menu
          role="menu"
          onClick={stop}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_W }}
          className="z-[400] rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg p-1 text-sm text-zinc-800 dark:text-zinc-100"
        >
          <p className="px-2 pt-1 pb-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">Read an archived copy (opens in a new tab)</p>
          <button role="menuitem" className={item} onClick={open(wayback)}>
            <History size={14} className="mt-0.5 flex-shrink-0 text-indigo-500" />
            <span>
              Wayback Machine
              <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">Internet Archive. New stories may not be saved yet.</span>
            </span>
          </button>
          <button role="menuitem" className={item} onClick={open(archiveToday)}>
            <Archive size={14} className="mt-0.5 flex-shrink-0 text-indigo-500" />
            <span>
              archive.today
              <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">Newest saved copy. Often has fresh articles.</span>
            </span>
          </button>
          <button role="menuitem" className={item} onClick={open(removePaywall)}>
            <Link2 size={14} className="mt-0.5 flex-shrink-0 text-indigo-500" />
            <span>
              removepaywall.com
              <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">Third-party reader. Works on some sites, not all.</span>
            </span>
          </button>
          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
          <button role="menuitem" className={`${item} text-zinc-500 dark:text-zinc-400`} onClick={(e) => { stop(e); removeSite(site); setPos(null); }}>
            <Ban size={14} className="mt-0.5 flex-shrink-0" />
            <span>Not paywalled: stop marking {site}</span>
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
