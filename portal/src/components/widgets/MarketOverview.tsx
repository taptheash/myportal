import React, { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import StockDetailModal from './StockDetailModal';

interface MarketOverviewProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface Quote {
  price: number;
  change: number;
  percentChange: number;
  status: 'loading' | 'ok' | 'error';
}

// Real index tickers (Yahoo's ^-prefixed format), not ETF proxies — an ETF's
// per-share price trades at a completely different scale than the index it
// tracks (QQQ was ~$719/share while the Nasdaq Composite it tracks was
// ~26,500), so showing the ETF price under an index's name was misleading
// even though the number itself was accurate. `shortLabel` is the familiar
// shorthand shown as the row's subtitle (no caret — that's Yahoo-specific
// plumbing, not something a reader needs to see).
const INDICES = [
  { symbol: '^GSPC', label: 'S&P 500', shortLabel: 'SPX' },
  { symbol: '^DJI', label: 'Dow Jones', shortLabel: 'DJI' },
  { symbol: '^IXIC', label: 'Nasdaq', shortLabel: 'IXIC' },
];

const emptyQuote = (): Quote => ({ price: 0, change: 0, percentChange: 0, status: 'loading' });

export default function MarketOverview(_props: MarketOverviewProps) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setQuotes(() => {
      const next: Record<string, Quote> = {};
      INDICES.forEach((i) => { next[i.symbol] = emptyQuote(); });
      return next;
    });

    // Just the live quote now — the /api/stock-chart Yahoo proxy (also used
    // by StockDetailModal) still returns history alongside it, but this
    // widget only needs the price/change row, not a sparkline. One retry on
    // failure before showing "Unavailable": a single dropped/slow request to
    // Yahoo (rate limit, timeout) would otherwise sit as an error for a full
    // 60s poll cycle even though the data is fine moments later.
    const fetchIndex = async (symbol: string, isRetry = false) => {
      try {
        const res = await fetch(`/api/stock-chart?symbol=${encodeURIComponent(symbol)}&range=1M`);
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        if (typeof data.price !== 'number' || typeof data.change !== 'number') throw new Error('no data');
        if (cancelled) return;

        setQuotes((prev) => ({
          ...prev,
          [symbol]: {
            ...(prev[symbol] ?? emptyQuote()),
            price: data.price,
            change: data.change,
            percentChange: data.percentChange ?? 0,
            status: 'ok',
          },
        }));
      } catch {
        if (cancelled) return;
        if (!isRetry) {
          setTimeout(() => fetchIndex(symbol, true), 2000);
          return;
        }
        setQuotes((prev) => ({ ...prev, [symbol]: { ...(prev[symbol] ?? emptyQuote()), status: 'error' } }));
      }
    };

    INDICES.forEach((i) => fetchIndex(i.symbol));
    // Index values move throughout the trading day but not tick-by-tick at
    // portal-widget granularity — 60s matches the polling cadence already
    // used for Watchlist tickers.
    const interval = setInterval(() => INDICES.forEach((i) => fetchIndex(i.symbol)), 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {INDICES.map((i) => {
        const q = quotes[i.symbol];
        const isUp = q && q.change >= 0;
        return (
          <div
            key={i.symbol}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedSymbol(i.symbol)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedSymbol(i.symbol); } }}
            title={`View ${i.symbol} chart`}
            className="surface-card px-3 py-2.5 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl cursor-pointer transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-zinc-900 dark:text-white">{i.label}</div>
                <div className="text-xs text-zinc-400 dark:text-zinc-500">{i.shortLabel}</div>
              </div>

              {q?.status === 'loading' && <span className="text-xs text-zinc-400">Loading…</span>}
              {q?.status === 'error' && (
                <span className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> Unavailable</span>
              )}
              {q?.status === 'ok' && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white">${q.price.toFixed(2)}</span>
                  <span className={`flex items-center gap-0.5 text-xs font-semibold ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {isUp ? '+' : ''}{q.change.toFixed(2)} ({isUp ? '+' : ''}{q.percentChange.toFixed(2)}%)
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {selectedSymbol && (
        <StockDetailModal symbol={selectedSymbol} onClose={() => setSelectedSymbol(null)} />
      )}
    </div>
  );
}
