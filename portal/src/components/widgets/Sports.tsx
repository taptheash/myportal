import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

interface SportsProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

interface TeamResult {
  key: string;
  name: string;
  emoji: string;
  accent: string;
  record: string | null;
  status: 'loading' | 'ok' | 'error';
  line: string;       // "vs BUF" or "@ NYY"
  detail: string;      // "Sun 1:00 PM" or "Final: W 24-17" or "Live: 2nd Q"
}

// New England's major pro teams and their ESPN API identifiers
const TEAMS: { key: string; name: string; emoji: string; accent: string; sport: string; league: string; team: string }[] = [
  { key: 'ne',  name: 'Patriots', emoji: '🏈', accent: 'border-blue-700',  sport: 'football',   league: 'nfl', team: 'ne' },
  { key: 'bos-mlb', name: 'Red Sox',  emoji: '⚾', accent: 'border-red-600',   sport: 'baseball',   league: 'mlb', team: 'bos' },
  { key: 'bos-nba', name: 'Celtics',  emoji: '🏀', accent: 'border-green-600', sport: 'basketball', league: 'nba', team: 'bos' },
  { key: 'bos-nhl', name: 'Bruins',   emoji: '🏒', accent: 'border-yellow-500',sport: 'hockey',     league: 'nhl', team: 'bos' },
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
    // Find the "other" team relative to ours isn't reliable without our own id, so use shortName
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

    return { line, detail: detail || 'Schedule pending' };
  } catch {
    return { line: 'Schedule unavailable', detail: '' };
  }
}

export default function Sports({ config }: SportsProps) {
  const [results, setResults] = useState<TeamResult[]>(
    TEAMS.map((t) => ({ key: t.key, name: t.name, emoji: t.emoji, accent: t.accent, record: null, status: 'loading', line: '', detail: '' }))
  );

  useEffect(() => {
    let cancelled = false;

    const fetchTeam = async (t: typeof TEAMS[number]) => {
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${t.sport}/${t.league}/teams/${t.team}`);
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        const team = data?.team;
        const record = team?.record?.items?.[0]?.summary || null;
        const nextEvent = team?.nextEvent?.[0];
        const { line, detail } = nextEvent ? formatEvent(nextEvent) : { line: 'No upcoming game', detail: 'Off-season or schedule pending' };

        if (!cancelled) {
          setResults((prev) => prev.map((r) => r.key === t.key
            ? { ...r, status: 'ok', record, line, detail }
            : r));
        }
      } catch {
        if (!cancelled) {
          setResults((prev) => prev.map((r) => r.key === t.key ? { ...r, status: 'error' } : r));
        }
      }
    };

    TEAMS.forEach((t) => fetchTeam(t));

    const interval = setInterval(() => TEAMS.forEach((t) => fetchTeam(t)), 900000); // refresh every 15 min
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {results.map((r) => (
        <div key={r.key} className={`p-2.5 bg-gray-50 dark:bg-slate-700 rounded-lg border-l-4 ${r.accent}`}>
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
          </div>
        </div>
      ))}
    </div>
  );
}
