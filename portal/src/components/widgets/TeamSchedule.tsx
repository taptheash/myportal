import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

interface TeamScheduleProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface ScheduleGame {
  id: string;
  date: string;
  matchup: string; // e.g. "Pats @ DEN" or "DEN @ Pats", depending on home/away
  time: string;
  broadcast: string | null;
}

// Returns a component pre-configured for one specific team, so multiple
// team-schedule tabs (Patriots, Red Sox, etc.) can share one implementation
// instead of duplicating the ESPN fetch/format logic per team. `team` must
// be ESPN's lowercase team abbreviation (e.g. 'ne', 'bos'); `shortName` is
// what's shown in the matchup line (e.g. 'Pats', 'Sox').
export function makeTeamSchedule(
  sport: string,
  league: string,
  team: string,
  shortName: string,
  accentColor: string
) {
  return function TeamSchedule(_props: TeamScheduleProps) {
    const [games, setGames] = useState<ScheduleGame[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      const fetchSchedule = async () => {
        try {
          setLoading(true);
          const season = new Date().getFullYear();
          // limit=100 is generous on purpose — ESPN's schedule endpoint
          // defaults to a small page size (seen defaulting to 25 elsewhere)
          // unless a limit is set explicitly, which cut Patriots' schedule
          // down to 3 games the first time this was built.
          // seasontype=2 (regular season) is required too — without it the
          // endpoint defaults to preseason-only for that season, which is
          // why Patriots/Celtics/Bruins showed "no upcoming games" once
          // their preseasons had already ended for the year.
          const res = await fetch(
            `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${team}/schedule?season=${season}&seasontype=2&limit=100`
          );
          if (!res.ok) throw new Error('Failed to fetch schedule');
          const data = await res.json();
          const events = data?.events || [];

          const now = Date.now();
          const upcomingEvents = events.filter((e: any) => e?.date && new Date(e.date).getTime() >= now);

          const parsed: ScheduleGame[] = upcomingEvents.map((e: any) => {
            const comp = e?.competitions?.[0];
            const competitors = comp?.competitors || [];
            const home = competitors.find((c: any) => c.homeAway === 'home');
            const away = competitors.find((c: any) => c.homeAway === 'away');
            const teamIsHome = home?.team?.abbreviation?.toLowerCase() === team;

            const opponent = teamIsHome ? away?.team?.abbreviation : home?.team?.abbreviation;
            const matchup = teamIsHome ? `${opponent} @ ${shortName}` : `${shortName} @ ${opponent}`;

            // Explicitly forced to America/New_York regardless of the
            // browser's own timezone — correctly handles the EST/EDT
            // switch across a season rather than a fixed offset.
            const dateObj = new Date(e.date);
            const date = dateObj.toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York',
            });
            const time = dateObj.toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short',
            });

            const broadcast = comp?.broadcasts?.[0]?.names?.[0] || null;

            return { id: e.id || `${e.date}-${opponent}`, date, matchup, time, broadcast };
          });

          setGames(parsed);
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Error fetching schedule');
        } finally {
          setLoading(false);
        }
      };

      fetchSchedule();
      const interval = setInterval(fetchSchedule, 3600000);
      return () => clearInterval(interval);
    }, []);

    if (loading) {
      return (
        <div className="flex items-center justify-center h-24">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderBottomColor: accentColor }}></div>
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
      <div className="flex flex-col gap-1.5">
        {games.length === 0 && (
          <div className="text-center text-zinc-400 dark:text-zinc-500 text-sm py-6">No upcoming games scheduled.</div>
        )}
        {games.map((game) => (
          <div
            key={game.id}
            className="surface-card flex items-center justify-between px-3 py-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl border-l-4 transition-colors duration-150"
            style={{ backgroundColor: `${accentColor}1A`, borderLeftColor: accentColor }}
          >
            <div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-white">{game.matchup}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{game.date}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-sm font-medium" style={{ color: accentColor }}>{game.time}</div>
              {game.broadcast && (
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{game.broadcast}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };
}
