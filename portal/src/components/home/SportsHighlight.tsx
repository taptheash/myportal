import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { getWidgetConfig } from '../../lib/portalStorage';

// Home's sports teaser: for each team already tracked on the Sports tab,
// shows just the next-game line (no live in-game score polling — that
// level of detail belongs to the real Sports tab, not a Home summary).

interface TeamEntry {
  key: string;
  name: string;
  emoji: string;
  sport: string;
  league: string;
  team: string;
}

interface TeamLine {
  key: string;
  name: string;
  emoji: string;
  line: string;
}

const DEFAULT_TEAMS: TeamEntry[] = [
  { key: 'nfl-ne', name: 'Patriots', emoji: '🏈', sport: 'football', league: 'nfl', team: 'ne' },
  { key: 'mlb-bos', name: 'Red Sox', emoji: '⚾', sport: 'baseball', league: 'mlb', team: 'bos' },
  { key: 'nba-bos', name: 'Celtics', emoji: '🏀', sport: 'basketball', league: 'nba', team: 'bos' },
  { key: 'nhl-bos', name: 'Bruins', emoji: '🏒', sport: 'hockey', league: 'nhl', team: 'bos' },
];

export default function SportsHighlight() {
  const [lines, setLines] = useState<TeamLine[] | null>(null);

  useEffect(() => {
    const teams: TeamEntry[] = getWidgetConfig('sports')?.teams || DEFAULT_TEAMS;

    const run = async () => {
      const results = await Promise.all(
        teams.slice(0, 4).map(async (t): Promise<TeamLine> => {
          try {
            const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${t.sport}/${t.league}/teams/${t.team}`);
            if (!res.ok) throw new Error('failed');
            const data = await res.json();
            const nextEvent = data?.team?.nextEvent?.[0];
            const shortName = nextEvent?.shortName;
            const state = nextEvent?.competitions?.[0]?.status?.type?.shortDetail;
            return { key: t.key, name: t.name, emoji: t.emoji, line: shortName ? `${shortName}${state ? ` — ${state}` : ''}` : 'No upcoming game' };
          } catch {
            return { key: t.key, name: t.name, emoji: t.emoji, line: 'Unavailable' };
          }
        })
      );
      setLines(results);
    };

    run();
  }, []);

  if (!lines) {
    return (
      <div className="flex items-center justify-center py-2">
        <Loader2 size={14} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {lines.map((t) => (
        <div key={t.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
          <span className="text-base flex-shrink-0" aria-hidden="true">{t.emoji}</span>
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200 flex-shrink-0 w-16 truncate">{t.name}</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{t.line}</span>
        </div>
      ))}
    </div>
  );
}
