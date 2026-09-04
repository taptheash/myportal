import React, { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

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

// ETF proxies, not the raw index values — SPY/DIA/QQQ trade as regular
// stocks, so the same /quote endpoint works for them without needing a
// separate indices API. Very closely tracks the underlying index, but is
// technically the ETF's price, not the index number itself.
const INDICES = [
  { symbol: 'SPY', label: 'S&P 500' },
  { symbol: 'DIA', label: 'Dow Jones' },
  { symbol: 'QQQ', label: 'Nasdaq' },
];

export default function MarketOverview(_props: MarketOverviewProps) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const API_KEY = process.env.REACT_APP_FINNHUB_API_KEY;

  useEffect(() => {
    if (!API_KEY) return;
    let cancelled = false;

    setQuotes(() => {
      const next: Record<string, Quote> = {};
      INDICES.forEach((i) => { next[i.symbol] = { price: 0, change: 0, percentChange: 0, status: 'loading' }; });
      return next;
    });

    const fetchQuote = async (symbol: string) => {
      try {
        const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`);
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
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

    INDICES.forEach((i) => fetchQuote(i.symbol));
    const interval = setInterval(() => INDICES.forEach((i) => fetchQuote(i.symbol)), 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [API_KEY]);

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
      {INDICES.map((i) => {
        const q = quotes[i.symbol];
        const isUp = q && q.change >= 0;
        return (
          <div key={i.symbol} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-slate-700 rounded-lg">
            <div>
              <div className="font-bold text-sm text-gray-900 dark:text-white">{i.label}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">{i.symbol}</div>
            </div>

            {q?.status === 'loading' && <span className="text-xs text-gray-400">Loading…</span>}
            {q?.status === 'error' && (
              <span className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> Unavailable</span>
            )}
            {q?.status === 'ok' && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">${q.price.toFixed(2)}</span>
                <span className={`flex items-center gap-0.5 text-xs font-semibold ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {isUp ? '+' : ''}{q.change.toFixed(2)} ({isUp ? '+' : ''}{q.percentChange.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
