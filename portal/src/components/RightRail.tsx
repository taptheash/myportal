import React, { useEffect, useState } from 'react';
import { Search as SearchIcon, Loader2, AlertCircle, MoreHorizontal } from 'lucide-react';
import { weatherIcon, FALLBACK_LOCATION } from '../lib/weatherIcons';
import { getWidgetConfig } from '../lib/portalStorage';
import { calendarFetch, CalendarLockedError } from '../lib/calendarApi';
import { parseGCalTime, isAllDay } from '../lib/calendarTime';
import { CalendarEvent } from './home/TodayAgenda';
import Scratchpad from './widgets/Scratchpad';

// The column of always-on widgets down the right side of the desktop layout:
// search, a 5-day weather card, the next few calendar events, and Quick
// Notes (the same scratchpad Home uses). Shown on every section.

function RailCard({ title, onMore, children }: { title: React.ReactNode; onMore?: () => void; children: React.ReactNode }) {
  return (
    <section className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-semibold text-zinc-800 dark:text-zinc-100">{title}</h3>
        {onMore && (
          <button onClick={onMore} title="Open" className="p-1 -m-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100/80 dark:hover:bg-zinc-800">
            <MoreHorizontal size={16} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

const Muted = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 py-2 text-xs text-zinc-400 dark:text-zinc-500">{children}</div>
);

// ---- 5-day weather -----------------------------------------------------
interface Day { label: string; main: string; high: number; low: number }
interface WeatherData { temp: number; main: string; place: string; days: Day[] }

async function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('no geolocation')); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 15000, maximumAge: 5 * 60 * 1000 });
  });
}

// OpenWeatherMap's forecast is in 3-hour steps; fold them into days. The
// day's icon is the condition at (or nearest) midday.
function toDays(list: any[]): Day[] {
  const byDay = new Map<string, any[]>();
  for (const e of list) {
    const d = new Date(e.dt * 1000);
    const key = d.toDateString();
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }
  return Array.from(byDay.values()).slice(0, 5).map((entries) => {
    const d = new Date(entries[0].dt * 1000);
    const noon = entries.reduce((best, e) =>
      Math.abs(new Date(e.dt * 1000).getHours() - 13) < Math.abs(new Date(best.dt * 1000).getHours() - 13) ? e : best);
    return {
      label: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      main: noon.weather?.[0]?.main || 'Clouds',
      high: Math.round(Math.max(...entries.map((e) => e.main.temp_max))),
      low: Math.round(Math.min(...entries.map((e) => e.main.temp_min))),
    };
  });
}

function RailWeather({ onOpen }: { onOpen: () => void }) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        // Same saved location the Weather tab uses, else this device's position.
        const location: string | undefined = getWidgetConfig('weather')?.location;
        let query: string;
        if (location) {
          const isZip = /^\d{5}$/.test(location.trim());
          query = `q=${encodeURIComponent(isZip ? `${location.trim()},US` : location.trim())}`;
        } else {
          try {
            const pos = await getPosition();
            query = `lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`;
          } catch {
            query = `lat=${FALLBACK_LOCATION.lat}&lon=${FALLBACK_LOCATION.lon}`;
          }
        }
        const [curRes, foreRes] = await Promise.all([
          fetch(`/api/weather?kind=weather&${query}`),
          fetch(`/api/weather?kind=forecast&${query}`),
        ]);
        if (curRes.status === 503) throw new Error('Weather not configured');
        if (!curRes.ok) throw new Error('Location not found');
        const cur = await curRes.json();
        const fore = foreRes.ok ? await foreRes.json() : { list: [] };
        if (cancelled) return;
        setData({
          temp: Math.round(cur.main.temp),
          main: cur.weather?.[0]?.main || 'Clear',
          place: cur.name,
          days: toDays(fore.list || []),
        });
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Weather unavailable');
      }
    };
    run();
    const timer = setInterval(run, 30 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const title = (
    <span>5-day Weather{data?.place && <span className="font-normal text-zinc-500 dark:text-zinc-400"> ({data.place})</span>}</span>
  );

  if (error) return <RailCard title={title} onMore={onOpen}><Muted><AlertCircle size={13} /> {error}</Muted></RailCard>;
  if (!data) return <RailCard title={title}><Muted><Loader2 size={14} className="animate-spin" /> Loading…</Muted></RailCard>;

  const { Icon, color } = weatherIcon(data.main);
  return (
    <RailCard title={title} onMore={onOpen}>
      <div className="flex items-center justify-between px-2">
        <Icon size={52} className={color} strokeWidth={1.5} />
        <div className="text-[44px] leading-none font-light text-zinc-800 dark:text-zinc-100 tabular-nums">{data.temp}°F</div>
      </div>
      {data.days.length > 0 && (
        <div className="mt-4 grid grid-cols-5 gap-1 text-center">
          {data.days.map((d, i) => {
            const di = weatherIcon(d.main);
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">{i === 0 ? 'TODAY' : d.label}</span>
                <di.Icon size={20} className={di.color} />
                <span className="text-[11px] text-zinc-700 dark:text-zinc-200 tabular-nums">{d.high}°</span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 tabular-nums -mt-1">{d.low}°</span>
              </div>
            );
          })}
        </div>
      )}
    </RailCard>
  );
}

