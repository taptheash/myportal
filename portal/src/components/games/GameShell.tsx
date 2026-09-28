import React from 'react';
import { RotateCcw, Undo2, Trophy, Frown } from 'lucide-react';
import { Stats, fmtTime } from './useGameSession';

// The frame every game sits in: a controls row (New game, Undo, any
// game-specific buttons, moves and time), the board, a win/lose card over the
// board, and a line of help and stats underneath.

export const gameBtn = 'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150';
export const plainBtn = `${gameBtn} bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-default`;

// A small segmented picker (Draw 1/3, difficulty...).
export function Segmented<T extends string | number>({ value, options, onChange, title }: {
  value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; title?: string;
}) {
  return (
    <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5" title={title}>
      {options.map((o) => (
        <button key={String(o.value)} onClick={() => onChange(o.value)}
          className={`${gameBtn} ${value === o.value ? 'bg-white dark:bg-zinc-950 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface Props {
  onNew: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  controls?: React.ReactNode;     // game-specific buttons, after New/Undo
  status?: React.ReactNode;       // right side, before moves/time (e.g. mines left)
  moves?: number;                 // omit to hide the move counter
  elapsedMs: number;
  won: boolean;
  lost?: boolean;
  lostText?: string;
  wonDetail?: React.ReactNode;
  help: React.ReactNode;
  stats: Stats;
  showBestMoves?: boolean;
  children: React.ReactNode;
}

export default function GameShell({
  onNew, onUndo, canUndo, controls, status, moves, elapsedMs, won, lost, lostText, wonDetail, help, stats, showBestMoves = true, children,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onNew} className={`${gameBtn} bg-indigo-600 hover:bg-indigo-500 text-white`}>
          <RotateCcw size={13} /> New game
        </button>
        {onUndo && (
          <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" className={plainBtn}>
            <Undo2 size={13} /> Undo
          </button>
        )}
        {controls}
        <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
          {status}
          {moves !== undefined && <span>Moves {moves}</span>}
          <span>{fmtTime(elapsedMs)}</span>
        </div>
      </div>

      <div className="relative">
        {children}
        {(won || lost) && (
          <div className="absolute inset-0 rounded-xl bg-black/45 flex items-center justify-center z-[50]">
            <div className="rounded-2xl bg-white dark:bg-zinc-900 px-8 py-6 text-center shadow-2xl">
              {won ? <Trophy size={36} className="mx-auto text-amber-500" /> : <Frown size={36} className="mx-auto text-zinc-400" />}
              <div className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">{won ? 'You won!' : lostText || 'Game over'}</div>
              <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {wonDetail ?? <>{moves !== undefined && <>{moves} moves · </>}{fmtTime(elapsedMs)}</>}
              </div>
              <div className="mt-4 flex items-center justify-center gap-2">
                {lost && onUndo && (
                  <button onClick={onUndo} className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-sm font-medium">Undo</button>
                )}
                <button onClick={onNew} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium">
                  {won ? 'Deal again' : 'New game'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
        {help} Games won {stats.won} of {stats.played}
        {stats.bestMs != null && <> · best time {fmtTime(stats.bestMs)}</>}
        {showBestMoves && stats.bestMoves != null && <> · fewest moves {stats.bestMoves}</>}.
      </p>
    </div>
  );
}

// The green card table.
export function Felt({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-xl p-3 sm:p-4 select-none ${className}`}
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #2f8a55 0%, #1f6b41 60%, #175233 100%)', touchAction: 'none' }}>
      {children}
    </div>
  );
}
