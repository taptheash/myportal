import React, { useState, useEffect } from 'react';
import { Cloud, CloudRain, Sun, Wind, Droplets, AlertCircle } from 'lucide-react';

interface WeatherProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface WeatherData {
  main: { temp: number; feels_like: number; humidity: number; };
  weather: Array<{ main: string; description: string; }>;
  wind: { speed: number; };
  name: string;
}

export default function Weather({ config, onUpdateConfig }: WeatherProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
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
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${query}&appid=${API_KEY}&units=imperial`
        );
        if (!response.ok) throw new Error('Location not found');
        const data = await response.json();
        setWeather(data);
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

  const getWeatherIcon = (main: string) => {
    switch (main.toLowerCase()) {
      case 'rain':
      case 'drizzle': return <CloudRain className="w-12 h-12 text-blue-500" />;
      case 'clear': return <Sun className="w-12 h-12 text-yellow-500" />;
      default: return <Cloud className="w-12 h-12 text-gray-400" />;
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
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-4xl font-bold text-gray-900 dark:text-white">{Math.round(weather.main.temp)}°F</div>
              <div className="text-lg font-semibold text-gray-700 dark:text-gray-300 capitalize">{weather.weather[0].description}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Feels like {Math.round(weather.main.feels_like)}°F</div>
            </div>
            <div>{getWeatherIcon(weather.weather[0].main)}</div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-sm flex-shrink-0">
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
        </div>
      )}
    </div>
  );
}