// ---- Upcoming appointments ----------------------------------------------
function dayLabel(d: Date): string {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function RailAgenda({ onOpen }: { onOpen: () => void }) {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await calendarFetch('/api/calendar/events');
        if (!res.ok) throw new Error('Calendar unavailable');
        const data = await res.json();
        const now = new Date();
        const upcoming = (data.events || []).filter((e: CalendarEvent) => {
          const end = parseGCalTime(e.end) || parseGCalTime(e.start);
          return end ? end > now : false;
        }).slice(0, 5);
        if (!cancelled) { setEvents(upcoming); setError(null); }
      } catch (err) {
        if (!cancelled) setError(err instanceof CalendarLockedError ? 'Calendar locked — unlock it once in Tools › Calendar' : 'Calendar unavailable');
      }
    };
    run();
    const timer = setInterval(run, 15 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  return (
    <RailCard title="Upcoming Appointments" onMore={onOpen}>
      {error ? <Muted><AlertCircle size={13} /> {error}</Muted>
        : !events ? <Muted><Loader2 size={14} className="animate-spin" /> Loading…</Muted>
        : events.length === 0 ? <Muted>Nothing coming up.</Muted>
        : (
          <ul className="flex flex-col">
            {events.map((e) => {
              const start = parseGCalTime(e.start);
              const allDay = isAllDay(e.start);
              const row = (
                <div className="flex gap-3 py-1.5 px-1.5 -mx-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-zinc-800/60">
                  <div className="w-[68px] flex-shrink-0 border-r-2 border-indigo-200 dark:border-indigo-800 pr-2 leading-tight">
                    <div className="text-[12px] font-semibold text-zinc-700 dark:text-zinc-200 tabular-nums">
                      {allDay ? 'All day' : start?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </div>
                    <div className="text-[11px] text-zinc-400 dark:text-zinc-500">{start ? dayLabel(start) : ''}</div>
                  </div>
                  <div className="min-w-0 text-[13px] text-zinc-800 dark:text-zinc-100 leading-snug line-clamp-2">{e.summary}</div>
                </div>
              );
              return (
                <li key={e.id}>
                  {e.htmlLink ? <a href={e.htmlLink} target="_blank" rel="noopener noreferrer">{row}</a> : row}
                </li>
              );
            })}
          </ul>
        )}
    </RailCard>
  );
}

export default function RightRail({ onSearch, onOpenWeather, onOpenCalendar }: {
  onSearch: () => void;
  onOpenWeather: () => void;
  onOpenCalendar: () => void;
}) {
  return (
    <aside className="w-[340px] flex-shrink-0 flex flex-col gap-4">
      <button
        onClick={onSearch}
        className="glass-card flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[13px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 text-left"
        title="Search everything (Ctrl+K)"
      >
        <SearchIcon size={15} />
        <span className="flex-1">Search…</span>
        <kbd className="text-[10px] font-medium bg-white/80 dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">Ctrl K</kbd>
      </button>
      <RailWeather onOpen={onOpenWeather} />
      <RailAgenda onOpen={onOpenCalendar} />
      <RailCard title="Quick Notes">
        <Scratchpad />
      </RailCard>
    </aside>
  );
}
