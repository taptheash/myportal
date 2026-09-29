import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChessState, Color, Move, Level, LEVELS, newGame as startPosition, legalMoves, makeMove, outcome, san, inCheck,
  kingSquare, bestMove, isValidState as isValidPosition,
} from '../../lib/chess';
import { useGameSession } from './useGameSession';
import GameShell, { Segmented } from './GameShell';
import { useBoardWidth } from './cards';

// Chess against the computer. Click a piece, then where it should go (the
// dots show legal moves). Undo takes back your move and the computer's reply.
// The computer thinks in a background worker so the page never freezes.

type Props = { config: Record<string, any>; onUpdateConfig: (c: Record<string, any>) => void };

interface Game {
  pos: ChessState;
  player: Color;
  level: Level;
  sans: string[];                      // moves so far, in notation
  last: { from: number; to: number } | null;
}

// Filled glyphs for both sides (coloured below); ︎ keeps them as text,
// not emoji.
const GLYPH: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const glyph = (p: string) => `${GLYPH[p.toLowerCase()]}︎`;

const fresh = (player: Color, level: Level): Game => ({ pos: startPosition(), player, level, sans: [], last: null });

function useComputer() {
  const worker = useRef<Worker | null>(null);
  const seq = useRef(0);
  useEffect(() => {
    try { worker.current = new Worker(new URL('../../lib/chess.worker.ts', import.meta.url)); } catch { worker.current = null; }
    return () => worker.current?.terminate();
  }, []);
  // Resolves with the computer's move (or null if superseded).
  return (state: ChessState, level: Level) => new Promise<Move | null>((resolve) => {
    const id = ++seq.current;
    const w = worker.current;
    if (!w) { setTimeout(() => resolve(bestMove(state, LEVELS[level])), 30); return; }
    const onMsg = (e: MessageEvent) => {
      if (e.data.id !== id) return;
      w.removeEventListener('message', onMsg);
      resolve(id === seq.current ? e.data.move : null);
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ id, state, level });
  });
}

