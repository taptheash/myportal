import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { getWidgetConfig } from '../../lib/portalStorage';

// Home's stock summary: reads the SAME watchlist tickers already saved on
// the Stocks tab and fetches their quotes once (no independent poller — the
// Watchlist tab itself already polls every 60s while it's open; Home just
// needs a snapshot when it's the active section, not a duplicate stream).

interface Quote {
  symbol: string;
  price: number;
  percentChange: number;
}

export default function StocksHighlight() {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const API_KEY = process.env.REACT_APP_FINNHUB_API_KEY;
    const tickers: { symbol: string }[] = getWidgetConfig('watchlist')?.tickers || [];
    if (!API_KEY || tickers.length === 0) { setLoading(false); return; }

    const run = async () => {
      setLoading(true);
      const results = await Promise.all(
        tickers.slice(0, 4).map(async (t) => {
          try {
            const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${t.symbol}&token=${API_KEY}`);
            if (!res.ok) throw new Error('failed');
            const data = await res.json();
            if (!data || data.c === 0) throw new Error('no data');
            return { symbol: t.symbol, price: data.c, percentChange: data.dp };
          } catch {
            return null;
          }
        })
      );
      setQuotes(results.filter((r): r is Quote => r !== null));
      setLoading(false);
    };

    run();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-2">
        <Loader2 size={14} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!quotes || quotes.length === 0) {
    return <p className="text-xs text-zinc-400 dark:text-zinc-500 py-1">Add a ticker in Stocks to see it here.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {quotes.map((q) => {
        const up = q.percentChange >= 0;
        return (
          <div key={q.symbol} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60">
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">{q.symbol}</span>
            <span className={`flex items-center gap-1 text-xs font-medium tabular-nums ${up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {q.percentChange.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
