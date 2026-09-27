import React, { useEffect, useRef, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, LogOut } from 'lucide-react';
import { getFirebase, isFirebaseConfigured, SYNC_EMAIL } from '../lib/firebaseClient';
import { startCloudSync, stopCloudSync, subscribeSyncStatus, getSyncStatus, SyncStatus } from '../lib/cloudSync';

// Header control for optional cloud sync. Signed out, the portal works
// exactly as before on this browser's own storage; signing in with Google
// turns on sync across devices. Renders nothing at all if Firebase isn't
// configured, so a missing env var can never break the page.
export default function SyncButton() {
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeSyncStatus(setStatus), []);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    getFirebase()
      .then((fb) => {
        if (cancelled) return;
        setReady(true);
        unsub = fb.authMod.onAuthStateChanged(fb.auth, async (user) => {
          if (!user) {
            setEmail(null);
            stopCloudSync();
            return;
          }
          if (user.email?.toLowerCase() !== SYNC_EMAIL || !user.emailVerified) {
            setError(`Only ${SYNC_EMAIL} can sync. Signed out.`);
            await fb.authMod.signOut(fb.auth);
            return;
          }
          setError(null);
          setEmail(user.email);
          startCloudSync(fb, user.uid);
        });
      })
      .catch(() => { /* Firebase failed to load — portal keeps working unsynced */ });
    return () => { cancelled = true; unsub?.(); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!isFirebaseConfigured) return null;

  const signIn = async () => {
    setError(null);
    try {
      const fb = await getFirebase();
      const provider = new fb.authMod.GoogleAuthProvider();
      provider.setCustomParameters({ login_hint: SYNC_EMAIL, prompt: 'select_account' });
      await fb.authMod.signInWithPopup(fb.auth, provider);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') return;
      setError(err?.code === 'auth/unauthorized-domain'
        ? 'This domain is not in Firebase › Authentication › Settings › Authorized domains'
        : err?.code === 'auth/popup-blocked' ? 'The browser blocked the sign-in popup — allow popups for this site'
        : 'Sign-in failed');
    }
  };

  const signOutNow = async () => {
    setOpen(false);
    const fb = await getFirebase();
    await fb.authMod.signOut(fb.auth);
  };

  const signedIn = !!email;
  const label = !signedIn
    ? 'Sync off'
    : status.state === 'error' ? 'Sync issue'
    : status.state === 'syncing' || status.state === 'connecting' ? 'Syncing…'
    : 'Synced';
  const Icon = !signedIn ? CloudOff
    : status.state === 'error' ? AlertTriangle
    : status.state === 'syncing' || status.state === 'connecting' ? RefreshCw
    : Cloud;

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => (signedIn ? setOpen(!open) : signIn())}
        disabled={!ready}
        title={signedIn ? `Syncing as ${email}` : 'Sign in with Google to sync across devices'}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50 ${
          signedIn && status.state === 'error'
            ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40'
            : signedIn
            ? 'text-indigo-600 dark:text-indigo-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            : 'text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-600 dark:hover:text-zinc-300'
        }`}
      >
        <Icon size={14} className={status.state === 'syncing' || status.state === 'connecting' ? 'animate-spin' : ''} />
        <span className="hidden lg:inline">{label}</span>
      </button>

      {(open || error) && (
        <div className="absolute right-0 mt-2 w-64 z-50 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-lg text-xs text-zinc-600 dark:text-zinc-300">
          {error ? (
            <div className="flex flex-col gap-2">
              <p className="text-amber-600 dark:text-amber-400">{error}</p>
              <button onClick={() => setError(null)} className="self-end text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">Dismiss</button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p>Syncing as <span className="font-medium text-zinc-800 dark:text-zinc-100">{email}</span></p>
              <p className="text-zinc-400 dark:text-zinc-500">
                {status.state === 'error' ? status.message
                  : status.state === 'synced' ? `Up to date · ${new Date(status.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                  : 'Syncing…'}
              </p>
              <button
                onClick={signOutNow}
                className="self-start flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors duration-150"
              >
                <LogOut size={12} /> Sign out
              </button>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Signing out stops syncing. Everything stays on this browser.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
