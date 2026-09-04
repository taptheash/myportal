import React, { useState, useEffect } from 'react';
import { AlertCircle, Trash2, TrendingUp, TrendingDown, Check, X } from 'lucide-react';

interface WatchlistProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface Ticker {
  symbol: string;
}

interface Quote {
  price: number;
  change: number;
  percentChange: number;
  status: 'loading' | 'ok' | 'error';
}

const DEFAULT_TICKERS: Ticker[] = [
  { symbol: 'AAPL' },
  { symbol: 'MSFT' },
];

export default function Watchlist({ config, onUpdateConfig }: WatchlistProps) {
  const tickers: Ticker[] = config.tickers ?? DEFAULT_TICKERS;
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [newSymbol, setNewSymbol] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const API_KEY = process.env.REACT_APP_FINNHUB_API_KEY;
  const tickersKey = tickers.map((t) => t.symbol).join(',');

  useEffect(() => {
    if (!API_KEY) return;
    let cancelled = false;

    setQuotes((prev) => {
      const next: Record<string, Quote> = {};
      tickers.forEach((t) => { next[t.symbol] = prev[t.symbol] ?? { price: 0, change: 0, percentChange: 0, status: 'loading' }; });
      return next;
    });

    const fetchQuote = async (symbol: string) => {
      try {
        const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`);
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        // Finnhub returns c:0 for a symbol it doesn't recognize, rather
        // than an HTTP error — treat that as invalid too.
        if (!data || data.c === 0) throw new Error('no data');
        if (!cancelled) {
          setQuotes((prev) => ({
            ...prev,
            [symbol]: { price: data.c, change: data.d, percentChange: data.dp, status: 'ok' },
          }));
        }
      } catch {
        if (!cancelled) {
          setQuotes((prev) => ({ ...prev, [symbol]: { price: 0, change: 0, percentChange: 0, status: 'error' } }));
        }
      }
    };

    tickers.forEach((t) => fetchQuote(t.symbol));
    // Stock prices move much faster than weather/sports — 60s poll, well
    // within Finnhub's free-tier 60 calls/minute even with a dozen tickers.
    const interval = setInterval(() => tickers.forEach((t) => fetchQuote(t.symbol)), 60000);
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_KEY, tickersKey]);

  const addTicker = () => {
    const symbol = newSymbol.trim().toUpperCase();
    if (!symbol) return;
    if (tickers.some((t) => t.symbol === symbol)) {
      setAddError('Already on your watchlist');
      return;
    }
    onUpdateConfig({ ...config, tickers: [...tickers, { symbol }], showAdd: false });
    setNewSymbol('');
    setAddError(null);
  };

  const removeTicker = (symbol: string) => {
    onUpdateConfig({ ...config, tickers: tickers.filter((t) => t.symbol !== symbol) });
  };

  if (!API_KEY) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-400 dark:text-gray-500 text-center px-4">
        <AlertCircle size={20} />
        <p className="text-sm">
          Needs a free Finnhub API key — sign up at finnhub.io, then add it as
          <br />
          <code className="text-xs bg-gray-100 dark:bg-slate-700 px-1 rounded">REACT_APP_FINNHUB_API_KEY</code> in Vercel.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {config.showAdd && (
        <div className="flex flex-col gap-1.5 p-2 bg-blue-50 dark:bg-slate-700 rounded-lg border border-blue-200 dark:border-slate-600">
          {addError && <p className="text-xs text-red-500">{addError}</p>}
          <input
            type="text"
            placeholder="Ticker symbol (e.g. AAPL)"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTicker()}
            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-600 text-gray-900 dark:text-white text-sm border border-gray-300 dark:border-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={addTicker} className="flex-1 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1">
              <Check size={14} /> Add
            </button>
            <button
              onClick={() => { onUpdateConfig({ ...config, showAdd: false }); setNewSymbol(''); setAddError(null); }}
              className="flex-1 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1"
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {tickers.map((t) => {
        const q = quotes[t.symbol];
        const isUp = q && q.change >= 0;
        return (
          <div key={t.symbol} className="group flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-slate-700 rounded-lg">
            <span className="font-bold text-sm text-gray-900 dark:text-white">{t.symbol}</span>

            {q?.status === 'loading' && <span className="text-xs text-gray-400">Loading…</span>}
            {q?.status === 'error' && (
              <span className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> Unavailable</span>
            )}
            {q?.status === 'ok' && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">${q.price.toFixed(2)}</span>
                {/* Color plus icon plus explicit sign — not color alone, same
                    principle used for colorblind-safe cues elsewhere in this app. */}
                <span className={`flex items-center gap-0.5 text-xs font-semibold ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {isUp ? '+' : ''}{q.change.toFixed(2)} ({isUp ? '+' : ''}{q.percentChange.toFixed(2)}%)
                </span>
              </div>
            )}

            <button
              onClick={() => removeTicker(t.symbol)}
              className="ml-2 p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500 transition"
              title="Remove"
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}

      {tickers.length === 0 && (
        <div className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">No tickers yet — add one above.</div>
      )}
    </div>
  );
}
