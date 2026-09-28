import { useCallback, useEffect, useRef, useState } from 'react';

// Everything the games share about a game in progress: it's saved per browser
// (so leaving the tab and coming back resumes it), Undo, a move counter, a
// timer that runs from your first move until the game ends, and stats kept in
// the widget config (so they sync with the rest of the portal).

export interface Stats { played: number; won: number; bestMs: number | null; bestMoves: number | null }
export interface Session<S> {
  game: S;
  elapsedMs: number;
  moves: number;
  started: boolean;
  won: boolean;
  lost: boolean;
}

const EMPTY_STATS: Stats = { played: 0, won: 0, bestMs: null, bestMoves: null };
const MAX_UNDO = 400;

interface Options<S> {
  storageKey: string;                 // localStorage key for the game in progress
  create: () => S;                    // a fresh game
  isValid: (g: any) => boolean;       // rejects a damaged saved game
  isWon: (g: S) => boolean;
  config: Record<string, any>;
  onUpdateConfig: (c: Record<string, any>) => void;
  statsKey?: string;                  // separate stats per level (e.g. 'expert'); omit for one set
  undoable?: boolean;                 // false turns Undo (and Ctrl+Z) off, e.g. Minesweeper
}

export function useGameSession<S>({ storageKey, create, isValid, isWon, config, onUpdateConfig, statsKey, undoable = true }: Options<S>) {
  const fresh = (): Session<S> => ({ game: create(), elapsedMs: 0, moves: 0, started: false, won: false, lost: false });
  const [session, setSession] = useState<Session<S>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const s = raw ? JSON.parse(raw) : null;
      if (s && isValid(s.game)) return { moves: 0, lost: false, ...s };
    } catch { /* unreadable: start fresh */ }
    return fresh();
  });
  const ref = useRef(session);
  ref.current = session;
  const history = useRef<S[]>([]);
  const cfgRef = useRef(config);
  cfgRef.current = config;

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(session)); } catch { /* storage full or blocked */ }
  }, [storageKey, session]);

  // Timer: counts only while the page is visible and the game is live.
  const live = session.started && !session.won && !session.lost;
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') setSession((s) => ({ ...s, elapsedMs: s.elapsedMs + 1000 }));
    }, 1000);
    return () => clearInterval(t);
  }, [live]);

  const readStats = useCallback((): Stats => {
    const c = cfgRef.current;
    const raw = statsKey ? c.statsBy?.[statsKey] : c.stats;
    return { ...EMPTY_STATS, ...(raw || {}) };
  }, [statsKey]);
  const writeStats = useCallback((st: Stats) => {
    const c = cfgRef.current;
    onUpdateConfig(statsKey ? { ...c, statsBy: { ...(c.statsBy || {}), [statsKey]: st } } : { ...c, stats: st });
  }, [onUpdateConfig, statsKey]);

  const set = useCallback((n: Session<S>) => { ref.current = n; setSession(n); }, []);

  // Apply a new game state. `lost` ends the game without a win (Minesweeper).
  const apply = useCallback((next: S | null, opts: { lost?: boolean; countMove?: boolean } = {}) => {
    if (!next) return false;
    const s = ref.current;
    if (s.won || s.lost) return false;
    history.current.push(s.game);
    if (history.current.length > MAX_UNDO) history.current.shift();
    const won = !opts.lost && isWon(next);
    const moves = s.moves + (opts.countMove === false ? 0 : 1);
    if (!s.started || won) {
      const st = readStats();
      if (!s.started) st.played += 1; // a game counts once you make a move
      if (won) {
        st.won += 1;
        st.bestMs = st.bestMs == null ? s.elapsedMs : Math.min(st.bestMs, s.elapsedMs);
        st.bestMoves = st.bestMoves == null ? moves : Math.min(st.bestMoves, moves);
      }
      writeStats(st);
    }
    set({ ...s, game: next, moves, started: true, won, lost: !!opts.lost });
    return true;
  }, [isWon, readStats, writeStats, set]);

  // Change the game without it being an undo step or a move (e.g. a hint).
  const replace = useCallback((next: S) => set({ ...ref.current, game: next }), [set]);

  const undo = useCallback(() => {
    const s = ref.current;
    if (s.won || !undoable) return;
    const prev = history.current.pop();
    if (prev === undefined) return;
    set({ ...s, game: prev, moves: s.moves + 1, lost: false });
  }, [set, undoable]);

  const newGame = useCallback((make?: () => S) => {
    history.current = [];
    set({ game: (make || create)(), elapsedMs: 0, moves: 0, started: false, won: false, lost: false });
  }, [create, set]);

  // Ctrl+Z / Cmd+Z undoes, unless you're typing somewhere.
  useEffect(() => {
    if (!undoable) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [undo, undoable]);

  return {
    session,
    game: session.game,
    apply,
    replace,
    undo,
    canUndo: undoable && history.current.length > 0 && !session.won,
    newGame,
    stats: readStats(),
  };
}

export const fmtTime = (ms: number) => {
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};
