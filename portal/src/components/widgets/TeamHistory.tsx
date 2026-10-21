import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';

// Season-by-season results for one team, newest game first: regular season and
// playoffs, with the team's running record after each game. Opened from the
// "Season results" toggle on a team card in Sports.

interface Props { sport: string; league: string; team: string }

interface GameRow {
  id: string;
  ts: number;
  dateLabel: string;
  home: boolean;
  opp: string;
  result: 'W' | 'L' | 'T';
  score: string;       // team score first, e.g. "123–91"
  extra: string;       // "OT", "SO", "" ...
  playoff: boolean;
  round: string;       // playoff round / game label
  record: string;      // record after this game
}

interface SeasonData { label: string; rows: GameRow[] }

// Fetched seasons are cached for the life of the page so reopening is instant.
const cache = new Map<string, SeasonData>();

// ESPN numbers NFL/MLB seasons by the year they start in, NBA/NHL by the year
// they end in (2026 = "2025-26"), so the candidate years and labels differ.
const endsInYear = (league: string) => league === 'nba' || league === 'nhl';
const labelFor = (league: string, y: number) => (endsInYear(league) ? `${y - 1}-${String(y).slice(-2)}` : String(y));
function candidateYears(league: string): number[] {
  const y = new Date().getFullYear();
  const top = endsInYear(league) ? y + 1 : y;
  return Array.from({ length: 6 }, (_, i) => top - i);
}

const scoreOf = (c: any): number | null => {
  const s = c?.score;
  const v = typeof s === 'object' && s !== null ? (s.value ?? s.displayValue) : s;
  const n = Number(v);
  return v === undefined || v === null || v === '' || Number.isNaN(n) ? null : n;
};

async function fetchType(sport: string, league: string, team: string, season: number, type: 2 | 3): Promise<any[]> {
  try {
    const res = await fetch(
      `/api/espn?path=${encodeURIComponent(`sports/${sport}/${league}/teams/${team}/schedule`)}&season=${season}&seasontype=${type}&limit=100`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data?.events || [];
  } catch { return []; }
}

function build(league: string, year: number, regular: any[], post: any[], abbr: string): SeasonData {
  const seen = new Set<string>();
  const events = [...regular, ...post]
    .filter((e) => {
      const k = e?.id || e?.date;
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .filter((e) => e?.competitions?.[0]?.status?.type?.completed)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  const tally = { reg: { w: 0, l: 0, t: 0, otl: 0 }, post: { w: 0, l: 0, t: 0, otl: 0 } };
  const rows: GameRow[] = [];
  for (const e of events) {
    const comp = e.competitions[0];
    const me = comp.competitors?.find((c: any) => c?.team?.abbreviation?.toLowerCase() === abbr);
    const them = comp.competitors?.find((c: any) => c !== me);
    if (!me || !them) continue;
    const ms = scoreOf(me), ts = scoreOf(them);
    if (ms === null || ts === null) continue;
    const playoff = String(e?.seasonType?.type ?? e?.seasonType?.id) === '3';
    const detail: string = comp?.status?.type?.detail || comp?.status?.type?.shortDetail || '';
    const extra = /\bSO\b|shootout/i.test(detail) ? 'SO' : /\bOT\b|overtime/i.test(detail) ? detail.match(/\d*OT/i)?.[0].toUpperCase() || 'OT' : '';
    const won = typeof me.winner === 'boolean' && (me.winner || them.winner) ? me.winner : ms > ts;
    const result: 'W' | 'L' | 'T' = ms === ts && !me.winner && !them.winner ? 'T' : won ? 'W' : 'L';
    const t = playoff ? tally.post : tally.reg;
    if (result === 'W') t.w++;
    else if (result === 'T') t.t++;
    else if (league === 'nhl' && extra && !playoff) t.otl++;
    else t.l++;
    const record = [t.w, t.l, ...(league === 'nhl' && !playoff ? [t.otl] : t.t ? [t.t] : [])].join('-');
    const date = new Date(e.date);
    rows.push({
      id: String(e.id || e.date),
      ts: date.getTime(),
      dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      home: me.homeAway === 'home',
      opp: them?.team?.abbreviation || them?.team?.shortDisplayName || '?',
      result,
      score: `${ms}–${ts}`,
      extra,
      playoff,
      round: playoff ? (comp?.notes?.[0]?.headline || comp?.type?.text || 'Playoffs') : '',
      record,
    });
  }
  rows.reverse(); // newest first
  return { label: labelFor(league, year), rows };
}

async function loadSeason(sport: string, league: string, team: string, year: number): Promise<SeasonData> {
  const key = `${sport}/${league}/${team}/${year}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [reg, post] = await Promise.all([
    fetchType(sport, league, team, year, 2),
    fetchType(sport, league, team, year, 3),
  ]);
  const data = build(league, year, reg, post, team);
  // Don't cache an empty answer: it may just be a hiccup.
  if (data.rows.length > 0) cache.set(key, data);
  return data;
}

export default function TeamHistory({ sport, league, team }: Props) {
  const years = candidateYears(league);
  const [year, setYear] = useState<number | null>(null);
  const [data, setData] = useState<SeasonData | null>(null);
  const [loading, setLoading] = useState(true);

  // First open (year not chosen yet): walk back from the newest season until
  // one has finished games, i.e. the in-progress season or the one that just
  // ended. After that, whichever season is picked is loaded (cached ones are
  // instant).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (year === null) {
        for (const y of years.slice(0, 3)) {
          const d = await loadSeason(sport, league, team, y);
          if (cancelled) return;
          if (d.rows.length > 0) { setYear(y); return; }
        }
        if (!cancelled) setYear(years[0]);
        return;
      }
      const d = await loadSeason(sport, league, team, year);
      if (cancelled) return;
      setData(d);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const pick = (y: number) => setYear(y);

  return (
    <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
      <div className="flex items-center gap-2 mb-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Season</label>
        <select
          value={year ?? ''}
          onChange={(e) => pick(Number(e.target.value))}
          className="text-xs rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        >
          {year === null && <option value="">…</option>}
          {years.map((y) => <option key={y} value={y}>{labelFor(league, y)}</option>)}
        </select>
        {data && data.rows.length > 0 && <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{data.rows.length} games</span>}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-3">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500"></div>
        </div>
      )}
      {!loading && data && data.rows.length === 0 && (
        <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 py-1">
          <AlertCircle size={11} /> No finished games found for this season.
        </div>
      )}
      {!loading && data && data.rows.length > 0 && (
        <ul className="max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
          {data.rows.map((g) => (
            <li key={g.id} className="flex items-center gap-2 py-1">
              <span className="w-12 flex-shrink-0 text-zinc-500 dark:text-zinc-400 tabular-nums">{g.dateLabel}</span>
              <span className="w-14 flex-shrink-0 text-zinc-700 dark:text-zinc-300 truncate">{g.home ? 'vs' : '@'} {g.opp}</span>
              <span className={`w-4 flex-shrink-0 font-bold ${g.result === 'W' ? 'text-emerald-600 dark:text-emerald-400' : g.result === 'L' ? 'text-red-500' : 'text-zinc-500'}`}>{g.result}</span>
              <span className="flex-shrink-0 tabular-nums text-zinc-900 dark:text-white">{g.score}{g.extra && <span className="text-zinc-400"> {g.extra}</span>}</span>
              {g.playoff && <span className="min-w-0 truncate px-1.5 py-px rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px]" title={g.round}>{g.round}</span>}
              <span className="ml-auto flex-shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400" title={g.playoff ? 'Playoff record' : 'Season record'}>{g.record}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
