// Sudoku: puzzle generation (always exactly one solution) and the rules.
// A full grid is filled at random, then numbers are taken away one at a time,
// keeping each removal only if the puzzle still has a single answer.

import { rng, shuffle, newSeed } from './cardDeck';

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTY: Record<Difficulty, { clues: number; label: string }> = {
  easy: { clues: 38, label: 'Easy' },
  medium: { clues: 31, label: 'Medium' },
  hard: { clues: 25, label: 'Hard' },
};

export interface SudokuState {
  difficulty: Difficulty;
  givens: boolean[];   // 81, the numbers you started with
  values: number[];    // 81, 0 = empty
  notes: number[];     // 81, bit n set = pencil mark n
  solution: number[];  // 81
  seed: number;
}

const row = (i: number) => Math.floor(i / 9);
const col = (i: number) => i % 9;
const box = (i: number) => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);

// The 20 cells that share a row, column or box with cell i.
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) =>
  Array.from({ length: 81 }, (_, j) => j).filter((j) => j !== i && (row(j) === row(i) || col(j) === col(i) || box(j) === box(i))));

function candidates(grid: number[], i: number): number[] {
  const used = new Set(PEERS[i].map((p) => grid[p]));
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((v) => !used.has(v));
}

// Counts solutions, stopping at `limit`. Always fills the cell with the
// fewest options first, which keeps it fast.
export function countSolutions(grid: number[], limit = 2): number {
  const g = [...grid];
  let count = 0;
  const solve = (): boolean => {
    let best = -1, bestOpts: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const opts = candidates(g, i);
      if (!opts.length) return false;
      if (best < 0 || opts.length < bestOpts.length) { best = i; bestOpts = opts; if (opts.length === 1) break; }
    }
    if (best < 0) { count++; return count >= limit; }
    for (const v of bestOpts) {
      g[best] = v;
      if (solve()) return true;
    }
    g[best] = 0;
    return false;
  };
  solve();
  return count;
}

function fullGrid(rand: () => number): number[] {
  const g = Array(81).fill(0);
  const fill = (i: number): boolean => {
    if (i === 81) return true;
    for (const v of shuffle(candidates(g, i), rand)) {
      g[i] = v;
      if (fill(i + 1)) return true;
    }
    g[i] = 0;
    return false;
  };
  fill(0);
  return g;
}

export function newPuzzle(difficulty: Difficulty, seed = newSeed()): SudokuState {
  const rand = rng(seed);
  const solution = fullGrid(rand);
  const grid = [...solution];
  let clues = 81;
  for (const i of shuffle(Array.from({ length: 81 }, (_, k) => k), rand)) {
    if (clues <= DIFFICULTY[difficulty].clues) break;
    const keep = grid[i];
    grid[i] = 0;
    if (countSolutions(grid) !== 1) grid[i] = keep;
    else clues--;
  }
  return { difficulty, givens: grid.map((v) => v > 0), values: grid, notes: Array(81).fill(0), solution, seed };
}

export function setValue(s: SudokuState, i: number, v: number): SudokuState | null {
  if (s.givens[i] || s.values[i] === v) return null;
  const values = [...s.values];
  values[i] = v;
  const notes = [...s.notes];
  notes[i] = 0;
  // Placing a number clears that pencil mark from its row, column and box.
  if (v) PEERS[i].forEach((p) => { notes[p] &= ~(1 << v); });
  return { ...s, values, notes };
}

export function toggleNote(s: SudokuState, i: number, v: number): SudokuState | null {
  if (s.givens[i] || s.values[i]) return null;
  const notes = [...s.notes];
  notes[i] ^= 1 << v;
  return { ...s, notes };
}

// Cells whose number clashes with another in the same row, column or box.
export function conflicts(values: number[]): Set<number> {
  const bad = new Set<number>();
  for (let i = 0; i < 81; i++) if (values[i] && PEERS[i].some((p) => values[p] === values[i])) bad.add(i);
  return bad;
}

export const isWon = (s: SudokuState) => s.values.every((v, i) => v === s.solution[i]);

export function isValidState(s: any): s is SudokuState {
  try {
    return s.difficulty in DIFFICULTY && s.values.length === 81 && s.solution.length === 81 && s.notes.length === 81 && s.givens.length === 81;
  } catch { return false; }
}
