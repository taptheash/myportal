import { useState, useCallback, useRef } from 'react';

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

  return [storedValue, setValue] as const;
}
