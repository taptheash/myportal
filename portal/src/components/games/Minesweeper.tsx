import React, { useMemo } from 'react';
import { Bomb, Flag } from 'lucide-react';
import { MinesState, Level, LEVELS, newGame as freshGame, reveal, toggleFlag, chord, countAround, mineSet, isWon, isValidState } from '../../lib/minesweeper';
import { useGameSession } from './useGameSession';
import GameShell, { Segmented, gameBtn } from './GameShell';
import { useBoardWidth } from './cards';

// Minesweeper. Left-click opens a square, right-click flags it. Clicking an
// opened number whose mines are all flagged opens the rest around it. On a
// touch screen, switch on Flag mode to flag with a tap. No undo here.

type Props = { config: Record<string, any>; onUpdateConfig: (c: Record<string, any>) => void };

const NUM_COLOR = ['', '#2563eb', '#16a34a', '#dc2626', '#1e3a8a', '#7f1d1d', '#0f766e', '#18181b', '#71717a'];

export default function Minesweeper({ config, onUpdateConfig }: Props) {
  const level: Level = config.level in LEVELS ? config.level : 'beginner';
  const flagMode = !!config.flagMode;
  const { session, game, apply, newGame, stats } = useGameSession<MinesState>({
    storageKey: 'pw6-game-minesweeper',
    create: () => freshGame(level),
    isValid: isValidState,
    isWon,
    config,
    onUpdateConfig,
    statsKey: level,
    undoable: false,
  });
  // A saved game from another level still plays at its own size.
  const over = session.won || session.lost;

  const { ref: boardRef, width } = useBoardWidth();
  const size = Math.max(18, Math.min(32, Math.floor(width / game.cols)));
  const mines = useMemo(() => mineSet(game), [game]);
  const flags = game.flag.filter(Boolean).length;

  const setLevel = (l: Level) => {
    if (l === level && game.level === l) return;
    onUpdateConfig({ ...config, level: l });
    newGame(() => freshGame(l));
  };

  const open = (i: number) => {
    if (over) return;
    if (flagMode && !game.open[i]) { apply(toggleFlag(game, i), { countMove: false }); return; }
    const r = game.open[i] ? chord(game, i) : reveal(game, i);
    if (r) apply(r.state, { lost: r.boom });
  };
  const flag = (e: React.MouseEvent, i: number) => {
    e.preventDefault();
    if (!over) apply(toggleFlag(game, i), { countMove: false });
  };

  return (
    <GameShell
      onNew={() => newGame(() => freshGame(level))}
      controls={<>
        <Segmented value={level} onChange={setLevel}
          options={(Object.keys(LEVELS) as Level[]).map((l) => ({ value: l, label: LEVELS[l].label }))} />
        <button onClick={() => onUpdateConfig({ ...config, flagMode: !flagMode })} title="For touch screens: tap to flag instead of open"
          className={`${gameBtn} ${flagMode ? 'bg-amber-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>
          <Flag size={13} /> Flag mode
        </button>
      </>}
      status={<span className="flex items-center gap-1"><Bomb size={13} /> {game.mineCount - flags}</span>}
      elapsedMs={session.elapsedMs}
      won={session.won}
      lost={session.lost}
      lostText="Boom! You hit a mine"
      wonDetail={<>{LEVELS[game.level].label} cleared</>}
      help="Left-click to open, right-click to flag. Click a number whose mines are all flagged to open the squares around it. The first click is always safe."
      stats={stats}
      showBestMoves={false}
    >
      <div ref={boardRef} className="w-full">
        <div className="mx-auto inline-grid rounded-lg overflow-hidden border-2 border-zinc-400 dark:border-zinc-600 select-none"
          style={{ gridTemplateColumns: `repeat(${game.cols}, ${size}px)`, display: 'grid', width: game.cols * size + 4, marginLeft: 'auto', marginRight: 'auto' }}
          onContextMenu={(e) => e.preventDefault()}>
          {game.open.map((isOpen, i) => {
            const isMine = mines.has(i);
            const n = isOpen && !isMine ? countAround(game, i, mines) : 0;
            const wrongFlag = session.lost && game.flag[i] && !isMine;
            return (
              <button key={i} onClick={() => open(i)} onContextMenu={(e) => flag(e, i)}
                className="flex items-center justify-center font-bold leading-none"
                style={{
                  width: size, height: size, fontSize: size * 0.58,
                  background: !isOpen ? 'linear-gradient(145deg,#e4e4e7,#c4c4c8)' : i === game.exploded ? '#ef4444' : '#f4f4f5',
                  boxShadow: !isOpen ? 'inset 1px 1px 0 #fff, inset -1px -1px 0 #9ca3af' : 'inset 0 0 0 0.5px #d4d4d8',
                  color: NUM_COLOR[n],
                  cursor: over ? 'default' : 'pointer',
                }}>
                {isOpen
                  ? isMine ? <Bomb size={size * 0.6} className="text-zinc-900" /> : n || ''
                  : game.flag[i] ? <Flag size={size * 0.55} className={wrongFlag ? 'text-zinc-500' : 'text-red-600'} fill={wrongFlag ? 'none' : 'currentColor'} /> : ''}
              </button>
            );
          })}
        </div>
      </div>
    </GameShell>
  );
}
