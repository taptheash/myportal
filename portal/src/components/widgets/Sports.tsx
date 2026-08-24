import React, { useState, useEffect } from 'react';
import { AlertCircle, Trash2, ArrowLeft, X } from 'lucide-react';

interface SportsProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface TeamEntry {
  key: string;
  name: string;
  emoji: string;
  accent: string;
  sport: string;
  league: string;
  team: string; // ESPN team abbreviation, lowercase
}

interface TeamResult extends TeamEntry {
  record: string | null;
  status: 'loading' | 'ok' | 'error';
  line: string;
  detail: string;
}

interface EspnLeagueTeam {
  id: string;
  abbreviation: string;
  displayName: string;
}

const LEAGUES: { label: string; sport: string; league: string; emoji: string }[] = [
  { label: 'NFL', sport: 'football', league: 'nfl', emoji: '🏈' },
  { label: 'NBA', sport: 'basketball', league: 'nba', emoji: '🏀' },
  { label: 'MLB', sport: 'baseball', league: 'mlb', emoji: '⚾' },
  { label: 'NHL', sport: 'hockey', league: 'nhl', emoji: '🏒' },
];

const ACCENT_COLORS = [
  'border-blue-700', 'border-red-600', 'border-green-600', 'border-yellow-500',
  'border-purple-600', 'border-orange-500', 'border-cyan-600', 'border-pink-600',
];

// New England's major pro teams — the default list before any customization.
const DEFAULT_TEAMS: TeamEntry[] = [
  { key: 'nfl-ne',  name: 'Patriots', emoji: '🏈', accent: 'border-blue-700',   sport: 'football',   league: 'nfl', team: 'ne' },
  { key: 'mlb-bos', name: 'Red Sox',  emoji: '⚾', accent: 'border-red-600',    sport: 'baseball',   league: 'mlb', team: 'bos' },
  { key: 'nba-bos', name: 'Celtics',  emoji: '🏀', accent: 'border-green-600',  sport: 'basketball', league: 'nba', team: 'bos' },
  { key: 'nhl-bos', name: 'Bruins',   emoji: '🏒', accent: 'border-yellow-500', sport: 'hockey',     league: 'nhl', team: 'bos' },
];

function getScore(competitor: any): string {
  const s = competitor?.score;
  if (s === null || s === undefined) return '';
  if (typeof s === 'object') return s.displayValue ?? s.value ?? '';
  return String(s);
}

function formatEvent(nextEvent: any): { line: string; detail: string } {
  try {
    const comp = nextEvent?.competitions?.[0];
    const competitors = comp?.competitors || [];
    const shortName = nextEvent?.shortName || '';
    const state = comp?.status?.type?.state; // 'pre' | 'in' | 'post'
    const detailText = comp?.status?.type?.shortDetail || comp?.status?.type?.detail || '';

    let line = shortName || 'Upcoming game';
    let detail = detailText;

    if (state === 'in') {
      const home = competitors.find((c: any) => c.homeAway === 'home');
      const away = competitors.find((c: any) => c.homeAway === 'away');
      detail = `Live: ${getScore(away)}-${getScore(home)} • ${detailText}`;
    } else if (state === 'post') {
      const home = competitors.find((c: any) => c.homeAway === 'home');
      const away = competitors.find((c: any) => c.homeAway === 'away');
      detail = `Final: ${away?.team?.abbreviation ?? ''} ${getScore(away)} - ${getScore(home)} ${home?.team?.abbreviation ?? ''}`;
    }
    // state === 'pre' falls through here — line/detail already carry the
    // next scheduled matchup and its date/time straight from ESPN.

    return { line, detail: detail || 'Schedule pending' };
  } catch {
    return { line: 'Schedule unavailable', detail: '' };
  }
}

