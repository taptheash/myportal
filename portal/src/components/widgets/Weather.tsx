import React, { useState, useEffect } from 'react';
import { Cloud, CloudRain, Sun, Wind, Droplets, AlertCircle, ExternalLink } from 'lucide-react';

interface WeatherProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface WeatherData {
  main: { temp: number; feels_like: number; humidity: number };
  weather: Array<{ main: string; description: string }>;
  wind: { speed: number };
  name: string;
}

interface ForecastListEntry {
  dt: number;
  main: { temp_min: number; temp_max: number };
  weather: Array<{ main: string; description: string }>;
}

interface ForecastResponse {
  list: ForecastListEntry[];
  city: { timezone: number }; // seconds offset from UTC, for the queried location
}

interface DailyForecast {
  label: string; // "Today" or short weekday
  high: number;
  low: number;
  main: string; // weather condition, for icon selection
}

// OpenWeatherMap's free-tier forecast endpoint returns 3-hour increments
// across ~5 days, not one entry per day — this groups those into daily
// high/low/condition summaries, using the CITY's own timezone offset so day
// boundaries are correct for the queried location, not the browser's.
function aggregateForecast(data: ForecastResponse): DailyForecast[] {
  const tzOffsetMs = data.city.timezone * 1000;
  const localDateKey = (unixSeconds: number) =>
    new Date(unixSeconds * 1000 + tzOffsetMs).toISOString().split('T')[0];

  const groups = new Map<string, ForecastListEntry[]>();
  data.list.forEach((entry) => {
    const key = localDateKey(entry.dt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  });

  const todayKey = localDateKey(Math.floor(Date.now() / 1000));
  const dateKeys = Array.from(groups.keys()).slice(0, 5);

  return dateKeys.map((dateKey) => {
    const entries = groups.get(dateKey)!;
    const high = Math.round(Math.max(...entries.map((e) => e.main.temp_max)));
    const low = Math.round(Math.min(...entries.map((e) => e.main.temp_min)));

    // Use the entry closest to local midday as representative for the icon —
    // more meaningful than an overnight reading for "what will the day look like."
    const midday = entries.reduce((best, e) => {
      const hour = new Date(e.dt * 1000 + tzOffsetMs).getUTCHours();
      const bestHour = new Date(best.dt * 1000 + tzOffsetMs).getUTCHours();
      return Math.abs(hour - 12) < Math.abs(bestHour - 12) ? e : best;
    });

    const label =
      dateKey === todayKey
        ? 'Today'
        : new Date(`${dateKey}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short' });

    return { label, high, low, main: midday.weather[0]?.main || 'Clouds' };
  });
}

export default function Weather({ config }: WeatherProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const location = config.location || 'New Hampshire';
  const API_KEY = process.env.REACT_APP_WEATHER_API_KEY;

  useEffect(() => {
    if (!API_KEY) { setLoading(false); return; }

    const fetchWeather = async () => {
      try {
        setLoading(true);
        // If input looks like a US zip code, append ,US for accuracy
        const isZip = /^\d{5}$/.test(location.trim());
        const query = encodeURIComponent(isZip ? `${location.trim()},US` : location.trim());

        const [currentRes, forecastRes] = await Promise.all([
          fetch(`https://api.openweathermap.org/data/2.5/weather?q=${query}&appid=${API_KEY}&units=imperial`),
          fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${query}&appid=${API_KEY}&units=imperial`),
        ]);

        if (!currentRes.ok) throw new Error('Location not found');
        const currentData = await currentRes.json();
        setWeather(currentData);

        // Forecast failing shouldn't take down current conditions — degrade gracefully.
        if (forecastRes.ok) {
          const forecastData = await forecastRes.json();
          setForecast(aggregateForecast(forecastData));
        } else {
          setForecast([]);
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching weather');
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 600000);
    return () => clearInterval(interval);
  }, [API_KEY, location]);

  const getWeatherIcon = (main: string, size: 'lg' | 'sm' = 'lg') => {
    const cls = size === 'lg' ? 'w-12 h-12' : 'w-5 h-5';
    switch (main.toLowerCase()) {
      case 'rain':
      case 'drizzle': return <CloudRain className={`${cls} text-blue-500`} />;
      case 'clear': return <Sun className={`${cls} text-yellow-500`} />;
      default: return <Cloud className={`${cls} text-gray-400`} />;
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Weather content */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
        </div>
      )}

      {error && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-red-500">
          <AlertCircle size={24} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {weather && !loading && !error && (
        <div className="flex-1 flex flex-col justify-between min-h-0 overflow-hidden">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-semibold">📍 {weather.name}</div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">{Math.round(weather.main.temp)}°F</div>
                <div className="text-lg font-semibold text-gray-700 dark:text-gray-300 capitalize">{weather.weather[0].description}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Feels like {Math.round(weather.main.feels_like)}°F</div>
              </div>
              <div>{getWeatherIcon(weather.weather[0].main)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-sm flex-shrink-0 mb-3">
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-slate-700 p-2 rounded-lg">
              <Droplets size={16} className="text-blue-500" />
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Humidity</div>
                <div className="font-semibold text-gray-900 dark:text-white">{weather.main.humidity}%</div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-cyan-50 dark:bg-slate-700 p-2 rounded-lg">
              <Wind size={16} className="text-cyan-500" />
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Wind</div>
                <div className="font-semibold text-gray-900 dark:text-white">{Math.round(weather.wind.speed)} mph</div>
              </div>
            </div>
          </div>

          {forecast.length > 0 && (
            <div className="grid grid-cols-5 gap-1 mb-3 flex-shrink-0">
              {forecast.map((day) => (
                <div
                  key={day.label}
                  className="flex flex-col items-center gap-1 bg-gray-50 dark:bg-slate-700 rounded-lg py-2 px-1"
                >
                  <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">{day.label}</div>
                  {getWeatherIcon(day.main, 'sm')}
                  <div className="text-xs text-center leading-tight">
                    <div className="font-bold text-gray-900 dark:text-white">{day.high}°</div>
                    <div className="text-gray-400 dark:text-gray-500">{day.low}°</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <a
            href="https://www.weatherbug.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-3 py-2 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/60 transition text-xs font-semibold"
          >
            Open WeatherBug <ExternalLink size={12} />
          </a>
        </div>
      )}
    </div>
  );
}
