// Adds https:// to a user-typed URL only when it has no scheme at all.
// The previous check was url.startsWith('http'), which misfires on bare
// domains that happen to begin with "http" (httpbin.org -> left as a
// relative link) and on upper-case schemes (HTTPS://...).
export function normalizeUrl(raw: string): string {
  const url = raw.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
}
