import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Eraser, Lightbulb } from 'lucide-react';
import { SudokuState, Difficulty, DIFFICULTY, newPuzzle, setValue, toggleNote, conflicts, isWon, isValidState } from '../../lib/sudoku';
import { useGameSession } from './useGameSession';
import GameShell, { Segmented, gameBtn, plainBtn } from './GameShell';
import { useBoardWidth } from './cards';

// Sudoku. Click a square, then a number (on screen or the keyboard). Notes mode
// adds pencil marks instead. Numbers that clash in a row, column or box turn
// red. Keyboard: 1-9, Backspace/Delete to clear, arrows to move, N for notes.

type Props = { config: Record<string, any>; onUpdateConfig: (c: Record<string, any>) => void };

export default function Sudoku({ config, onUpdateConfig }: Props) {
  const difficulty: Difficulty = config.difficulty in DIFFICULTY ? config.difficulty : 'easy';
  const { session, game, apply, undo, canUndo, newGame, stats } = useGameSession<SudokuState>({
    storageKey: 'pw6-game-sudoku',
    create: () => newPuzzle(difficulty),
    isValid: isValidState,
    isWon,
    config,
    onUpdateConfig,
    statsKey: difficulty,
  });
  const [sel, setSel] = useState<number | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const bad = useMemo(() => conflicts(game.values), [game.values]);

  const { ref: boardRef, width } = useBoardWidth();
  const cell = Math.max(30, Math.min(56, Math.floor(Math.min(width, 520) / 9)));

  const setDifficulty = (d: Difficulty) => {
    if (d === difficulty && game.difficulty === d) return;
    onUpdateConfig({ ...config, difficulty: d });
    newGame(() => newPuzzle(d));
  };

  const enter = (v: number) => {
    if (sel === null || session.won) return;
    if (notesMode && v) apply(toggleNote(game, sel, v), { countMove: false });
    else apply(setValue(game, sel, v));
  };
  const hint = () => {
    if (session.won) return;
    const target = sel !== null && !game.givens[sel] && game.values[sel] !== game.solution[sel]
      ? sel
      : game.values.findIndex((v, i) => v !== game.solution[i]);
    if (target < 0) return;
    setSel(target);
    apply(setValue(game, target, game.solution[target]));
  };

  // Keyboard entry while this game is on screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key)) { e.preventDefault(); enter(Number(e.key)); return; }
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { e.preventDefault(); enter(0); return; }
      if (e.key.toLowerCase() === 'n') { setNotesMode((m) => !m); return; }
      const d = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (d !== undefined) {
        e.preventDefault();
        setSel((s) => {
          if (s === null) return 0;
          const next = s + d;
          if (d === -1 && s % 9 === 0) return s;
          if (d === 1 && s % 9 === 8) return s;
          return next < 0 || next > 80 ? s : next;
        });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const selVal = sel !== null ? game.values[sel] : 0;
  const sameGroup = (i: number) => sel !== null && (
    Math.floor(i / 9) === Math.floor(sel / 9) || i % 9 === sel % 9
    || (Math.floor(i / 27) === Math.floor(sel / 27) && Math.floor((i % 9) / 3) === Math.floor((sel % 9) / 3)));
  const counts = Array.from({ length: 10 }, (_, v) => game.values.filter((x) => x === v).length);

  return (
    <GameShell
      onNew={() => newGame(() => newPuzzle(difficulty))}
      onUndo={undo}
      canUndo={canUndo}
      controls={<>
        <Segmented value={difficulty} onChange={setDifficulty}
          options={(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => ({ value: d, label: DIFFICULTY[d].label }))} />
        <button onClick={hint} disabled={session.won} className={plainBtn} title="Fill in one square"><Lightbulb size={13} /> Hint</button>
      </>}
      elapsedMs={session.elapsedMs}
      won={session.won}
      wonDetail={<>{DIFFICULTY[game.difficulty].label} puzzle solved</>}
      help="Click a square, then a number. Notes adds pencil marks. Keyboard: 1-9, Backspace to clear, arrows to move, N for notes."
      stats={stats}
      showBestMoves={false}
    >
      <div ref={boardRef} className="w-full flex flex-col md:flex-row items-center md:items-start justify-center gap-5">
        <div className="grid select-none border-2 border-zinc-800 dark:border-zinc-300 rounded-md overflow-hidden"
          style={{ gridTemplateColumns: `repeat(9, ${cell}px)` }}>
          {game.values.map((v, i) => {
            const r = Math.floor(i / 9), c = i % 9;
            const isSel = sel === i;
            const same = !!v && v === selVal;
            const bg = isSel ? 'bg-indigo-200 dark:bg-indigo-800'
              : same ? 'bg-indigo-100 dark:bg-indigo-900/70'
              : sameGroup(i) ? 'bg-zinc-100 dark:bg-zinc-800'
              : 'bg-white dark:bg-zinc-900';
            return (
              <button key={i} onClick={() => setSel(i)}
                className={`relative flex items-center justify-center ${bg}`}
                style={{
                  width: cell, height: cell,
                  borderRight: c === 8 ? undefined : `${c % 3 === 2 ? 2 : 1}px solid ${c % 3 === 2 ? 'rgb(63 63 70)' : 'rgb(212 212 216)'}`,
                  borderBottom: r === 8 ? undefined : `${r % 3 === 2 ? 2 : 1}px solid ${r % 3 === 2 ? 'rgb(63 63 70)' : 'rgb(212 212 216)'}`,
                }}>
                {v ? (
                  <span style={{ fontSize: cell * 0.55 }}
                    className={`${bad.has(i) ? 'text-red-600' : game.givens[i] ? 'text-zinc-900 dark:text-zinc-100 font-semibold' : 'text-indigo-600 dark:text-indigo-300'}`}>
                    {v}
                  </span>
                ) : game.notes[i] ? (
                  <div className="absolute inset-0 grid grid-cols-3 p-[2px] text-zinc-500 dark:text-zinc-400" style={{ fontSize: cell * 0.22 }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <span key={n} className="flex items-center justify-center leading-none">{game.notes[i] & (1 << n) ? n : ''}</span>
                    ))}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex md:flex-col gap-3 items-center">
          <div className="grid grid-cols-9 md:grid-cols-3 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button key={n} onClick={() => enter(n)} disabled={counts[n] >= 9 && !notesMode}
                className="rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-zinc-800 dark:text-zinc-100 font-semibold disabled:opacity-30"
                style={{ width: Math.max(32, cell * 0.9), height: Math.max(32, cell * 0.9), fontSize: Math.max(15, cell * 0.4) }}>
                {n}
              </button>
            ))}
          </div>
          <div className="flex md:flex-row gap-1.5">
            <button onClick={() => setNotesMode(!notesMode)} title="Notes (N)"
              className={`${gameBtn} ${notesMode ? 'bg-amber-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200'}`}>
              <Pencil size={13} /> Notes {notesMode ? 'on' : 'off'}
            </button>
            <button onClick={() => enter(0)} className={plainBtn}><Eraser size={13} /> Erase</button>
          </div>
        </div>
      </div>
    </GameShell>
  );
}
