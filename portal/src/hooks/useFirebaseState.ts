import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebaseClient';

// Drop-in replacement for useLocalStorage with the exact same call shape
// (`const [value, setValue] = useFirebaseState(key, initialValue)` — a
// caller destructuring only the first two elements doesn't need to change
// at all), backed by Firestore instead of localStorage. Each key becomes
// one document at users/{uid}/appState/{key}.
//
// One-time migration, per key, the first time it's ever read after this
// hook goes live: if Firestore has no document for this key yet, seed from
// whatever's already sitting in localStorage under the same key (or the
// caller's initialValue if there's nothing there), write that up to
// Firestore immediately, and remove the local copy — so from that point on
// this key's data lives ONLY in Firestore, never duplicated locally.
//
// Saves are debounced (500ms), same pattern Notes/Tasks/etc. already use
// for their own localStorage writes, so typing doesn't hit the network on
// every keystroke.

export interface FirebaseStateMeta {
  loading: boolean;
  error: string | null;
}

const SAVE_DEBOUNCE_MS = 500;

function stateDocRef(uid: string, key: string) {
  return doc(db, 'users', uid, 'appState', key);
}

// Firestore rejects `undefined` field values outright (unlike a JSON
// column), and JS objects with optional properties (e.g. a task's
// `dueDate?: string`) can genuinely hold `undefined` rather than just
// omitting the key. Round-tripping through JSON — the same serialization
// localStorage already forced on every one of these values — drops any
// `undefined` property the same way `JSON.stringify` always has, so this
// stays behaviorally identical to what these components already do.
function toFirestoreSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function useFirebaseState<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, FirebaseStateMeta] {
  const [value, setValueState] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueRef = useRef<T>(initialValue);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const user = auth.currentUser;
        if (!user) {
          if (!cancelled) setLoading(false);
          return;
        }

        const ref = stateDocRef(user.uid, key);
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : undefined;

        if (data) {
          if (!cancelled) setValueState(data.value as T);
        } else {
          // Never seen this key before for this user — seed from the
          // pre-Firebase localStorage value (the desktop/mobile app's
          // existing data) if present, otherwise the caller's default.
          let seed = initialValue;
          try {
            const local = window.localStorage.getItem(key);
            if (local !== null) seed = JSON.parse(local);
          } catch {
            // malformed local value — fall back to initialValue
          }

          if (!cancelled) setValueState(seed);

          await setDoc(ref, { value: toFirestoreSafe(seed), updatedAt: serverTimestamp() });

          try {
            window.localStorage.removeItem(key);
          } catch {
            // not fatal — worst case the stale local copy just sits unused
          }
        }

        if (!cancelled) setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = next instanceof Function ? next(valueRef.current) : next;
      valueRef.current = resolved;
      setValueState(resolved);

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          const user = auth.currentUser;
          if (!user) return;
          await setDoc(stateDocRef(user.uid, key), {
            value: toFirestoreSafe(resolved),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`Failed to save "${key}" to Firestore:`, err);
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [key]
  );

  return [value, setValue, { loading, error }];
}
