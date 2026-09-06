import React, { useState, useEffect, useMemo } from 'react';
import { X, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface StockDetailModalProps {
  symbol: string;
  onClose: () => void;
}

interface CandlePoint {
  t: number;    // unix seconds
  price: number;
}

type RangeKey = '1M' | '3M' | '6M' | 'YTD';

// Finnhub's free tier has uncertain access to daily candles at longer
// lookbacks (see MarketOverview.tsx) — 1Y/5Y/ALL are deliberately left out
// for now rather than shipping range buttons that may reliably 403. If
// Doug's plan turns out to support longer history, add entries here with
// their `days` (or a fixed `from` for YTD-style ranges) and the existing
// per-range error handling will just work for them too.
const RANGES: { key: RangeKey; label: string; days: number | 'ytd' }[] = [
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: '6M', label: '6M', days: 180 },
  { key: 'YTD', label: 'YTD', days: 'ytd' },
];

function rangeToFromTo(days: number | 'ytd'): { from: number; to: number } {
  const to = Math.floor(Date.now() / 1000);
  if (days === 'ytd') {
    const jan1 = new Date(new Date().getFullYear(), 0, 1);
    return { from: Math.floor(jan1.getTime() / 1000), to };
  }
  return { from: to - days * 24 * 60 * 60, to };
}

// Custom tooltip: crosshair-style readout per the dataviz interaction spec —
// value leads (Strong/high-contrast), date is secondary, single series so no
// legend needed.
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const point: CandlePoint = payload[0].payload;
  const date = new Date(point.t * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg px-3 py-2">
      <div className="text-sm font-bold text-gray-900 dark:text-white">${point.price.toFixed(2)}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{date}</div>
    </div>
  );
}

export default function StockDetailModal({ symbol, onClose }: StockDetailModalProps) {
  const [range, setRange] = useState<RangeKey>('1M');
  const [points, setPoints] = useState<CandlePoint[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'unavailable' | 'error'>('loading');
  const [quote, setQuote] = useState<{ price: number; change: number; percentChange: number } | null>(null);
  // Recharts marks are plain SVG attributes, not classNames, so the active
  // dot's surface-color ring (dataviz "surface ring" spec) can't be styled
  // via Tailwind's dark: variant — same constraint Weather.tsx hit for its
  // radar map tiles, solved there the same way.
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const API_KEY = process.env.REACT_APP_FINNHUB_API_KEY;

  // Live quote header, independent of the historical range — matches the
  // price/change readout already used in Watchlist/MarketOverview.
  useEffect(() => {
    if (!API_KEY) return;
    let cancelled = false;
    fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data && data.c !== 0) {
          setQuote({ price: data.c, change: data.d, percentChange: data.dp });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [symbol, API_KEY]);

  useEffect(() => {
    if (!API_KEY) { setStatus('unavailable'); return; }
    let cancelled = false;
    setStatus('loading');

    const rangeDef = RANGES.find((r) => r.key === range)!;
    const { from, to } = rangeToFromTo(rangeDef.days);

    fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${API_KEY}`)
      .then((r) => {
        // Finnhub returns 403 on this endpoint for some free-tier accounts —
        // treat that (and any non-ok status) as "unavailable" rather than a
        // hard error, since it's a plan limitation, not a bug.
        if (!r.ok) throw new Error(r.status === 403 ? 'unavailable' : 'failed');
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data?.s !== 'ok' || !Array.isArray(data.c) || data.c.length === 0) {
          setStatus('unavailable');
          setPoints(null);
          return;
        }
        const parsed: CandlePoint[] = data.c.map((price: number, i: number) => ({
          t: data.t[i],
          price,
        }));
        setPoints(parsed);
        setStatus('ok');
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus(err.message === 'unavailable' ? 'unavailable' : 'error');
        setPoints(null);
      });

    return () => { cancelled = true; };
  }, [symbol, range, API_KEY]);

  const isUp = useMemo(() => {
    if (!points || points.length < 2) return quote ? quote.change >= 0 : true;
    return points[points.length - 1].price >= points[0].price;
  }, [points, quote]);

  // Matches MarketOverview.tsx's sparkline and Watchlist's text colors
  // (Tailwind green-600/red-600) rather than the Okabe-Ito palette, so this
  // chart's up/down coloring is visually consistent with the rest of the
  // stocks section instead of introducing a third color pairing for the
  // same concept.
  const lineColor = isUp ? '#16a34a' : '#dc2626';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${symbol} price chart`}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-gray-100 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{symbol}</h2>
            {quote && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-semibold text-gray-900 dark:text-white">${quote.price.toFixed(2)}</span>
                <span className={`flex items-center gap-0.5 text-sm font-semibold ${quote.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {quote.change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {quote.change >= 0 ? '+' : ''}{quote.change.toFixed(2)} ({quote.change >= 0 ? '+' : ''}{quote.percentChange.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-4">
          {/* Range presets — ordinary buttons above the chart, per dataviz
              interaction rules, not chart marks themselves. */}
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  range === r.key
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 pb-5 pt-3">
          {status === 'loading' && (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          )}

          {status === 'unavailable' && (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500 text-center px-4">
              <AlertCircle size={20} />
              <p className="text-sm">
                Historical chart data isn't available on the current Finnhub plan.
                <br />
                Live price above still updates normally.
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-red-500 text-center px-4">
              <AlertCircle size={20} />
              <p className="text-sm">Couldn't load chart data — try again shortly.</p>
            </div>
          )}

          {status === 'ok' && points && (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="stockFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={lineColor} stopOpacity={0.1} />
                      <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke="currentColor" className="text-gray-100 dark:text-slate-700" />
                  <XAxis
                    dataKey="t"
                    tickFormatter={(t) => new Date(t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    tick={{ fontSize: 11, fill: 'currentColor' }}
                    className="text-gray-400 dark:text-gray-500"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={40}
                  />
                  <YAxis
                    domain={['dataMin', 'dataMax']}
                    tick={{ fontSize: 11, fill: 'currentColor' }}
                    className="text-gray-400 dark:text-gray-500"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v.toFixed(0)}`}
                    width={44}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: '3 3' }} />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={lineColor}
                    strokeWidth={2}
                    fill="url(#stockFill)"
                    dot={false}
                    activeDot={{ r: 4, fill: lineColor, stroke: isDark ? '#1e293b' : '#ffffff', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
