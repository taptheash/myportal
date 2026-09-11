import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

interface NflScheduleProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface WeekGame {
  id: string;
  date: string;    // e.g. "Thu, Sep 10"
  time: string;    // e.g. "8:20 PM EDT"
  matchup: string; // e.g. "NE @ SEA"
  status: string;  // e.g. "Scheduled", "Final", "In Progress"
  broadcast: string | null;
  score: string | null; // e.g. "24-17" — set once the game has started, null before kickoff
}

function getScore(competitor: any): string {
  const s = competitor?.score;
  if (s === null || s === undefined) return '';
  if (typeof s === 'object') return s.displayValue ?? s.value ?? '';
  return String(s);
}

// ESPN's scoreboard endpoint (no date params) returns exactly the CURRENT
// week's games — whatever week is "live" for today's date, regular season
// or otherwise. That's exactly what we want here: this week only, never
// future weeks. Passing an explicit week/dates range would let this drift
// into showing schedules beyond the upcoming week, which is deliberately
// avoided.
const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

export default function NflSchedule(_props: NflScheduleProps) {
  const [games, setGames] = useState<WeekGame[]>([]);
  const [weekLabel, setWeekLabel] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeek = async () => {
      try {
        setLoading(true);
        const res = await fetch(SCOREBOARD_URL);
        if (!res.ok) throw new Error('Failed to fetch NFL schedule');
        const data = await res.json();
        const events = data?.events || [];

        const weekNumber = data?.week?.number;
        const seasonType = data?.season?.type; // 1 = preseason, 2 = regular, 3 = postseason
        const seasonTypeLabel = seasonType === 1 ? 'Preseason' : seasonType === 3 ? 'Playoffs' : 'Week';
        setWeekLabel(weekNumber ? `${seasonTypeLabel} ${weekNumber}` : seasonTypeLabel);

        const parsed: WeekGame[] = events.map((e: any) => {
          const comp = e?.competitions?.[0];
          const competitors = comp?.competitors || [];
          const home = competitors.find((c: any) => c.homeAway === 'home');
          const away = competitors.find((c: any) => c.homeAway === 'away');
          const matchup = `${away?.team?.abbreviation || '???'} @ ${home?.team?.abbreviation || '???'}`;

          // Forced to America/New_York regardless of the browser's own
          // timezone, same reasoning as the per-team schedule widget —
          // correctly handles the EST/EDT switch across a season.
          const dateObj = new Date(e.date);
          const date = dateObj.toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York',
          });
          const time = dateObj.toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short',
          });

          const broadcast = comp?.broadcasts?.[0]?.names?.[0] || null;
          const status = e?.status?.type?.description || 'Scheduled';
          const state = comp?.status?.type?.state; // 'pre' | 'in' | 'post'
          const score = state === 'pre' ? null : `${getScore(away)}-${getScore(home)}`;

          return { id: e.id || `${e.date}-${matchup}`, date, time, matchup, status, broadcast, score };
        });

        // Keep ESPN's own ordering (chronological) rather than re-sorting —
        // it already comes back date-ordered.
        setGames(parsed);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching NFL schedule');
      } finally {
        setLoading(false);
      }
    };

    fetchWeek();
    // 15 min — frequent enough to keep the Score column current during live
    // games without hammering ESPN's endpoint the rest of the week, same
    // cadence used by the per-team Sports widget for the same reason.
    const interval = setInterval(fetchWeek, 900000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-24 gap-2 text-red-500">
        <AlertCircle size={20} />
        <p className="text-xs text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {weekLabel && (
        <div className="text-xs font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 px-1">
          NFL — {weekLabel}
        </div>
      )}

      {games.length === 0 && (
        <div className="text-center text-zinc-400 dark:text-zinc-500 text-sm py-6">No games scheduled this week.</div>
      )}

      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500 border-b border-zinc-200 dark:border-zinc-700">
              <th className="py-1.5 pr-2 font-semibold">Date</th>
              <th className="py-1.5 pr-2 font-semibold">Matchup</th>
              <th className="py-1.5 pr-2 font-semibold">Time</th>
              <th className="py-1.5 pr-2 font-semibold">Score</th>
              <th className="py-1.5 font-semibold">TV</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game) => (
              <tr
                key={game.id}
                className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors duration-150"
              >
                <td className="py-2 pr-2 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{game.date}</td>
                <td className="py-2 pr-2 font-semibold text-zinc-900 dark:text-white whitespace-nowrap">{game.matchup}</td>
                <td className="py-2 pr-2 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                  {game.status === 'Final' ? 'Final' : game.status === 'In Progress' ? 'Live' : game.time}
                </td>
                <td className={`py-2 pr-2 whitespace-nowrap font-semibold tabular-nums ${
                  game.status === 'In Progress'
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : game.score
                    ? 'text-zinc-700 dark:text-zinc-300'
                    : 'text-zinc-300 dark:text-zinc-600'
                }`}>
                  {game.score || '—'}
                </td>
                <td className="py-2 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{game.broadcast || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
