import { newGame, reveal, toggleFlag, chord, isWon, countAround, neighbors, MinesState } from './minesweeper';

test('the first click is never a mine and always opens an area', () => {
  for (let seed = 1; seed < 40; seed++) {
    const s = newGame('expert', seed);
    const r = reveal(s, 200)!;
    expect(r.boom).toBe(false);
    expect(r.state.mines).toHaveLength(99);
    expect(countAround(r.state, 200)).toBe(0);
    expect(r.state.open.filter(Boolean).length).toBeGreaterThan(1);
  }
});

const fixed = (mines: number[]): MinesState => ({ level: 'beginner', rows: 3, cols: 3, mineCount: mines.length, mines, open: Array(9).fill(false), flag: Array(9).fill(false), exploded: null, seed: 1 });

test('hitting a mine ends the game and shows the mines', () => {
  const r = reveal(fixed([4]), 4)!;
  expect(r.boom).toBe(true);
  expect(r.state.exploded).toBe(4);
  expect(reveal(r.state, 0)).toBeNull();
});

test('flags block opening; a fully flagged number opens its neighbours', () => {
  let s = fixed([0]);
  s = reveal(s, 4)!.state;               // "1" in the middle
  expect(s.open.filter(Boolean)).toHaveLength(1);
  s = toggleFlag(s, 0)!;
  expect(reveal(s, 0)).toBeNull();
  s = chord(s, 4)!.state;
  expect(isWon(s)).toBe(true);
});

test('neighbours at the edges', () => {
  expect(neighbors({ rows: 3, cols: 3 }, 0).sort()).toEqual([1, 3, 4]);
  expect(neighbors({ rows: 3, cols: 3 }, 4)).toHaveLength(8);
});
