// Cloud sync: mirrors a fixed set of localStorage keys to Firestore under
// users/{uid}/appState/{key} while signed in.
//
// localStorage stays the source of truth the app reads and writes. This
// module only copies changes up and down, so every widget keeps working
// unchanged, and signing out (or Firebase being down) just stops syncing.
//
// - Local -> cloud: every 2s (and when the tab is hidden or closed), any
//   synced key whose value changed since the last sync is uploaded.
// - Cloud -> local: a live Firestore listener applies changes from other
//   devices immediately. It fires a 'portal-local-sync' event so the
//   useLocalStorage hooks, and App via 'pw6-sync', re-read the new value.
// - Conflicts: if this browser has an unsynced edit to a key, the local
//   edit wins and is uploaded. For a single user that's the least
//   surprising rule.
// - First sign-in on a browser whose data differs from the cloud: the
//   cloud copy wins, but this browser's old values are saved first under
//   'pw6-sync-backup' so nothing is ever silently lost.

import type { FirebaseHandles } from './firebaseClient';

export const SYNC_KEYS = [
  'pw6',                 // every widget's config: links, notes, tasks, teams, tickers, feeds...
  'pw6-scratchpad',
  'pw6-hidden-links',
  'pw6-recent-links',
  'pw6-home-enabled',
  'pw6-home-order',
  'pw6-home-layouts',  // Home / Work / Weekend layouts (which one is showing stays per device)
  'pw6-tool-order',
  'pw6-news-order',
  'pw6-sports-order',
  'pw6-stocks-order',
  'pw6-games-order',
];
// Deliberately NOT synced: pw6-active-* (which tab each device is on),
// pw6-game-* (a game in progress stays on the device you're playing on),
// pw6-portal-key (the calendar passcode stays per-browser), and caches.

const STATE_KEY = 'pw6-sync-state';
const BACKUP_KEY = 'pw6-sync-backup';
const MAX_BYTES = 900_000; // Firestore's per-document limit is 1 MiB

export type SyncStatus =
  | { state: 'off' }
  | { state: 'connecting' }
  | { state: 'synced'; at: number }
  | { state: 'syncing' }
  | { state: 'error'; message: string };

type Listener = (s: SyncStatus) => void;
const listeners = new Set<Listener>();
let status: SyncStatus = { state: 'off' };
function setStatus(s: SyncStatus) {
  status = s;
  listeners.forEach((l) => l(s));
}
export function getSyncStatus() {
  return status;
}
export function subscribeSyncStatus(l: Listener) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

// Cheap string hash so the "last synced" marker doesn't store a second full
// copy of pw6 in localStorage.
function hash(s: string | null): string {
  if (s === null) return 'null';
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${h}`;
}

interface PersistedState { uid: string; last: Record<string, string>; }
function readState(): PersistedState | null {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null'); } catch { return null; }
}
function writeState(s: PersistedState) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch { /* not fatal */ }
}
function readLocal(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

let running: { stop: () => void } | null = null;

export function stopCloudSync() {
  running?.stop();
  running = null;
  setStatus({ state: 'off' });
}

export async function startCloudSync(fb: FirebaseHandles, uid: string) {
  stopCloudSync();
  const { db, fsMod } = fb;
  const { collection, doc, getDocs, onSnapshot, setDoc, serverTimestamp } = fsMod;
  const col = collection(db, 'users', uid, 'appState');

  let stopped = false;
  const prior = readState();
  const firstTimeHere = !prior || prior.uid !== uid;
  const last: Record<string, string> = firstTimeHere ? {} : { ...prior!.last };
  const persist = () => writeState({ uid, last });

  const apply = (key: string, value: string | null) => {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch { /* storage full */ }
    last[key] = hash(value);
    window.dispatchEvent(new CustomEvent('portal-local-sync', { detail: { key } }));
    if (key === 'pw6') window.dispatchEvent(new Event('pw6-sync'));
  };

  let inFlight = 0;
  const push = async (key: string, value: string | null) => {
    if (value !== null && value.length > MAX_BYTES) {
      setStatus({ state: 'error', message: `"${key}" is too large to sync` });
      return;
    }
    const h = hash(value);
    last[key] = h; // optimistic, so the next tick doesn't re-send it
    persist();
    inFlight++;
    setStatus({ state: 'syncing' });
    try {
      await setDoc(doc(col, key), { json: value, updatedAt: serverTimestamp() });
      if (!stopped && --inFlight === 0) setStatus({ state: 'synced', at: Date.now() });
    } catch (err: any) {
      inFlight--;
      if (last[key] === h) delete last[key]; // retry on the next tick
      if (!stopped) setStatus({ state: 'error', message: err?.code === 'permission-denied' ? 'Not allowed to sync with this account' : 'Sync failed — will retry' });
    }
  };

  setStatus({ state: 'connecting' });

  // 1) Reconcile once.
  try {
    const snap = await getDocs(col);
    if (stopped) return;
    const remote: Record<string, string | null> = {};
    snap.forEach((d) => { remote[d.id] = (d.data().json ?? null) as string | null; });

    const backup: Record<string, string | null> = {};
    for (const key of SYNC_KEYS) {
      const local = readLocal(key);
      if (!(key in remote)) {
        if (local !== null) await push(key, local); // cloud has nothing yet: seed it
        else last[key] = hash(null);
        continue;
      }
      const r = remote[key];
      if (r === local) { last[key] = hash(local); continue; }
      const editedOffline = !firstTimeHere && last[key] !== undefined && hash(local) !== last[key];
      if (editedOffline) {
        await push(key, local);
      } else {
        if (local !== null) backup[key] = local;
        apply(key, r);
      }
    }
    if (Object.keys(backup).length) {
      try { localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: new Date().toISOString(), data: backup })); } catch { /* not fatal */ }
    }
    persist();
    if (inFlight === 0) setStatus({ state: 'synced', at: Date.now() });
  } catch (err: any) {
    setStatus({ state: 'error', message: err?.code === 'permission-denied' ? 'Not allowed to sync with this account' : 'Could not reach cloud sync' });
    // keep going: the listener and tick below retry once connectivity returns
  }

  // 2) Live changes from other devices.
  const unsub = onSnapshot(col, (snap) => {
    snap.docChanges().forEach((ch) => {
      const key = ch.doc.id;
      if (!SYNC_KEYS.includes(key) || ch.type === 'removed') return;
      if (ch.doc.metadata.hasPendingWrites) return; // our own write echoing back
      const r = (ch.doc.data().json ?? null) as string | null;
      const local = readLocal(key);
      if (r === local) { last[key] = hash(r); return; }
      const localDirty = last[key] !== undefined && hash(local) !== last[key];
      if (!localDirty) apply(key, r); // otherwise our pending edit wins on the next tick
    });
    persist();
  }, () => {
    if (!stopped) setStatus({ state: 'error', message: 'Live sync disconnected' });
  });

  // 3) Upload local edits.
  const tick = () => {
    for (const key of SYNC_KEYS) {
      const local = readLocal(key);
      if (hash(local) !== last[key]) push(key, local);
    }
  };
  const interval = setInterval(tick, 2000);
  const onHide = () => { if (document.visibilityState === 'hidden') tick(); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', tick);

  running = {
    stop: () => {
      stopped = true;
      unsub();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', tick);
    },
  };
}
