// FreeCell rules. All 52 cards are dealt face up into 8 columns; four free
// cells each hold one card; build foundations up by suit from the Ace.
// Deals use the classic numbered-game shuffle (Game #1 to #32000), the same
// numbering most FreeCell programs use, so a game number means the same deal.

import { PlayingCard, Suit, isRed } from './cardDeck';

export type Card = PlayingCard;
export interface FreeCellState {
  cells: Array<Card | null>;  // 4 free cells
  foundations: Card[][];      // 4
  tableau: Card[][];          // 8
  gameNo: number;
}
export type From = { pile: 'cell'; i: number } | { pile: 'foundation'; i: number } | { pile: 'tableau'; i: number; index: number };
export type To = { pile: 'cell'; i: number } | { pile: 'foundation'; i: number } | { pile: 'tableau'; i: number };

const MS_SUITS: Suit[] = ['C', 'D', 'H', 'S'];

export function newDeal(gameNo = 1 + Math.floor(Math.random() * 32000)): FreeCellState {
  let state = gameNo;
  const rand = () => { state = (state * 214013 + 2531011) % 2147483648; return Math.floor(state / 65536); };
  const cards = Array.from({ length: 52 }, (_, i) => i);
  const tableau: Card[][] = [[], [], [], [], [], [], [], []];
  for (let i = 0; i < 52; i++) {
    const left = 52 - i;
    const k = rand() % left;
    const n = cards[k];
    cards[k] = cards[left - 1];
    const card: Card = { id: `${MS_SUITS[n % 4]}${Math.floor(n / 4) + 1}`, suit: MS_SUITS[n % 4], rank: Math.floor(n / 4) + 1, up: true };
    tableau[i % 8].push(card);
  }
  return { cells: [null, null, null, null], foundations: [[], [], [], []], tableau, gameNo };
}

const clone = (s: FreeCellState): FreeCellState => ({
  ...s, cells: [...s.cells], foundations: s.foundations.map((f) => [...f]), tableau: s.tableau.map((t) => [...t]),
});
const top = <T,>(a: T[]): T | undefined => a[a.length - 1];

// A run you can pick up: alternating colours, each one lower.
export function isRun(cards: Card[]): boolean {
  for (let k = 1; k < cards.length; k++) {
    if (isRed(cards[k].suit) === isRed(cards[k - 1].suit) || cards[k].rank !== cards[k - 1].rank - 1) return false;
  }
  return true;
}

// How many cards can move at once, using free cells and empty columns as
// temporary space: (free cells + 1) x 2^(empty columns), not counting the
// column you're moving into.
export function maxMovable(s: FreeCellState, toEmptyColumn: boolean): number {
  const free = s.cells.filter((c) => !c).length;
  const empty = s.tableau.filter((t) => !t.length).length - (toEmptyColumn ? 1 : 0);
  return (free + 1) * 2 ** Math.max(0, empty);
}

export function cardsAt(s: FreeCellState, from: From): Card[] | null {
  if (from.pile === 'cell') { const c = s.cells[from.i]; return c ? [c] : null; }
  if (from.pile === 'foundation') { const c = top(s.foundations[from.i]); return c ? [c] : null; }
  const pile = s.tableau[from.i];
  if (from.index < 0 || from.index >= pile.length) return null;
  const cards = pile.slice(from.index);
  return isRun(cards) ? cards : null;
}

export function canPlace(s: FreeCellState, cards: Card[], to: To): boolean {
  const first = cards[0];
  if (!first) return false;
  if (to.pile === 'cell') return cards.length === 1 && !s.cells[to.i];
  if (to.pile === 'foundation') {
    if (cards.length !== 1) return false;
    const t = top(s.foundations[to.i]);
    return t ? t.suit === first.suit && first.rank === t.rank + 1 : first.rank === 1;
  }
  const dest = s.tableau[to.i];
  if (cards.length > maxMovable(s, !dest.length)) return false;
  const t = top(dest);
  return !t || (isRed(t.suit) !== isRed(first.suit) && first.rank === t.rank - 1);
}

