import { newDeal, move, dealRow, canDeal, autoMove, isValidState, SpiderState, Card } from './spider';

const c = (id: string, up = true): Card => { const [s, r] = id.split(/(?<=^.)/); return { id, suit: s as Card['suit'], rank: Number(r.split('-')[0]), up }; };

const empty = (): SpiderState => ({ tableau: Array.from({ length: 10 }, () => []), stock: [], completed: [], suits: 1, seed: 1 });

test('a deal is 54 on the table (6,6,6,6,5..) and 50 in the stock', () => {
  const s = newDeal(2, 9);
  expect(s.tableau.map((p) => p.length)).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
  expect(s.stock).toHaveLength(50);
  expect(isValidState(s)).toBe(true);
  expect(new Set(s.tableau.flat().concat(s.stock).map((x) => x.suit))).toEqual(new Set(['S', 'H']));
});

test('only same-suit runs move together, onto any suit one higher', () => {
  const s = empty();
  s.tableau[0] = [c('S7-0'), c('S6-0')];
  s.tableau[1] = [c('H8-0')];
  s.tableau[2] = [c('S7-1'), c('H6-1')];
  expect(move(s, { i: 0, index: 0 }, 1)!.tableau[1].map((x) => x.id)).toEqual(['H8-0', 'S7-0', 'S6-0']);
  expect(move(s, { i: 2, index: 0 }, 1)).toBeNull(); // mixed suits
});

test('a finished King-to-Ace run lifts off and the card under it turns over', () => {
  const s = empty();
  s.tableau[0] = [c('H4-0', false), ...Array.from({ length: 12 }, (_, k) => c(`S${13 - k}-0`))];
  s.tableau[1] = [c('S1-0')];
  const n = move(s, { i: 1, index: 0 }, 0)!;
  expect(n.completed).toEqual(['S']);
  expect(n.tableau[0]).toEqual([c('H4-0', true)]);
});

test('no dealing while a column is empty', () => {
  const s = newDeal(1, 3);
  expect(canDeal(s)).toBe(true);
  expect(dealRow(s)!.stock).toHaveLength(40);
  s.tableau[5] = [];
  expect(dealRow(s)).toBeNull();
});

test('a click prefers the same suit', () => {
  const s = empty();
  s.tableau[0] = [c('S5-0')];
  s.tableau[1] = [c('H6-0')];
  s.tableau[2] = [c('S6-0')];
  s.tableau[3] = [c('D2-0')];
  expect(autoMove(s, { i: 0, index: 0 })!.tableau[2]).toHaveLength(2);
});