export default function Sports({ config, onUpdateConfig }: SportsProps) {
  const teams: TeamEntry[] = config.teams ?? DEFAULT_TEAMS;
  const teamsKey = teams.map((t) => t.key).join(',');

  const [results, setResults] = useState<TeamResult[]>(() =>
    teams.map((t) => ({ ...t, record: null, status: 'loading', line: '', detail: '' }))
  );

  // Add-team flow state
  const [selectedLeague, setSelectedLeague] = useState<typeof LEAGUES[number] | null>(null);
  const [leagueTeams, setLeagueTeams] = useState<EspnLeagueTeam[]>([]);
  const [loadingLeagueTeams, setLoadingLeagueTeams] = useState(false);
  const [leagueTeamsError, setLeagueTeamsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Reset to a loading state for the CURRENT team list whenever it changes
    // (covers add/delete), then fetch fresh data for everyone — this is what
    // makes a newly added team pull its info immediately rather than waiting
    // for the next 15-minute poll.
    setResults(teams.map((t) => ({ ...t, record: null, status: 'loading', line: '', detail: '' })));

    const fetchTeam = async (t: TeamEntry) => {
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${t.sport}/${t.league}/teams/${t.team}`);
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        const team = data?.team;
        const record = team?.record?.items?.[0]?.summary || null;
        const nextEvent = team?.nextEvent?.[0];
        const { line, detail } = nextEvent
          ? formatEvent(nextEvent)
          : { line: 'No upcoming game', detail: 'Off-season or schedule pending' };

        if (!cancelled) {
          setResults((prev) => prev.map((r) => r.key === t.key ? { ...r, status: 'ok', record, line, detail } : r));
        }
      } catch {
        if (!cancelled) {
          setResults((prev) => prev.map((r) => r.key === t.key ? { ...r, status: 'error' } : r));
        }
      }
    };

    teams.forEach((t) => fetchTeam(t));
    const interval = setInterval(() => teams.forEach((t) => fetchTeam(t)), 900000); // refresh every 15 min
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamsKey]);

  const pickLeague = async (lg: typeof LEAGUES[number]) => {
    setSelectedLeague(lg);
    setLeagueTeams([]);
    setLoadingLeagueTeams(true);
    setLeagueTeamsError(null);
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${lg.sport}/${lg.league}/teams`);
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      const rawList = data?.sports?.[0]?.leagues?.[0]?.teams ?? [];
      const list: EspnLeagueTeam[] = rawList
        .map((entry: any) => entry?.team)
        .filter(Boolean)
        .map((t: any) => ({ id: t.id, abbreviation: t.abbreviation, displayName: t.displayName }))
        .sort((a: EspnLeagueTeam, b: EspnLeagueTeam) => a.displayName.localeCompare(b.displayName));
      setLeagueTeams(list);
    } catch {
      setLeagueTeamsError('Could not load teams for this league. Try again.');
    } finally {
      setLoadingLeagueTeams(false);
    }
  };

  const addTeam = (espnTeam: EspnLeagueTeam) => {
    if (!selectedLeague) return;
    const key = `${selectedLeague.league}-${espnTeam.abbreviation.toLowerCase()}`;
    if (teams.some((t) => t.key === key)) return; // already added, no duplicate
    const accent = ACCENT_COLORS[teams.length % ACCENT_COLORS.length];
    const newTeam: TeamEntry = {
      key,
      name: espnTeam.displayName,
      emoji: selectedLeague.emoji,
      accent,
      sport: selectedLeague.sport,
      league: selectedLeague.league,
      team: espnTeam.abbreviation.toLowerCase(),
    };
    onUpdateConfig({ ...config, teams: [...teams, newTeam], showAdd: false });
    setSelectedLeague(null);
    setLeagueTeams([]);
  };

  const removeTeam = (key: string) => {
    onUpdateConfig({ ...config, teams: teams.filter((t) => t.key !== key) });
  };

  const closeAdd = () => {
    onUpdateConfig({ ...config, showAdd: false });
    setSelectedLeague(null);
    setLeagueTeams([]);
  };

  return (
    <div className="flex flex-col gap-2">
      {config.showAdd && (
        <div className="p-3 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-slate-700 dark:to-slate-600 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
              {selectedLeague && (
                <button onClick={() => { setSelectedLeague(null); setLeagueTeams([]); }} className="p-0.5 hover:bg-black/5 dark:hover:bg-white/10 rounded">
                  <ArrowLeft size={14} />
                </button>
              )}
              {selectedLeague ? `Add a ${selectedLeague.label} team` : 'Add a team'}
            </div>
            <button onClick={closeAdd} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded">
              <X size={14} />
            </button>
          </div>

          {!selectedLeague && (
            <div className="grid grid-cols-2 gap-2">
              {LEAGUES.map((lg) => (
                <button
                  key={lg.league}
                  onClick={() => pickLeague(lg)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg text-sm font-semibold text-gray-900 dark:text-white hover:shadow-md transition"
                >
                  <span>{lg.emoji}</span> {lg.label}
                </button>
              ))}
            </div>
          )}

          {selectedLeague && loadingLeagueTeams && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            </div>
          )}

          {selectedLeague && leagueTeamsError && (
            <div className="text-xs text-red-500 flex items-center gap-1 py-2">
              <AlertCircle size={12} /> {leagueTeamsError}
            </div>
          )}

          {selectedLeague && !loadingLeagueTeams && !leagueTeamsError && (
            <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
              {leagueTeams.map((t) => {
                const already = teams.some((existing) => existing.key === `${selectedLeague.league}-${t.abbreviation.toLowerCase()}`);
                return (
                  <button
                    key={t.id}
                    onClick={() => addTeam(t)}
                    disabled={already}
                    className={`text-left px-2.5 py-1.5 rounded-md text-sm transition ${
                      already
                        ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        : 'text-gray-900 dark:text-white bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {t.displayName} {already && '(added)'}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {results.map((r) => (
        <div key={r.key} className={`group p-2.5 bg-gray-50 dark:bg-slate-700 rounded-lg border-l-4 ${r.accent}`}>
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg flex-shrink-0">{r.emoji}</span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-sm text-gray-900 dark:text-white">{r.name}</span>
                  {r.record && <span className="text-xs text-gray-500 dark:text-gray-400">{r.record}</span>}
                </div>
                {r.status === 'loading' && (
                  <div className="text-xs text-gray-400 dark:text-gray-500">Loading...</div>
                )}
                {r.status === 'error' && (
                  <div className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle size={11} /> Unavailable
                  </div>
                )}
                {r.status === 'ok' && (
                  <>
                    <div className="text-xs text-gray-700 dark:text-gray-300 truncate">{r.line}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.detail}</div>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => removeTeam(r.key)}
              title="Remove team"
              className="flex-shrink-0 p-1 rounded-md text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/40 dark:hover:text-red-400 transition"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}

      {results.length === 0 && (
        <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-4">
          No teams added yet
        </div>
      )}
    </div>
  );
}
