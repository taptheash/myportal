// Picks the games a team card should show from ESPN's data: the game in
// progress (if any), the most recent finished game, and the next game that
// hasn't started.
//
// Why this exists: ESPN's per-team "next event" moves on at different times
// for different leagues. For the NFL it keeps pointing at last week's game
// after it ends; for the NBA it skips straight past a game that just ended
// (or is still being played) to the next one. Reading the whole schedule, with
// the scoreboard laid over it for live and just-finished games, gives every
// team the same two things: what happened last, and what is next.

export interface PickedGames {
  primary: any | null; // live game, else the last finished one, else the next one
  next: any | null;    // the next game not yet started, when primary is something else
}

const HOUR_MS = 3600000;
// A game that says "not started" but began this long ago is ESPN being slow,
// not an upcoming game.
const STALE_PRE_MS = 4 * HOUR_MS;

export function stateOf(e: any): string | undefined {
  return e?.competitions?.[0]?.status?.type?.state;
}

function startOf(e: any): number {
  const t = Date.parse(e?.date ?? e?.competitions?.[0]?.date ?? '');
  return Number.isNaN(t) ? 0 : t;
}

function involves(e: any, team: string): boolean {
  return (e?.competitions?.[0]?.competitors ?? []).some(
    (c: any) => c?.team?.abbreviation?.toLowerCase() === team
  );
}

export function pickGames(
  scheduleEvents: any[],
  scoreboardEvents: any[],
  fallbackEvent: any,
  team: string,
  now: number
): PickedGames | null {
  const byId = new Map<string, any>();
  const add = (e: any) => { if (e && e.id != null) byId.set(String(e.id), e); };

  // Lowest priority first, so later entries replace earlier ones for the same game.
  add(fallbackEvent);
  (scheduleEvents ?? []).forEach(add);
  // The scoreboard is ESPN's live source: it knows a game is in progress or
  // over before the schedule does.
  (scoreboardEvents ?? []).filter((e) => involves(e, team)).forEach(add);

  const all = Array.from(byId.values()).sort((a, b) => startOf(a) - startOf(b));
  if (all.length === 0) return null;

  const live = all.find((e) => stateOf(e) === 'in') ?? null;
  const finished = all.filter((e) => stateOf(e) === 'post');
  const last = finished.length ? finished[finished.length - 1] : null;
  const next = all.find((e) => stateOf(e) === 'pre' && startOf(e) > now - STALE_PRE_MS) ?? null;

  const primary = live ?? last ?? next;
  if (!primary) return null;
  return { primary, next: primary === next ? null : next };
}
