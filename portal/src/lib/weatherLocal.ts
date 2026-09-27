import { useEffect, useState } from 'react';

// Per-device weather state that must NOT live in the synced pw6 config:
// - the name of the place this browser's location resolved to (the laptop
//   at work and the PC at home are in different towns), and
// - the "re-locate now" signal from the crosshair button (pressing it on
//   one device shouldn't make every other device ask for its location).
// Typed-in locations and the recent-locations list stay in the synced
// config on purpose.

const KEY = 'weather-resolved-name';
const EVENT = 'weather-local';

export function getResolvedName(): string {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}

export function setResolvedName(name: string) {
  try {
    if (getResolvedName() === name) return;
    if (name) localStorage.setItem(KEY, name); else localStorage.removeItem(KEY);
  } catch { /* not fatal */ }
  window.dispatchEvent(new Event(EVENT));
}

export function useResolvedName(): string {
  const [name, setName] = useState(getResolvedName);
  useEffect(() => {
    const on = () => setName(getResolvedName());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return name;
}

export function requestRelocate() {
  setResolvedName('');
  window.dispatchEvent(new Event('weather-relocate'));
}
