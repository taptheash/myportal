import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LockOpen, X } from 'lucide-react';
import { usePaywallSites, normalizeSite, addSite, removeSite, resetSites, readPrefs } from '../../lib/paywall';

// Toolbar button on the News section: which sites get the archive-link lock.
// Starts from a built-in list of usually-paywalled sites; add your own or
// remove ones that aren't a problem for you.
const PANEL_W = 300;

export default function PaywallSitesButton() {
  const sites = usePaywallSites();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pos) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (btn.current?.contains(t) || t?.closest?.('[data-paywall-sites]')) return;
      setPos(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPos(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pos]);

  const add = () => {
    const site = normalizeSite(input);
    if (!site) { setError('Enter a site like example.com'); return; }
    addSite(site);
    setInput('');
    setError('');
  };
  const customised = (() => { const p = readPrefs(); return p.added.length > 0 || p.removed.length > 0; })();

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => {
          if (pos) { setPos(null); return; }
          const r = btn.current?.getBoundingClientRect();
          if (!r) return;
          setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.right - PANEL_W, window.innerWidth - PANEL_W - 8)) });
        }}
        title="Sites that get an archive link when an article is paywalled"
        aria-haspopup="dialog"
        aria-expanded={!!pos}
        className="flex items-center justify-center p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors duration-150"
      >
        <LockOpen size={14} />
      </button>
      {pos && createPortal(
        <div
          data-paywall-sites
          role="dialog"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: PANEL_W, maxHeight: '70vh' }}
          className="z-[400] flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg text-sm text-zinc-800 dark:text-zinc-100"
        >
          <div className="p-3 pb-2">
            <p className="font-semibold">Paywalled sites</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Articles from these sites get a lock icon with links to an archived copy.
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <input
                value={input}
                onChange={(e) => { setInput(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder="Add a site, e.g. example.com"
                className="flex-1 min-w-0 px-2 py-1 text-sm rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <button onClick={add} className="px-2.5 py-1 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors duration-150">Add</button>
            </div>
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
          <ul className="flex-1 overflow-y-auto px-3 pb-2">
            {sites.map((s) => (
              <li key={s} className="group flex items-center justify-between py-0.5">
                <span className="truncate">{s}</span>
                <button onClick={() => removeSite(s)} title={`Stop marking ${s}`} aria-label={`Remove ${s}`}
                  className="p-0.5 rounded text-zinc-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-500 transition-all duration-150">
                  <X size={13} />
                </button>
              </li>
            ))}
            {sites.length === 0 && <li className="text-xs text-zinc-400 py-1">No sites. Add one above.</li>}
          </ul>
          {customised && (
            <button onClick={resetSites} className="px-3 py-2 text-xs text-left text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 border-t border-zinc-100 dark:border-zinc-800">
              Reset to the built-in list
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
