// Firebase is loaded lazily and ONLY when its config is present. If the
// REACT_APP_FIREBASE_* variables are missing (e.g. a deploy made before they
// were added to Vercel) nothing Firebase-related runs at all: no sign-in
// button, no errors, the portal just works on this browser's localStorage.
// That's the lesson from the September lockout — cloud sync must never be
// able to stop the portal itself from loading.

import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

// The web config is public by design (it's in every Firebase site's page).
// Access control lives in firebase/firestore.rules.
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// The only account allowed to sync. Also enforced server-side by the rules.
export const SYNC_EMAIL = 'taptheash@gmail.com';

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
);

export interface FirebaseHandles {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  authMod: typeof import('firebase/auth');
  fsMod: typeof import('firebase/firestore');
}

let loading: Promise<FirebaseHandles> | null = null;

// Dynamic imports keep the Firebase SDK out of the main bundle; it's only
// downloaded when configured.
export function getFirebase(): Promise<FirebaseHandles> {
  if (!isFirebaseConfigured) return Promise.reject(new Error('Firebase is not configured'));
  if (!loading) {
    loading = (async () => {
      const [{ initializeApp }, authMod, fsMod] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);
      const app = initializeApp(firebaseConfig);
      const auth = authMod.getAuth(app);
      const db = fsMod.getFirestore(app);
      return { app, auth, db, authMod, fsMod };
    })();
    loading.catch(() => { loading = null; });
  }
  return loading;
}