export default function Chess({ config, onUpdateConfig }: Props) {
  const level: Level = config.level in LEVELS ? config.level : 'medium';
  const playAs: Color = config.playAs === 'b' ? 'b' : 'w';
  const { session, game, apply, undo, canUndo, newGame, stats } = useGameSession<Game>({
    storageKey: 'pw6-game-chess',
    create: () => fresh(playAs, level),
    isValid: (g: any) => g && isValidPosition(g.pos) && (g.player === 'w' || g.player === 'b') && g.level in LEVELS,
    isWon: (g) => { const o = outcome(g.pos); return o.over && o.winner === g.player; },
    config,
    onUpdateConfig,
    statsKey: level,
  });
  const think = useComputer();
  const [selected, setSelected] = useState<number | null>(null);
  const [promo, setPromo] = useState<Move[] | null>(null);
  const [thinking, setThinking] = useState(false);

  const { pos, player } = game;
  const moves = useMemo(() => legalMoves(pos), [pos]);
  const result = useMemo(() => outcome(pos, moves), [pos, moves]);
  const over = session.won || session.lost || result.over;

  // Play a move (yours or the computer's) and record how the game ended.
  const play = (m: Move) => {
    const next = makeMove(pos, m);
    const g: Game = { ...game, pos: next, sans: [...game.sans, san(pos, m, moves)], last: { from: m.from, to: m.to } };
    const o = outcome(next);
    apply(g, { lost: o.over && o.winner !== player, countMove: pos.turn === player });
  };

  // Computer's turn.
  useEffect(() => {
    if (over || pos.turn === player) return;
    let live = true;
    setThinking(true);
    think(pos, game.level).then((m) => {
      if (!live) return;
      setThinking(false);
      if (m) play(m);
    });
    return () => { live = false; setThinking(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, player, over]);

  useEffect(() => { setSelected(null); setPromo(null); }, [pos]);

  const clickSquare = (sq: number) => {
    if (over || pos.turn !== player || thinking) return;
    const p = pos.board[sq];
    const mine = p && (p === p.toUpperCase() ? 'w' : 'b') === player;
    if (selected !== null) {
      const options = moves.filter((m) => m.from === selected && m.to === sq);
      if (options.length > 1) { setPromo(options); return; }
      if (options.length === 1) { play(options[0]); return; }
    }
    setSelected(mine && selected !== sq ? sq : null);
  };

  const gameRef = useRef(game);
  gameRef.current = game;
  const takeBack = () => {
    // Undo back to your turn: your last move plus the computer's reply.
    undo();
    setTimeout(() => { if (gameRef.current.pos.turn !== gameRef.current.player) undo(); }, 0);
  };

  const restart = (as: Color = playAs, lv: Level = level) => newGame(() => fresh(as, lv));
  const setLevel = (lv: Level) => { onUpdateConfig({ ...config, level: lv }); restart(playAs, lv); };
  const setSide = (c: Color) => { onUpdateConfig({ ...config, playAs: c }); restart(c, level); };

  const { ref: boardRef, width } = useBoardWidth();
  const size = Math.max(280, Math.min(560, width < 720 ? width : width - 260));
  const sq = size / 8;
  const flipped = player === 'b';
  const targets = new Set(selected !== null ? moves.filter((m) => m.from === selected).map((m) => m.to) : []);
  const checkSq = inCheck(pos) ? kingSquare(pos.board, pos.turn) : -1;

  const status = result.over
    ? result.reason
    : thinking ? 'Computer is thinking…'
    : pos.turn === player ? (inCheck(pos) ? 'Check! Your move' : 'Your move') : '';

  const rows = [];
  for (let k = 0; k < game.sans.length; k += 2) rows.push([game.sans[k], game.sans[k + 1]]);

  return (
    <GameShell
      onNew={() => restart()}
      onUndo={takeBack}
      canUndo={canUndo && !thinking}
      controls={<>
        <Segmented value={level} onChange={setLevel} title="Changing this starts a new game"
          options={(Object.keys(LEVELS) as Level[]).map((l) => ({ value: l, label: LEVELS[l].label }))} />
        <Segmented value={playAs} onChange={setSide} title="Changing this starts a new game"
          options={[{ value: 'w', label: 'Play white' }, { value: 'b', label: 'Play black' }]} />
      </>}
      moves={session.moves}
      elapsedMs={session.elapsedMs}
      won={session.won}
      lost={session.lost}
      lostText={result.over && result.winner === null ? result.reason : 'Checkmate. The computer wins'}
      wonDetail={<>Checkmate in {session.moves} moves ({LEVELS[game.level].label})</>}
      help="Click a piece, then a square to move it. Undo takes back your move and the computer's reply."
      stats={stats}
    >
      <div ref={boardRef} className="w-full flex flex-col md:flex-row gap-4 items-center md:items-start justify-center">
        <div className="relative select-none rounded-md overflow-hidden shadow-md" style={{ width: size, height: size }}>
          {Array.from({ length: 64 }, (_, view) => {
            const i = flipped ? 63 - view : view;
            const r = Math.floor(view / 8), f = view % 8;
            const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
            const p = pos.board[i];
            const isLast = game.last && (game.last.from === i || game.last.to === i);
            const bg = selected === i ? (dark ? '#bbcb2b' : '#f6f669')
              : isLast ? (dark ? '#aaa23a' : '#cdd26a')
              : dark ? '#b58863' : '#f0d9b5';
            return (
              <div key={i} onClick={() => clickSquare(i)} className="absolute flex items-center justify-center"
                style={{ left: f * sq, top: r * sq, width: sq, height: sq, background: bg, cursor: pos.turn === player && !over ? 'pointer' : 'default' }}>
                {i === checkSq && <div className="absolute inset-0" style={{ background: 'radial-gradient(circle, rgba(239,68,68,.9) 0%, rgba(239,68,68,.35) 55%, transparent 75%)' }} />}
                {f === 0 && <span className="absolute left-0.5 top-0 text-[10px] font-semibold" style={{ color: dark ? '#f0d9b5' : '#b58863' }}>{8 - Math.floor(i / 8)}</span>}
                {r === 7 && <span className="absolute right-1 bottom-0 text-[10px] font-semibold" style={{ color: dark ? '#f0d9b5' : '#b58863' }}>{'abcdefgh'[i % 8]}</span>}
                {p && (
                  <span className="relative leading-none" style={{
                    fontSize: sq * 0.78,
                    color: p === p.toUpperCase() ? '#fafafa' : '#1c1917',
                    textShadow: p === p.toUpperCase()
                      ? '0 0 1px #000, 0 0 1px #000, 0 0 1px #000, 0 1px 2px rgba(0,0,0,.5)'
                      : '0 0 1px #fff8, 0 1px 1px rgba(0,0,0,.3)',
                    fontFamily: "'Segoe UI Symbol','Noto Sans Symbols 2','DejaVu Sans',serif",
                  }}>{glyph(p)}</span>
                )}
                {targets.has(i) && (
                  <div className="absolute rounded-full" style={p
                    ? { inset: 2, border: `${Math.max(3, sq * 0.07)}px solid rgba(20,83,45,.45)` }
                    : { width: sq * 0.3, height: sq * 0.3, background: 'rgba(20,83,45,.4)' }} />
                )}
              </div>
            );
          })}
          {promo && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10" onClick={() => setPromo(null)}>
              <div className="flex gap-2 rounded-xl bg-white dark:bg-zinc-900 p-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
                {promo.map((m) => (
                  <button key={m.promo} onClick={() => play(m)} className="rounded-lg bg-[#f0d9b5] hover:bg-[#e2c595] flex items-center justify-center"
                    style={{ width: sq, height: sq, fontSize: sq * 0.7, color: player === 'w' ? '#fafafa' : '#1c1917', textShadow: player === 'w' ? '0 0 1px #000, 0 0 1px #000' : undefined }}>
                    {glyph(m.promo)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-full md:w-56 flex flex-col gap-2">
          <div className={`text-sm font-medium ${result.over ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'} min-h-[1.25rem]`}>{status}</div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 text-sm tabular-nums overflow-y-auto" style={{ maxHeight: Math.max(160, size - 40) }}>
            {rows.length === 0 ? (
              <div className="px-3 py-2 text-zinc-400 text-xs">{player === 'w' ? 'You play white. Your move.' : 'You play black. The computer moves first.'}</div>
            ) : rows.map(([w, b], k) => (
              <div key={k} className={`grid grid-cols-[2.2rem_1fr_1fr] px-2 py-0.5 ${k % 2 ? 'bg-zinc-50 dark:bg-zinc-900/60' : ''}`}>
                <span className="text-zinc-400">{k + 1}.</span>
                <span className="text-zinc-800 dark:text-zinc-100">{w}</span>
                <span className="text-zinc-800 dark:text-zinc-100">{b || ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GameShell>
  );
}
