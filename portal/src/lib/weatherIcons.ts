import { Sun, Cloud, CloudRain, CloudDrizzle, CloudLightning, Snowflake, CloudFog, Wind } from 'lucide-react';

// Maps OpenWeatherMap's `weather[0].main` group to an icon and color.
// Before this, snow, thunderstorms and fog all fell through to a plain grey
// cloud, which for a New Hampshire winter hid the one thing you wanted to see.
// Groups: https://openweathermap.org/weather-conditions
export function weatherIcon(main: string | undefined): { Icon: typeof Sun; color: string } {
  switch ((main || '').toLowerCase()) {
    case 'clear':        return { Icon: Sun, color: 'text-yellow-500' };
    case 'clouds':       return { Icon: Cloud, color: 'text-zinc-400' };
    case 'drizzle':      return { Icon: CloudDrizzle, color: 'text-blue-400' };
    case 'rain':         return { Icon: CloudRain, color: 'text-blue-500' };
    case 'thunderstorm': return { Icon: CloudLightning, color: 'text-violet-500' };
    case 'snow':         return { Icon: Snowflake, color: 'text-sky-400' };
    case 'mist':
    case 'fog':
    case 'haze':
    case 'smoke':
    case 'dust':
    case 'sand':
    case 'ash':          return { Icon: CloudFog, color: 'text-zinc-400' };
    case 'squall':
    case 'tornado':      return { Icon: Wind, color: 'text-zinc-500' };
    default:             return { Icon: Cloud, color: 'text-zinc-400' };
  }
}

// Used when the browser can't provide a location: Boscawen, NH. The old
// fallback, q=New Hampshire, let OpenWeatherMap pick whatever it matched for
// that name, which was not necessarily anywhere near home.
export const FALLBACK_LOCATION = { lat: 43.3151, lon: -71.6206, name: 'Boscawen, NH' };
