// Minesweeper rules. Mines are placed after your first click, never on or
// next to it, so the first click always opens an area.

import { rng, shuffle, newSeed } from './cardDeck';

export type Level = 'beginner' | 'intermediate' | 'expert';
export const LEVELS: Record<Level, { rows: number; cols: number; mines: number; label: string }> = {
  beginner: { rows: 9, cols: 9, mines: 10, label: 'Beginner' },
  intermediate: { rows: 16, cols: 16, mines: 40, label: 'Intermediate' },
  expert: { rows: 16, cols: 30, mines: 99, label: 'Expert' },
};

export interface MinesState {
  level: Level;
  rows: number;
  cols: number;
  mineCount: number;
  mines: number[];       // cell indexes; empty until the first click
  open: boolean[];
  flag: boolean[];
  exploded: number | null;
  seed: number;
}

export function newGame(level: Level, seed = newSeed()): MinesState {
  const { rows, cols, mines } = LEVELS[level];
  return { level, rows, cols, mineCount: mines, mines: [], open: Array(rows * cols).fill(false), flag: Array(rows * cols).fill(false), exploded: null, seed };
}

export function neighbors(s: { rows: number; cols: number }, i: number): number[] {
  const r = Math.floor(i / s.cols), c = i % s.cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < s.rows && cc >= 0 && cc < s.cols) out.push(rr * s.cols + cc);
  }
  return out;
}

export const mineSet = (s: MinesState) => new Set(s.mines);
export function countAround(s: MinesState, i: number, mines = mineSet(s)): number {
  return neighbors(s, i).filter((n) => mines.has(n)).length;
}

function placeMines(s: MinesState, first: number): number[] {
  const keepClear = new Set([first, ...neighbors(s, first)]);
  const candidates = Array.from({ length: s.rows * s.cols }, (_, i) => i).filter((i) => !keepClear.has(i));
  return shuffle(candidates, rng(s.seed)).slice(0, s.mineCount);
}

// Open a cell (and, for a blank one, everything around it). Returns the new
// state and whether you hit a mine.
export function reveal(s: MinesState, i: number): { state: MinesState; boom: boolean } | null {
  if (s.open[i] || s.flag[i] || s.exploded !== null) return null;
  const n: MinesState = { ...s, open: [...s.open], flag: [...s.flag], mines: s.mines.length ? s.mines : placeMines(s, i) };
  const mines = mineSet(n);
  if (mines.has(i)) {
    n.exploded = i;
    n.mines.forEach((m) => { if (!n.flag[m]) n.open[m] = true; });
    n.open[i] = true;
    return { state: n, boom: true };
  }
  const stack = [i];
  while (stack.length) {
    const cur = stack.pop()!;
    if (n.open[cur] || n.flag[cur]) continue;
    n.open[cur] = true;
    if (countAround(n, cur, mines) === 0) neighbors(n, cur).forEach((nb) => { if (!n.open[nb] && !mines.has(nb)) stack.push(nb); });
  }
  return { state: n, boom: false };
}

export function toggleFlag(s: MinesState, i: number): MinesState | null {
  if (s.open[i] || s.exploded !== null) return null;
  const flag = [...s.flag];
  flag[i] = !flag[i];
  return { ...s, flag };
}

// Clicking an opened number whose mines are all flagged opens the rest of
// its neighbours.
export function chord(s: MinesState, i: number): { state: MinesState; boom: boolean } | null {
  if (!s.open[i] || s.exploded !== null) return null;
  const mines = mineSet(s);
  const around = neighbors(s, i);
  const need = countAround(s, i, mines);
  if (!need || around.filter((n) => s.flag[n]).length !== need) return null;
  let cur = s;
  let changed = false;
  for (const nb of around) {
    if (cur.open[nb] || cur.flag[nb]) continue;
    const r = reveal(cur, nb);
    if (!r) continue;
    cur = r.state;
    changed = true;
    if (r.boom) return { state: cur, boom: true };
  }
  return changed ? { state: cur, boom: false } : null;
}

export function isWon(s: MinesState): boolean {
  if (!s.mines.length || s.exploded !== null) return false;
  const mines = mineSet(s);
  return s.open.every((o, i) => o || mines.has(i));
}

export function isValidState(s: any): s is MinesState {
  try {
    return s.level in LEVELS && s.open.length === s.rows * s.cols && s.flag.length === s.open.length && Array.isArray(s.mines);
  } catch { return false; }
}
