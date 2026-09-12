import React, { useState, useEffect } from 'react';
import { Sun, Cloud, CloudRain, Wind, AlertCircle, Loader2 } from 'lucide-react';
import { getWidgetConfig } from '../../lib/portalStorage';

// Home's restrained weather summary — current temp + condition + one-line
// high/low, nothing else. Reads the SAME `location` the Tools > Weather tab
// already has saved (via the shared `pw6` config under the 'weather' type),
// so setting a location once applies everywhere; it does not duplicate
// Weather.tsx's radar/hourly/5-day UI, only the current-conditions call.

interface CompactData {
  temp: number;
  high: number;
  low: number;
  main: string;
  locationName: string;
}

function iconFor(main: string) {
  const m = main.toLowerCase();
  if (m.includes('rain') || m.includes('drizzle') || m.includes('thunder')) return CloudRain;
  if (m.includes('cloud')) return Cloud;
  if (m.includes('wind')) return Wind;
  return Sun;
}

async function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Geolocation not supported')); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
  });
}

export default function CompactWeather() {
  const [data, setData] = useState<CompactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const API_KEY = process.env.REACT_APP_WEATHER_API_KEY;
    if (!API_KEY) { setLoading(false); setError('Weather not configured'); return; }

    const location: string | undefined = getWidgetConfig('weather')?.location;

    const run = async () => {
      try {
        setLoading(true);
        let query: string;
        if (location) {
          const isZip = /^\d{5}$/.test(location.trim());
          query = `q=${encodeURIComponent(isZip ? `${location.trim()},US` : location.trim())}`;
        } else {
          try {
            const pos = await getCurrentPosition();
            query = `lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`;
          } catch {
            query = `q=${encodeURIComponent('New Hampshire,US')}`;
          }
        }
        const [curRes, foreRes] = await Promise.all([
          fetch(`https://api.openweathermap.org/data/2.5/weather?${query}&appid=${API_KEY}&units=imperial`),
          fetch(`https://api.openweathermap.org/data/2.5/forecast?${query}&appid=${API_KEY}&units=imperial`),
        ]);
        if (!curRes.ok) throw new Error('Location not found');
        const cur = await curRes.json();

        let high = Math.round(cur.main.temp_max);
        let low = Math.round(cur.main.temp_min);
        if (foreRes.ok) {
          const fore = await foreRes.json();
          const todayEntries = (fore.list || []).slice(0, 8); // ~next 24h in 3h steps
          if (todayEntries.length) {
            high = Math.round(Math.max(...todayEntries.map((e: any) => e.main.temp_max)));
            low = Math.round(Math.min(...todayEntries.map((e: any) => e.main.temp_min)));
          }
        }

        setData({
          temp: Math.round(cur.main.temp),
          high,
          low,
          main: cur.weather?.[0]?.main || 'Clear',
          locationName: cur.name,
        });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load weather');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 size={16} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-zinc-400 dark:text-zinc-500">
        <AlertCircle size={13} /> {error || 'Weather unavailable'}
      </div>
    );
  }

  const Icon = iconFor(data.main);

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Icon size={26} className="text-amber-500 flex-shrink-0" />
        <div className="leading-tight">
          <div className="text-2xl font-semibold text-zinc-900 dark:text-white tabular-nums">{data.temp}°</div>
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate max-w-[140px]">{data.locationName}</div>
        </div>
      </div>
      <div className="text-right text-xs text-zinc-500 dark:text-zinc-400 leading-tight">
        <div>H {data.high}°</div>
        <div>L {data.low}°</div>
      </div>
    </div>
  );
}
