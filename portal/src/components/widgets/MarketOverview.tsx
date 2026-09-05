import React, { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

interface MarketOverviewProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface ChartPoint {
  price: number;
}

interface Quote {
  price: number;
  change: number;
  percentChange: number;
  status: 'loading' | 'ok' | 'error';
  chart: ChartPoint[] | null; // null = not loaded / unavailable, distinct from an empty array
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

const emptyQuote = (): Quote => ({ price: 0, change: 0, percentChange: 0, status: 'loading', chart: null });

export default function MarketOverview(_props: MarketOverviewProps) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const API_KEY = process.env.REACT_APP_FINNHUB_API_KEY;

  useEffect(() => {
    if (!API_KEY) return;
    let cancelled = false;

    setQuotes(() => {
      const next: Record<string, Quote> = {};
      INDICES.forEach((i) => { next[i.symbol] = emptyQuote(); });
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
            [symbol]: { ...(prev[symbol] ?? emptyQuote()), price: data.c, change: data.d, percentChange: data.dp, status: 'ok' },
          }));
        }
      } catch {
        if (!cancelled) {
          setQuotes((prev) => ({ ...prev, [symbol]: { ...(prev[symbol] ?? emptyQuote()), status: 'error' } }));
        }
      }
    };

    // Historical candles are fetched separately from the live quote, and are
    // allowed to fail independently — Finnhub's free-tier access to this
    // endpoint is genuinely unclear (some sources say it's included, one
    // recent one says it 403s on free tier). If it fails, the price/change
    // display above still works fine; the chart is just omitted.
    const fetchChart = async (symbol: string) => {
      try {
        const to = Math.floor(Date.now() / 1000);
        const from = to - 30 * 24 * 60 * 60; // 30 days back
        const res = await fetch(
          `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${API_KEY}`
        );
        if (!res.ok) throw new Error('failed'); // catches a 403 on a restricted plan
        const data = await res.json();
        if (data?.s !== 'ok' || !Array.isArray(data.c) || data.c.length === 0) throw new Error('no candle data');
        const points: ChartPoint[] = data.c.map((price: number) => ({ price }));
        if (!cancelled) {
          setQuotes((prev) => ({ ...prev, [symbol]: { ...(prev[symbol] ?? emptyQuote()), chart: points } }));
        }
      } catch {
        // Leave chart as null — quote display is unaffected.
      }
    };

    INDICES.forEach((i) => { fetchQuote(i.symbol); fetchChart(i.symbol); });
    const interval = setInterval(() => INDICES.forEach((i) => fetchQuote(i.symbol)), 60000);
    // Chart data doesn't need the same 60s cadence as price — daily candles
    // only change once a day. Refresh hourly instead.
    const chartInterval = setInterval(() => INDICES.forEach((i) => fetchChart(i.symbol)), 3600000);
    return () => { cancelled = true; clearInterval(interval); clearInterval(chartInterval); };
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
        const chartUp = q?.chart && q.chart.length > 1 && q.chart[q.chart.length - 1].price >= q.chart[0].price;
        return (
          <div key={i.symbol} className="px-3 py-2.5 bg-gray-50 dark:bg-slate-700 rounded-lg">
            <div className="flex items-center justify-between">
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

            {q?.chart && q.chart.length > 1 && (
              <div className="h-10 mt-1.5">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={q.chart}>
                    <YAxis domain={['dataMin', 'dataMax']} hide />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke={chartUp ? '#16a34a' : '#dc2626'}
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
