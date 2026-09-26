// All browser calls to /api/calendar/events go through here so they carry
// the portal passcode (see api/calendar/events.js). The passcode is typed in
// once per browser and kept in localStorage — it is NOT an env var baked
// into the build, which would make it public again.

const KEY_STORAGE = 'pw6-portal-key';

export class CalendarLockedError extends Error {
  // 'passcode' = none saved / wrong one; 'unconfigured' = PORTAL_API_KEY
  // hasn't been added in Vercel yet.
  constructor(public reason: 'passcode' | 'unconfigured', message: string) {
    super(message);
    this.name = 'CalendarLockedError';
  }
}

export function getPortalKey(): string {
  try {
    return window.localStorage.getItem(KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function setPortalKey(key: string) {
  try {
    if (key) window.localStorage.setItem(KEY_STORAGE, key);
    else window.localStorage.removeItem(KEY_STORAGE);
  } catch {
    // storage blocked — the passcode just won't be remembered
  }
}

export async function calendarFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const key = getPortalKey();
  if (key) headers.set('x-portal-key', key);
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401 || res.status === 503) {
    const body = await res.json().catch(() => ({}));
    if (body?.code === 'passcode' || body?.code === 'unconfigured') {
      throw new CalendarLockedError(body.code, body.error || 'Calendar is locked');
    }
  }
  return res;
}
