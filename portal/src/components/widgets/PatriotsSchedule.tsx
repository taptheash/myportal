import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

interface PatriotsScheduleProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface ScheduleGame {
  id: string;
  date: string;
  matchup: string; // "Pats @ DEN" or "DEN @ Pats", depending on home/away
  time: string;
}

export default function PatriotsSchedule(_props: PatriotsScheduleProps) {
  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        setLoading(true);
        const season = new Date().getFullYear();
        const res = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/ne/schedule?season=${season}`
        );
        if (!res.ok) throw new Error('Failed to fetch schedule');
        const data = await res.json();
        const events = data?.events || [];

        const parsed: ScheduleGame[] = events.map((e: any) => {
          const comp = e?.competitions?.[0];
          const competitors = comp?.competitors || [];
          const home = competitors.find((c: any) => c.homeAway === 'home');
          const away = competitors.find((c: any) => c.homeAway === 'away');
          const patsAreHome = home?.team?.abbreviation?.toUpperCase() === 'NE';

          const opponent = patsAreHome ? away?.team?.abbreviation : home?.team?.abbreviation;
          const matchup = patsAreHome ? `${opponent} @ Pats` : `Pats @ ${opponent}`;

          // Explicitly forced to America/New_York regardless of the
          // browser's own timezone — correctly handles the EST/EDT switch
          // across the season rather than a fixed offset.
          const dateObj = new Date(e.date);
          const date = dateObj.toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York',
          });
          const time = dateObj.toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short',
          });

          return { id: e.id || `${e.date}-${opponent}`, date, matchup, time };
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
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-700"></div>
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
        <div className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">No schedule available.</div>
      )}
      {games.map((game) => (
        <div
          key={game.id}
          className="flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-slate-700 rounded-lg border-l-4 border-blue-700"
        >
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">{game.matchup}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{game.date}</div>
          </div>
          <div className="text-sm font-medium text-blue-700 dark:text-blue-300 flex-shrink-0">{game.time}</div>
        </div>
      ))}
    </div>
  );
}
