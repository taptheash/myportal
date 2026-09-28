// Spider solitaire rules. Two decks (104 cards) in 10 columns. Build down by
// one in any suit, but only a same-suit run moves as a unit. A full King-to-Ace
// run of one suit is lifted off the table; lift all eight to win. The stock
// deals one card onto every column (not allowed while a column is empty).

import { PlayingCard, Suit, rng, shuffle, newSeed } from './cardDeck';

export type Card = PlayingCard;
export type SuitCount = 1 | 2 | 4;
export interface SpiderState {
  tableau: Card[][];   // 10
  stock: Card[];       // dealt 10 at a time
  completed: Suit[];   // suits of the runs lifted off so far
  suits: SuitCount;
  seed: number;
}
export type From = { i: number; index: number };

const SUIT_SETS: Record<SuitCount, Suit[]> = { 1: ['S'], 2: ['S', 'H'], 4: ['S', 'H', 'D', 'C'] };

export function newDeal(suits: SuitCount, seed = newSeed()): SpiderState {
  const cards: Card[] = [];
  const set = SUIT_SETS[suits];
  for (let k = 0; k < 8; k++) {
    const suit = set[k % set.length];
    for (let rank = 1; rank <= 13; rank++) cards.push({ id: `${suit}${rank}-${k}`, suit, rank, up: false });
  }
  const deck = shuffle(cards, rng(seed));
  const tableau: Card[][] = [];
  for (let i = 0; i < 10; i++) {
    const pile = deck.splice(0, i < 4 ? 6 : 5);
    pile[pile.length - 1] = { ...pile[pile.length - 1], up: true };
    tableau.push(pile);
  }
  return { tableau, stock: deck, completed: [], suits, seed };
}

const clone = (s: SpiderState): SpiderState => ({ ...s, tableau: s.tableau.map((t) => [...t]), stock: [...s.stock], completed: [...s.completed] });

function flipTop(pile: Card[]) {
  const t = pile[pile.length - 1];
  if (t && !t.up) pile[pile.length - 1] = { ...t, up: true };
}

// Lift off any finished King-to-Ace run of one suit.
function liftRuns(n: SpiderState) {
  n.tableau.forEach((pile, i) => {
    if (pile.length < 13) return;
    const run = pile.slice(-13);
    const ok = run.every((c, k) => c.up && c.suit === run[0].suit && c.rank === 13 - k);
    if (ok) {
      n.tableau[i] = pile.slice(0, -13);
      n.completed.push(run[0].suit);
      flipTop(n.tableau[i]);
    }
  });
}

// A same-suit run, each one lower, from `index` to the end of the column.
export function movableFrom(s: SpiderState, from: From): Card[] | null {
  const pile = s.tableau[from.i];
  if (from.index < 0 || from.index >= pile.length) return null;
  const cards = pile.slice(from.index);
  for (let k = 0; k < cards.length; k++) {
    if (!cards[k].up) return null;
    if (k && (cards[k].suit !== cards[0].suit || cards[k].rank !== cards[k - 1].rank - 1)) return null;
  }
  return cards;
}

export function canPlace(s: SpiderState, cards: Card[], to: number): boolean {
  const t = s.tableau[to][s.tableau[to].length - 1];
  return !t || t.rank === cards[0].rank + 1;
}

export function move(s: SpiderState, from: From, to: number): SpiderState | null {
  if (from.i === to) return null;
  const cards = movableFrom(s, from);
  if (!cards || !canPlace(s, cards, to)) return null;
  const n = clone(s);
  n.tableau[from.i] = n.tableau[from.i].slice(0, from.index);
  flipTop(n.tableau[from.i]);
  n.tableau[to].push(...cards);
  liftRuns(n);
  return n;
}

// Where a click sends a run: onto the same suit one higher if possible, else
// onto any card one higher, else into an empty column.
export function autoMove(s: SpiderState, from: From): SpiderState | null {
  const cards = movableFrom(s, from);
  if (!cards) return null;
  const others = Array.from({ length: 10 }, (_, i) => i).filter((i) => i !== from.i);
  const topOf = (i: number) => s.tableau[i][s.tableau[i].length - 1];
  const order = [
    ...others.filter((i) => topOf(i) && topOf(i).suit === cards[0].suit && topOf(i).rank === cards[0].rank + 1),
    ...others.filter((i) => topOf(i) && topOf(i).rank === cards[0].rank + 1),
    ...(from.index === 0 ? [] : others.filter((i) => !topOf(i))),
  ];
  for (const i of order) { const r = move(s, from, i); if (r) return r; }
  return null;
}

export const canDeal = (s: SpiderState) => s.stock.length > 0 && s.tableau.every((p) => p.length > 0);

export function dealRow(s: SpiderState): SpiderState | null {
  if (!canDeal(s)) return null;
  const n = clone(s);
  for (let i = 0; i < 10; i++) n.tableau[i].push({ ...n.stock.pop()!, up: true });
  liftRuns(n);
  return n;
}

export const isWon = (s: SpiderState) => s.completed.length === 8;

export function isValidState(s: any): s is SpiderState {
  try {
    const all = [...s.stock, ...s.tableau.flat()];
    return s.tableau.length === 10 && [1, 2, 4].includes(s.suits)
      && all.length + s.completed.length * 13 === 104 && new Set(all.map((c: Card) => c.id)).size === all.length;
  } catch { return false; }
}
