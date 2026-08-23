import { useState, useEffect } from 'react';

interface Team {
  id: string;
  name: string;
  league: string;
}

interface Game {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  startTime?: string;
}

const NE_TEAMS: Team[] = [
  { id: 'ne', name: 'Patriots', league: 'NFL' },
  { id: 'bos', name: 'Red Sox', league: 'MLB' },
  { id: 'cel', name: 'Celtics', league: 'NBA' },
  { id: 'bru', name: 'Bruins', league: 'NHL' },
];

export default function Sports() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch from ESPN public API for NE teams
      const response = await fetch(
        'https://site.api.espn.com/sites/site.api.espn.com/fetch/sites/espnw/api/site/v2/sports'
      );
      
      if (!response.ok) throw new Error('Failed to fetch games');
      
      // Parse and filter for NE teams
      const data = await response.json();
      // In a real implementation, you'd parse the ESPN API response
      // For now, set placeholder games
      setGames([
        { id: '1', homeTeam: 'Patriots', awayTeam: 'Example', homeScore: 24, awayScore: 10, status: 'FINAL' },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading games');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-sm text-gray-600 dark:text-gray-400">Loading...</div>;
  if (error) return <div className="text-sm text-red-600">{error}</div>;

  return (
    <div className="space-y-2">
      {games.length === 0 ? (
        <div className="text-sm text-gray-600 dark:text-gray-400">No upcoming games</div>
      ) : (
        games.map((game) => (
          <div
            key={game.id}
            className="p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm"
          >
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <div className="font-semibold text-gray-900 dark:text-gray-100">{game.homeTeam}</div>
                <div className="text-gray-600 dark:text-gray-400">{game.awayTeam}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                  {game.homeScore}
                </div>
                <div className="text-gray-600 dark:text-gray-400">{game.awayScore}</div>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{game.status}</div>
          </div>
        ))
      )}
      <button
        onClick={fetchGames}
        className="w-full mt-2 px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Refresh
      </button>
    </div>
  );
}
