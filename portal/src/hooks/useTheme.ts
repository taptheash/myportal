import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('portal-theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'system';
  });

  const [osIsDark, setOsIsDark] = useState(systemPrefersDark);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setOsIsDark(e.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const resolvedTheme: 'light' | 'dark' = mode === 'system' ? (osIsDark ? 'dark' : 'light') : mode;

  useEffect(() => {
    localStorage.setItem('portal-theme', mode);
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [mode, resolvedTheme]);

  const setMode = useCallback((next: ThemeMode) => setModeState(next), []);

  return { mode, resolvedTheme, setMode };
}
