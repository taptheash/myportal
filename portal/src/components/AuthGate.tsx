import React, { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  isSignInWithEmailLink,
  signInWithEmailLink,
  sendSignInLinkToEmail,
  signOut,
  type User,
} from 'firebase/auth';
import { Mail, LogOut } from 'lucide-react';
import { auth } from '../lib/firebaseClient';

// Gates the whole app behind a signed-in Firebase session, using email-link
// (passwordless) sign-in — no password to create or remember. Firebase's
// own sign-in flow needs somewhere to stash the email address between
// "link sent" and "link clicked" (it can't rely on the click carrying it,
// since the click may happen in a different tab or even a different
// device); that one small bit of localStorage is the auth SDK's own
// bookkeeping, not app data, so it's kept outside useFirebaseState's
// migrate-then-clear logic — there's nowhere else for a browser-based auth
// flow to keep it.
const EMAIL_STORAGE_KEY = 'firebaseEmailForSignIn';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  // undefined = still checking for an existing session; null = confirmed signed out
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return unsubscribe;
  }, []);

  const completeSignIn = async (confirmEmail: string) => {
    try {
      await signInWithEmailLink(auth, confirmEmail, window.location.href);
      window.localStorage.removeItem(EMAIL_STORAGE_KEY);
      window.history.replaceState({}, document.title, window.location.pathname);
      setNeedsEmailConfirm(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in link is invalid or expired');
    }
  };

  // Completes sign-in when the user clicks the emailed link and lands back
  // here on a special sign-in URL. Opened in the SAME browser that
  // requested it: the email is already known (stashed below) and this
  // finishes automatically. Opened somewhere else (a different browser,
  // or the link forwarded to another device): ask for the email once more
  // as a lightweight confirmation that it's really them completing it.
  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    const storedEmail = window.localStorage.getItem(EMAIL_STORAGE_KEY);
    if (storedEmail) {
      completeSignIn(storedEmail);
    } else {
      setNeedsEmailConfirm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendLink = async () => {
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    try {
      await sendSignInLinkToEmail(auth, email.trim(), {
        url: window.location.origin,
        handleCodeInApp: true,
      });
      window.localStorage.setItem(EMAIL_STORAGE_KEY, email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send sign-in link');
    } finally {
      setSending(false);
    }
  };

  if (user === undefined && !needsEmailConfirm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (needsEmailConfirm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="surface-card bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-3">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Confirm your email</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            This link was opened somewhere other than the browser that requested it — enter your email again to finish signing in.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && completeSignIn(email)}
            placeholder="you@example.com"
            className="px-3 py-2 text-sm rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            autoFocus
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={() => completeSignIn(email)}
            className="flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors duration-150"
          >
            Confirm and sign in
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="surface-card bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-3">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Sign in to MyPortal</h1>
          {sent ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Check <span className="font-medium">{email}</span> for a sign-in link.
            </p>
          ) : (
            <>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Enter your email and we'll send a link to sign in — no password needed.
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendLink()}
                placeholder="you@example.com"
                className="px-3 py-2 text-sm rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                autoFocus
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                onClick={sendLink}
                disabled={sending}
                className="flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors duration-150"
              >
                <Mail size={14} /> {sending ? 'Sending…' : 'Send sign-in link'}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      <button
        onClick={() => signOut(auth)}
        title={`Signed in as ${user.email} — click to sign out`}
        className="fixed bottom-3 right-3 z-50 flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-zinc-900/80 dark:bg-zinc-800/90 text-zinc-300 hover:text-white backdrop-blur-sm transition-colors duration-150"
      >
        <LogOut size={12} /> Sign out
      </button>
    </>
  );
}
