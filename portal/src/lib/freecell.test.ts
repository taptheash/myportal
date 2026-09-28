import { newDeal, move, autoMove, autoPlaySafe, maxMovable, isValidState, isWon, FreeCellState, Card } from './freecell';

const c = (id: string): Card => ({ id, suit: id[0] as Card['suit'], rank: Number(id.slice(1)), up: true });
const empty = (): FreeCellState => ({ cells: [null, null, null, null], foundations: [[], [], [], []], tableau: [[], [], [], [], [], [], [], []], gameNo: 0 });

test('game numbers give the classic deals (Game #1 starts JD 2D 9H JC 5D 7H 7C 5H)', () => {
  const s = newDeal(1);
  expect(s.tableau.map((p) => p[0].id)).toEqual(['D11', 'D2', 'H9', 'C11', 'D5', 'H7', 'C7', 'H5']);
  expect(s.tableau.map((p) => p.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
  expect(isValidState(s)).toBe(true);
});

test('how many cards can move at once depends on free cells and empty columns', () => {
  const s = empty();
  expect(maxMovable(s, false)).toBe(5 * 2 ** 8);
  s.cells = [c('S1'), c('S2'), c('S3'), null];
  s.tableau = s.tableau.map((_, i) => [c(`H${i + 1}`)]);
  expect(maxMovable(s, false)).toBe(2);
  s.tableau[7] = [];
  expect(maxMovable(s, false)).toBe(4);
  expect(maxMovable(s, true)).toBe(2);
});

test('a run that is too long for the free space cannot move', () => {
  const s = empty();
  s.cells = [c('D1'), c('D2'), c('D3'), c('D4')]; // no free cells
  s.tableau = [[c('S9'), c('H8'), c('C7')], [c('H10')], [c('C1')], [c('C2')], [c('C3')], [c('C4')], [c('C5')], [c('C6')]];
  expect(move(s, { pile: 'tableau', i: 0, index: 0 }, { pile: 'tableau', i: 1 })).toBeNull();
  expect(move(s, { pile: 'tableau', i: 0, index: 2 }, { pile: 'tableau', i: 1 })).toBeNull(); // C7 not on H10
});

test('a click goes to foundation, then a column, then a free cell', () => {
  const s = empty();
  s.tableau[0] = [c('S5'), c('H1')];
  s.tableau[1] = [c('D9')];
  const a = autoMove(s, { pile: 'tableau', i: 0, index: 1 })!;
  expect(a.foundations.some((f) => f[0]?.id === 'H1')).toBe(true);
  // S5 is alone in its column: moving it to another empty column gains
  // nothing, so it goes to a free cell.
  const b = autoMove(a, { pile: 'tableau', i: 0, index: 0 })!;
  expect(b.cells[0]?.id).toBe('S5');
  // With a card under it, it goes to an empty column first.
  const d = empty();
  d.tableau[0] = [c('D8'), c('S5')];
  expect(autoMove(d, { pile: 'tableau', i: 0, index: 1 })!.tableau[1][0].id).toBe('S5');
});

test('safe cards go up by themselves, needed ones stay', () => {
  const s = empty();
  s.tableau[0] = [c('H3'), c('S1')];
  s.tableau[1] = [c('S2')];
  const n = autoPlaySafe(s);
  expect(n.foundations.flat().map((x) => x.id).sort()).toEqual(['S1', 'S2']);
  expect(n.tableau[0].map((x) => x.id)).toEqual(['H3']); // H3 stays: the black 2s it could hold aren't both up yet
});

test('winning', () => {
  const s = empty();
  s.foundations = ['S', 'H', 'D', 'C'].map((st) => Array.from({ length: 13 }, (_, i) => c(`${st}${i + 1}`)));
  expect(isWon(s)).toBe(true);
});
