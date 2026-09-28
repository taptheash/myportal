import { newDeal, draw, move, autoMove, canPlace, isWon, canAutoFinish, finishStep, isValidState, KlondikeState, Card } from './klondike';

const c = (id: string, up = true): Card => {
  const suit = id[0] as Card['suit'];
  return { id, suit, rank: Number(id.slice(1)), up };
};
const empty = (): KlondikeState => ({
  stock: [], waste: [], foundations: [[], [], [], []], tableau: [[], [], [], [], [], [], []],
  drawCount: 1, moves: 0, passes: 0, seed: 1,
});

test('a deal has 52 unique cards laid out 1..7 with only the top card face up', () => {
  const s = newDeal(1, 42);
  expect(isValidState(s)).toBe(true);
  expect(s.tableau.map((p) => p.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(s.stock).toHaveLength(24);
  s.tableau.forEach((p) => p.forEach((card, i) => expect(card.up).toBe(i === p.length - 1)));
  expect(newDeal(1, 42)).toEqual(s); // same seed, same deal
});

test('draw 3 turns over three, and an empty stock recycles the waste', () => {
  let s = newDeal(3, 7);
  s = draw(s)!;
  expect(s.waste).toHaveLength(3);
  expect(s.stock).toHaveLength(21);
  for (let i = 0; i < 7; i++) s = draw(s)!;
  expect(s.stock).toHaveLength(0);
  s = draw(s)!;
  expect(s.stock).toHaveLength(24);
  expect(s.waste).toHaveLength(0);
  expect(s.stock.every((x) => !x.up)).toBe(true);
  expect(s.passes).toBe(1);
});

test('tableau takes alternating colours one lower; empty piles take only Kings', () => {
  const s = empty();
  s.tableau[0] = [c('S8')];
  expect(canPlace(s, [c('H7')], { pile: 'tableau', i: 0 })).toBe(true);
  expect(canPlace(s, [c('C7')], { pile: 'tableau', i: 0 })).toBe(false);
  expect(canPlace(s, [c('H6')], { pile: 'tableau', i: 0 })).toBe(false);
  expect(canPlace(s, [c('H12')], { pile: 'tableau', i: 1 })).toBe(false);
  expect(canPlace(s, [c('H13')], { pile: 'tableau', i: 1 })).toBe(true);
});

test('foundations build up by suit from the Ace', () => {
  const s = empty();
  expect(canPlace(s, [c('D1')], { pile: 'foundation', i: 0 })).toBe(true);
  expect(canPlace(s, [c('D2')], { pile: 'foundation', i: 0 })).toBe(false);
  s.foundations[0] = [c('D1')];
  expect(canPlace(s, [c('D2')], { pile: 'foundation', i: 0 })).toBe(true);
  expect(canPlace(s, [c('H2')], { pile: 'foundation', i: 0 })).toBe(false);
});

test('moving a stack flips the card underneath and leaves the old state alone', () => {
  const s = empty();
  s.tableau[0] = [c('C4', false), c('H9'), c('S8')];
  s.tableau[1] = [c('C10')];
  const n = move(s, { pile: 'tableau', i: 0, index: 1 }, { pile: 'tableau', i: 1 })!;
  expect(n.tableau[1].map((x) => x.id)).toEqual(['C10', 'H9', 'S8']);
  expect(n.tableau[0]).toEqual([c('C4', true)]);
  expect(s.tableau[0]).toHaveLength(3); // original untouched, so Undo works
  expect(n.moves).toBe(1);
});

test('a click sends a card to its foundation first, and never shuffles a lone King between empty columns', () => {
  const s = empty();
  s.foundations[2] = [c('S1')];
  s.tableau[0] = [c('S2')];
  s.tableau[1] = [c('H3')];
  expect(autoMove(s, { pile: 'tableau', i: 0, index: 0 })!.foundations[2]).toHaveLength(2);
  const k = empty();
  k.tableau[3] = [c('C13')];
  expect(autoMove(k, { pile: 'tableau', i: 3, index: 0 })).toBeNull();
});

test('auto-finish plays everything up once all cards are face up', () => {
  let s = empty();
  s.foundations = [
    Array.from({ length: 11 }, (_, i) => c(`S${i + 1}`)),
    Array.from({ length: 12 }, (_, i) => c(`H${i + 1}`)),
    Array.from({ length: 13 }, (_, i) => c(`D${i + 1}`)),
    Array.from({ length: 12 }, (_, i) => c(`C${i + 1}`)),
  ];
  s.tableau[0] = [c('H13'), c('S12')];
  s.tableau[1] = [c('C13')];
  s.tableau[2] = [c('S13')];
  expect(canAutoFinish(s)).toBe(true);
  let steps = 0;
  while (!isWon(s) && steps < 10) { s = finishStep(s)!; steps++; }
  expect(isWon(s)).toBe(true);
  expect(steps).toBe(4);
});

test('a damaged saved game is rejected', () => {
  const s = newDeal(1, 3);
  expect(isValidState({ ...s, stock: s.stock.slice(1) })).toBe(false);
  expect(isValidState(null)).toBe(false);
});
