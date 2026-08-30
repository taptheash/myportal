import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Cloud, CloudRain, Sun, Wind, Droplets, AlertCircle, ExternalLink, ChevronDown, ChevronUp, X } from 'lucide-react';

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
  coord: { lat: number; lon: number };
}

interface ForecastListEntry {
  dt: number;
  main: { temp: number; temp_min: number; temp_max: number };
  weather: Array<{ main: string; description: string }>;
}

interface ForecastResponse {
  list: ForecastListEntry[];
  city: { timezone: number };
}

interface DailyForecast {
  dateKey: string;
  label: string;
  high: number;
  low: number;
  main: string;
  hourly: ForecastListEntry[]; // raw 3-hour-interval entries for this day
}

interface RadarFrame {
  host: string;
  path: string;
}

const US_STATE_ABBREV: Record<string, string> = {
  alabama: 'al', alaska: 'ak', arizona: 'az', arkansas: 'ar', california: 'ca',
  colorado: 'co', connecticut: 'ct', delaware: 'de', florida: 'fl', georgia: 'ga',
  hawaii: 'hi', idaho: 'id', illinois: 'il', indiana: 'in', iowa: 'ia',
  kansas: 'ks', kentucky: 'ky', louisiana: 'la', maine: 'me', maryland: 'md',
  massachusetts: 'ma', michigan: 'mi', minnesota: 'mn', mississippi: 'ms', missouri: 'mo',
  montana: 'mt', nebraska: 'ne', nevada: 'nv', 'new hampshire': 'nh', 'new jersey': 'nj',
  'new mexico': 'nm', 'new york': 'ny', 'north carolina': 'nc', 'north dakota': 'nd', ohio: 'oh',
  oklahoma: 'ok', oregon: 'or', pennsylvania: 'pa', 'rhode island': 'ri', 'south carolina': 'sc',
  'south dakota': 'sd', tennessee: 'tn', texas: 'tx', utah: 'ut', vermont: 'vt',
  virginia: 'va', washington: 'wa', 'west virginia': 'wv', wisconsin: 'wi', wyoming: 'wy',
  'district of columbia': 'dc',
};

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// OpenWeatherMap's free-tier forecast endpoint returns 3-hour increments
// across ~5 days, not one entry per day — this groups those into daily
// high/low/condition summaries (for the 5-day row) while KEEPING the raw
// 3-hour entries per day too, for the click-to-expand breakdown. Uses the
// CITY's own timezone offset so day/time boundaries are correct for the
// queried location, not the browser's.
function aggregateForecast(data: ForecastResponse): { days: DailyForecast[]; tzOffsetMs: number } {
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

  const days = dateKeys.map((dateKey) => {
    const entries = groups.get(dateKey)!;
    const high = Math.round(Math.max(...entries.map((e) => e.main.temp_max)));
    const low = Math.round(Math.min(...entries.map((e) => e.main.temp_min)));

    const midday = entries.reduce((best, e) => {
      const hour = new Date(e.dt * 1000 + tzOffsetMs).getUTCHours();
      const bestHour = new Date(best.dt * 1000 + tzOffsetMs).getUTCHours();
      return Math.abs(hour - 12) < Math.abs(bestHour - 12) ? e : best;
    });

    const label =
      dateKey === todayKey
        ? 'Today'
        : new Date(`${dateKey}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short' });

    return { dateKey, label, high, low, main: midday.weather[0]?.main || 'Clouds', hourly: entries };
  });

  return { days, tzOffsetMs };
}

// The Date object here has already been shifted by tzOffsetMs, so its UTC
// fields now represent the CITY's local time — formatting must read those
// UTC fields directly (timeZone: 'UTC') rather than the browser's own zone.
function formatLocalTime(unixSeconds: number, tzOffsetMs: number): string {
  return new Date(unixSeconds * 1000 + tzOffsetMs).toLocaleTimeString('en-US', {
    hour: 'numeric',
    hour12: true,
    timeZone: 'UTC',
  });
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
  });
}

export default function Weather({ config, onUpdateConfig }: WeatherProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [forecastTz, setForecastTz] = useState(0);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weatherBugUrl, setWeatherBugUrl] = useState('https://www.weatherbug.com/');

  const [showRadar, setShowRadar] = useState(false);
  const [radarFrame, setRadarFrame] = useState<RadarFrame | null>(null);
  const [radarError, setRadarError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);

  const hasManualLocation = Boolean(config.location);
  const API_KEY = process.env.REACT_APP_WEATHER_API_KEY;

  useEffect(() => {
    if (!API_KEY) { setLoading(false); return; }

    const fetchWeather = async () => {
      try {
        setLoading(true);

        let weatherUrl: string;
        let forecastUrl: string;

        if (hasManualLocation) {
          const isZip = /^\d{5}$/.test(config.location.trim());
          const query = encodeURIComponent(isZip ? `${config.location.trim()},US` : config.location.trim());
          weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${query}&appid=${API_KEY}&units=imperial`;
          forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${query}&appid=${API_KEY}&units=imperial`;
        } else {
          try {
            const pos = await getCurrentPosition();
            const { latitude, longitude } = pos.coords;
            weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=imperial`;
            forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=imperial`;
          } catch {
            weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=New%20Hampshire,US&appid=${API_KEY}&units=imperial`;
            forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=New%20Hampshire,US&appid=${API_KEY}&units=imperial`;
          }
        }

        const [currentRes, forecastRes] = await Promise.all([fetch(weatherUrl), fetch(forecastUrl)]);

        if (!currentRes.ok) throw new Error('Location not found');
        const currentData: WeatherData = await currentRes.json();
        setWeather(currentData);
        onUpdateConfig({ ...config, resolvedLocationName: currentData.name });

        if (forecastRes.ok) {
          const forecastData = await forecastRes.json();
          const { days, tzOffsetMs } = aggregateForecast(forecastData);
          setForecast(days);
          setForecastTz(tzOffsetMs);
        } else {
          setForecast([]);
        }

        try {
          const { lat, lon } = currentData.coord;
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const addr = geoData?.address || {};
            const city = addr.city || addr.town || addr.village || addr.hamlet || currentData.name;
            const stateAbbrev = addr.state ? US_STATE_ABBREV[addr.state.toLowerCase()] : null;
            const zip = addr.postcode;

            if (city && stateAbbrev && zip) {
              setWeatherBugUrl(`https://www.weatherbug.com/weather-forecast/now/${slugify(city)}-${stateAbbrev}-${zip}`);
            } else {
              setWeatherBugUrl('https://www.weatherbug.com/');
            }
          }
        } catch {
          setWeatherBugUrl('https://www.weatherbug.com/');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_KEY, hasManualLocation, config.location]);

  useEffect(() => {
    if (!showRadar) return;
    setIsDark(document.documentElement.classList.contains('dark'));

    const fetchRadar = async () => {
      try {
        const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        const past = data?.radar?.past;
        const latest = past?.[past.length - 1];
        if (!latest) throw new Error('no frames available');
        setRadarFrame({ host: data.host, path: latest.path });
        setRadarError(null);
      } catch {
        setRadarError('Radar unavailable right now');
      }
    };

    fetchRadar();
    const interval = setInterval(fetchRadar, 300000);
    return () => clearInterval(interval);
  }, [showRadar]);

  const getWeatherIcon = (main: string, size: 'lg' | 'sm' = 'lg') => {
    const cls = size === 'lg' ? 'w-12 h-12' : 'w-5 h-5';
    switch (main.toLowerCase()) {
      case 'rain':
      case 'drizzle': return <CloudRain className={`${cls} text-blue-500`} />;
      case 'clear': return <Sun className={`${cls} text-yellow-500`} />;
      default: return <Cloud className={`${cls} text-gray-400`} />;
    }
  };

  const expandedDayData = forecast.find((d) => d.dateKey === expandedDay);

  return (
    <div className="h-full flex flex-col overflow-hidden">
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
            <div className="grid grid-cols-5 gap-1 mb-1 flex-shrink-0">
              {forecast.map((day) => (
                <button
                  key={day.dateKey}
                  onClick={() => setExpandedDay(expandedDay === day.dateKey ? null : day.dateKey)}
                  className={`flex flex-col items-center gap-1 rounded-lg py-2 px-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    expandedDay === day.dateKey
                      ? 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-blue-400'
                      : 'bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600'
                  }`}
                >
                  <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">{day.label}</div>
                  {getWeatherIcon(day.main, 'sm')}
                  <div className="text-xs text-center leading-tight">
                    <div className="font-bold text-gray-900 dark:text-white">{day.high}°</div>
                    <div className="text-gray-400 dark:text-gray-500">{day.low}°</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {expandedDayData && (
            <div className="mb-3 rounded-lg overflow-hidden bg-blue-50 dark:bg-slate-700 flex-shrink-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-blue-100 dark:border-slate-600">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                  {expandedDayData.label} — 3-hour breakdown
                </span>
                <button
                  onClick={() => setExpandedDay(null)}
                  className="p-0.5 rounded hover:bg-blue-100 dark:hover:bg-slate-600 text-gray-500 dark:text-gray-400"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {expandedDayData.hourly.map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs border-b border-blue-100/60 dark:border-slate-600/60 last:border-0"
                  >
                    <span className="w-14 text-gray-500 dark:text-gray-400 flex-shrink-0">
                      {formatLocalTime(entry.dt, forecastTz)}
                    </span>
                    {getWeatherIcon(entry.weather[0]?.main || 'Clouds', 'sm')}
                    <span className="flex-1 truncate capitalize text-gray-700 dark:text-gray-300">
                      {entry.weather[0]?.description || ''}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white flex-shrink-0">
                      {Math.round(entry.main.temp)}°
                    </span>
                  </div>
                ))}
              </div>
              <div className="px-3 py-1.5 text-[10px] text-gray-400 dark:text-gray-500 bg-blue-100/40 dark:bg-slate-800/40">
                3-hour intervals — the free forecast tier doesn't offer true hourly data
              </div>
            </div>
          )}

          <button
            onClick={() => setShowRadar(!showRadar)}
            className="flex items-center justify-between px-3 py-2 mb-3 bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-slate-600 transition text-xs font-semibold flex-shrink-0"
          >
            <span>Radar Map</span>
            {showRadar ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showRadar && (
            <div className="mb-3 rounded-lg overflow-hidden flex-shrink-0" style={{ height: '440px' }}>
              {radarFrame ? (
                <MapContainer
                  key={`${weather.coord.lat}-${weather.coord.lon}`}
                  center={[weather.coord.lat, weather.coord.lon]}
                  zoom={7}
                  maxZoom={14}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    url={isDark
                      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
                    attribution={isDark
                      ? '&copy; OpenStreetMap &copy; CARTO'
                      : '&copy; OpenStreetMap contributors'}
                  />
                  <TileLayer
                    url={`${radarFrame.host}${radarFrame.path}/256/{z}/{x}/{y}/2/1_1.png`}
                    opacity={0.65}
                    maxZoom={14}
                    maxNativeZoom={7}
                  />
                </MapContainer>
              ) : radarError ? (
                <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-slate-700 text-sm text-red-500 text-center px-4">
                  {radarError}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-slate-700">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                </div>
              )}
            </div>
          )}

          <a
            href={weatherBugUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-3 py-2 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/60 transition text-xs font-semibold flex-shrink-0"
          >
            Open WeatherBug <ExternalLink size={12} />
          </a>
        </div>
      )}
    </div>
  );
}