export function move(s: FreeCellState, from: From, to: To): FreeCellState | null {
  if (from.pile === to.pile && from.i === to.i) return null;
  const cards = cardsAt(s, from);
  if (!cards || !canPlace(s, cards, to)) return null;
  const n = clone(s);
  if (from.pile === 'cell') n.cells[from.i] = null;
  else if (from.pile === 'foundation') n.foundations[from.i].pop();
  else n.tableau[from.i] = n.tableau[from.i].slice(0, from.index);
  if (to.pile === 'cell') n.cells[to.i] = cards[0];
  else if (to.pile === 'foundation') n.foundations[to.i].push(cards[0]);
  else n.tableau[to.i].push(...cards);
  return n;
}

// Where a click sends a card: foundation, then a column it fits on, then an
// empty column, then a free cell.
export function autoMove(s: FreeCellState, from: From): FreeCellState | null {
  const cards = cardsAt(s, from);
  if (!cards) return null;
  const tries: To[] = [];
  if (cards.length === 1 && from.pile !== 'foundation') for (let i = 0; i < 4; i++) tries.push({ pile: 'foundation', i });
  const others = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => !(from.pile === 'tableau' && from.i === i));
  others.filter((i) => s.tableau[i].length).forEach((i) => tries.push({ pile: 'tableau', i }));
  const wholeColumn = from.pile === 'tableau' && from.index === 0;
  if (!wholeColumn) others.filter((i) => !s.tableau[i].length).forEach((i) => tries.push({ pile: 'tableau', i }));
  if (cards.length === 1 && from.pile === 'tableau') for (let i = 0; i < 4; i++) tries.push({ pile: 'cell', i });
  for (const to of tries) { const r = move(s, from, to); if (r) return r; }
  return null;
}

// After each move, cards that can never be needed again go up by themselves:
// Aces and 2s, and any card whose two opposite-colour one-lower cards are
// already up.
export function autoPlaySafe(s: FreeCellState): FreeCellState {
  let cur = s;
  const foundationRank = (st: FreeCellState, suit: Suit) => st.foundations.find((f) => f[0]?.suit === suit)?.length ?? 0;
  const safe = (st: FreeCellState, c: Card) => {
    if (c.rank <= 2) return true;
    const opposite: Suit[] = isRed(c.suit) ? ['S', 'C'] : ['H', 'D'];
    return opposite.every((o) => foundationRank(st, o) >= c.rank - 1);
  };
  const step = (st: FreeCellState): FreeCellState | null => {
    const sources: From[] = [];
    st.cells.forEach((c, i) => { if (c) sources.push({ pile: 'cell', i }); });
    st.tableau.forEach((t, i) => { if (t.length) sources.push({ pile: 'tableau', i, index: t.length - 1 }); });
    for (const from of sources) {
      const c = from.pile === 'cell' ? st.cells[from.i]! : st.tableau[from.i][st.tableau[from.i].length - 1];
      if (!safe(st, c)) continue;
      for (let i = 0; i < 4; i++) { const r = move(st, from, { pile: 'foundation', i }); if (r) return r; }
    }
    return null;
  };
  for (let guard = 0; guard < 60; guard++) {
    const next = step(cur);
    if (!next) break;
    cur = next;
  }
  return cur;
}

export const isWon = (s: FreeCellState) => s.foundations.every((f) => f.length === 13);

export function isValidState(s: any): s is FreeCellState {
  try {
    const all = [...s.cells.filter(Boolean), ...s.foundations.flat(), ...s.tableau.flat()];
    return all.length === 52 && new Set(all.map((c: Card) => c.id)).size === 52 && s.cells.length === 4 && s.tableau.length === 8;
  } catch { return false; }
}
