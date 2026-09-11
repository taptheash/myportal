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

type RangeKey = '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y' | 'ALL';

// The full standard set. Historical data comes from the /api/stock-chart
// serverless function (portal/api/stock-chart.js), which proxies Yahoo
// Finance server-side — Yahoo's chart endpoint sends no CORS headers, so a
// direct browser fetch() is blocked (confirmed by testing against the
// deployed portal directly), and separately, Finnhub's free tier 403s on
// its own candle endpoint for longer lookbacks (see MarketOverview.tsx).
// The proxy's RANGE_MAP must have a matching entry for every key here.
const RANGES: { key: RangeKey; label: string }[] = [
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '6M', label: '6M' },
  { key: 'YTD', label: 'YTD' },
  { key: '1Y', label: '1Y' },
  { key: '5Y', label: '5Y' },
  { key: 'ALL', label: 'ALL' },
];

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
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg px-3 py-2">
      <div className="text-sm font-bold text-zinc-900 dark:text-white">${point.price.toFixed(2)}</div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{date}</div>
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

  // Live quote header, fetched once per symbol (not re-fetched on every
  // range click — clicking through 1M/3M/6M/etc. shouldn't refire this).
  // Sourced from the same /api/stock-chart Yahoo proxy as the historical
  // points below, rather than a separate Finnhub call: Finnhub's quote
  // endpoint doesn't recognize Yahoo-style index tickers like ^GSPC (used
  // by Market Overview), so a single proxy is what makes this modal work
  // correctly for both ordinary stock symbols and index symbols.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stock-chart?symbol=${encodeURIComponent(symbol)}&range=1M`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.price === 'number' && typeof data.change === 'number') {
          setQuote({ price: data.price, change: data.change, percentChange: data.percentChange ?? 0 });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [symbol]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    fetch(`/api/stock-chart?symbol=${encodeURIComponent(symbol)}&range=${range}`)
      .then(async (r) => {
        // The proxy returns 404 specifically for "symbol not found" (a real,
        // user-facing distinction — e.g. a delisted ticker), and 500/502 for
        // everything else (Yahoo outage, unexpected response shape). Surface
        // that as 'unavailable' vs 'error' rather than collapsing both into
        // one generic message.
        if (!r.ok) throw new Error(r.status === 404 ? 'unavailable' : 'error');
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data.points) || data.points.length === 0) {
          setStatus('unavailable');
          setPoints(null);
          return;
        }
        setPoints(data.points);
        setStatus('ok');
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus(err.message === 'unavailable' ? 'unavailable' : 'error');
        setPoints(null);
      });

    return () => { cancelled = true; };
  }, [symbol, range]);

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

  // Inline expanding panel — opens directly beneath the row that was
  // clicked (rendered there by the parent list) rather than as a centered
  // page overlay, so it reads as "this row, expanded" instead of a floating
  // dialog that happens to sit near the cursor.
  return (
    <div
      className="folder-content-enter surface-card bg-white dark:bg-zinc-900 rounded-xl overflow-hidden"
      role="region"
      aria-label={`${symbol} price chart`}
    >
      <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{symbol}</h2>
            {quote && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-semibold text-zinc-900 dark:text-white">${quote.price.toFixed(2)}</span>
                <span className={`flex items-center gap-0.5 text-sm font-semibold ${quote.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {quote.change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {quote.change >= 0 ? '+' : ''}{quote.change.toFixed(2)} ({quote.change >= 0 ? '+' : ''}{quote.percentChange.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150"
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150 ${
                  range === r.key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
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
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
            </div>
          )}

          {status === 'unavailable' && (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-zinc-400 dark:text-zinc-500 text-center px-4">
              <AlertCircle size={20} />
              <p className="text-sm">
                No historical data found for {symbol} over this range.
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
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" />
                  <XAxis
                    dataKey="t"
                    tickFormatter={(t) => new Date(t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    tick={{ fontSize: 11, fill: 'currentColor' }}
                    className="text-zinc-400 dark:text-zinc-500"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={40}
                  />
                  <YAxis
                    domain={['dataMin', 'dataMax']}
                    tick={{ fontSize: 11, fill: 'currentColor' }}
                    className="text-zinc-400 dark:text-zinc-500"
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
                    activeDot={{ r: 4, fill: lineColor, stroke: isDark ? '#18181b' : '#ffffff', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
  );
}

