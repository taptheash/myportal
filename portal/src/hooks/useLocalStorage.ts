import { useState, useCallback, useRef, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading from localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Mirrors the latest value synchronously. Functional updates resolve
  // against THIS, not the `storedValue` captured when the setter was made —
  // the old version called value(storedValue) on the closure copy, so a
  // callback created in an earlier render (e.g. a widget's hourly
  // setInterval) could write back a stale snapshot and silently undo
  // whatever was saved since. The write to localStorage also stays
  // synchronous, so a save fired from a 'pagehide' handler still lands.
  const valueRef = useRef<T>(storedValue);

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      const valueToStore = value instanceof Function ? value(valueRef.current) : value;
      valueRef.current = valueToStore;
      setStoredValue(valueToStore);
      try {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.error(`Error writing to localStorage key "${key}":`, error);
      }
    },
    [key]
  );

  // Re-read when this key is changed from outside this hook: cloud sync
  // applying an edit from another device ('portal-local-sync'), or another
  // tab of the portal writing it (the native 'storage' event).
  useEffect(() => {
    const reread = () => {
      try {
        const item = window.localStorage.getItem(key);
        const next = item ? JSON.parse(item) : initialValue;
        valueRef.current = next;
        setStoredValue(next);
      } catch {
        // malformed value — keep what we have
      }
    };
    const onSync = (e: Event) => {
      if ((e as CustomEvent).detail?.key === key) reread();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) reread();
    };
    window.addEventListener('portal-local-sync', onSync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('portal-local-sync', onSync);
      window.removeEventListener('storage', onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [storedValue, setValue] as const;
}
