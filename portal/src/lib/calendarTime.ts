// Date helpers shared by the Calendar tab and Home's Today agenda.
//
// Google returns all-day events as a bare date ("2026-09-26") in
// start.date / end.date (end is EXCLUSIVE — the day after). `new Date(
// "2026-09-26")` parses that as midnight UTC, which in New Hampshire is
// 8 PM the previous evening — so all-day events were shown on the wrong
// day and filtered out as "already past". These parse bare dates as local
// midnight instead.

export interface GCalTime {
  dateTime?: string;
  date?: string;
}

export function parseGCalTime(t: GCalTime | undefined): Date | null {
  if (!t) return null;
  if (t.dateTime) return new Date(t.dateTime);
  if (t.date) {
    const [y, m, d] = t.date.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return null;
}

export function isAllDay(start: GCalTime | undefined): boolean {
  return !!start && !start.dateTime && !!start.date;
}

// Local yyyy-mm-dd (NOT toISOString(), which is the UTC date and rolls
// over to tomorrow after 8 PM Eastern).
export function localDateKey(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Turns the form's local date + time into an absolute ISO timestamp in the
// BROWSER's time zone. Sending the bare "2026-09-26T14:00:00" let the
// Vercel function (which runs in UTC) interpret it as 14:00 UTC, so every
// created/edited event landed 4 hours early (5 in winter).
export function localPartsToIso(date: string, time: string): string {
  return new Date(`${date}T${time || '00:00'}:00`).toISOString();
}
