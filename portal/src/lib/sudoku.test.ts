import { newPuzzle, countSolutions, setValue, toggleNote, conflicts, isWon, PEERS } from './sudoku';

test('generated puzzles have exactly one solution, and fewer clues when harder', () => {
  const easy = newPuzzle('easy', 11);
  const hard = newPuzzle('hard', 11);
  expect(countSolutions(easy.values)).toBe(1);
  expect(countSolutions(hard.values)).toBe(1);
  const clues = (s: typeof easy) => s.values.filter(Boolean).length;
  expect(clues(easy)).toBe(38);
  expect(clues(hard)).toBeLessThan(33);
  expect(conflicts(easy.solution).size).toBe(0);
  expect(easy.values.every((v, i) => !v || v === easy.solution[i])).toBe(true);
});

test('placing numbers, clashes, pencil marks and winning', () => {
  let s = newPuzzle('easy', 5);
  const empty = s.values.findIndex((v) => !v);
  const peer = PEERS[empty].find((p) => s.values[p])!;
  const clash = setValue(s, empty, s.values[peer])!;
  expect(conflicts(clash.values).has(empty)).toBe(true);
  expect(setValue(s, s.values.findIndex(Boolean), 1)).toBeNull(); // givens can't change
  const other = PEERS[empty].find((p) => !s.values[p])!;
  s = toggleNote(s, other, s.solution[empty])!;
  s = setValue(s, empty, s.solution[empty])!;
  expect(s.notes[other] & (1 << s.solution[empty])).toBe(0); // mark cleared from peers
  s.solution.forEach((v, i) => { if (!s.values[i]) s = setValue(s, i, v)!; });
  expect(isWon(s)).toBe(true);
});
