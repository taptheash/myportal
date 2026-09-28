// Klondike solitaire rules, kept separate from the screen so they can be
// tested on their own. Every function returns a NEW state (or null when the
// move isn't allowed) and never changes the one it was given, which is what
// makes Undo a simple list of earlier states.

export type Suit = 'S' | 'H' | 'D' | 'C';
export interface Card { id: string; suit: Suit; rank: number; up: boolean } // rank 1 (A) .. 13 (K)

export interface KlondikeState {
  stock: Card[];          // face down, last card is the top
  waste: Card[];          // face up, last card is the top
  foundations: Card[][];  // 4 piles, A up to K in one suit
  tableau: Card[][];      // 7 piles, last card is the top
  drawCount: 1 | 3;
  moves: number;
  passes: number;         // times the waste has been turned back over
  seed: number;
}

// Where a card or stack is being moved from / dropped on.
export type From =
  | { pile: 'waste' }
  | { pile: 'foundation'; i: number }
  | { pile: 'tableau'; i: number; index: number }; // index = first card of the stack
export type To = { pile: 'foundation'; i: number } | { pile: 'tableau'; i: number };

export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const isRed = (s: Suit) => s === 'H' || s === 'D';
export const RANK_LABEL = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

// Small seeded random generator, so a deal can be replayed and tested.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newDeal(drawCount: 1 | 3, seed = Math.floor(Math.random() * 2 ** 31)): KlondikeState {
  const deck: Card[] = [];
  for (const suit of SUITS) for (let rank = 1; rank <= 13; rank++) deck.push({ id: `${suit}${rank}`, suit, rank, up: false });
  const rand = rng(seed);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const tableau: Card[][] = [];
  for (let p = 0; p < 7; p++) {
    const pile = deck.splice(0, p + 1);
    pile[pile.length - 1] = { ...pile[pile.length - 1], up: true };
    tableau.push(pile);
  }
  return { stock: deck, waste: [], foundations: [[], [], [], []], tableau, drawCount, moves: 0, passes: 0, seed };
}

const clone = (s: KlondikeState): KlondikeState => ({
  ...s,
  stock: [...s.stock],
  waste: [...s.waste],
  foundations: s.foundations.map((f) => [...f]),
  tableau: s.tableau.map((t) => [...t]),
});

const top = <T,>(a: T[]): T | undefined => a[a.length - 1];

// Turn over the next card(s) from the stock, or turn the waste back over when
// the stock is empty. Returns null when both are empty.
export function draw(s: KlondikeState): KlondikeState | null {
  if (!s.stock.length && !s.waste.length) return null;
  const n = clone(s);
  if (!n.stock.length) {
    n.stock = n.waste.reverse().map((c) => ({ ...c, up: false }));
    n.waste = [];
    n.passes += 1;
  } else {
    const count = Math.min(n.drawCount, n.stock.length);
    for (let k = 0; k < count; k++) n.waste.push({ ...n.stock.pop()!, up: true });
  }
  n.moves += 1;
  return n;
}

// The cards a move would pick up, or null if that isn't a legal pick-up.
export function cardsAt(s: KlondikeState, from: From): Card[] | null {
  if (from.pile === 'waste') { const c = top(s.waste); return c ? [c] : null; }
  if (from.pile === 'foundation') { const c = top(s.foundations[from.i]); return c ? [c] : null; }
  const pile = s.tableau[from.i];
  if (from.index < 0 || from.index >= pile.length || !pile[from.index].up) return null;
  return pile.slice(from.index);
}

export function canPlace(s: KlondikeState, cards: Card[], to: To): boolean {
  const first = cards[0];
  if (!first) return false;
  if (to.pile === 'foundation') {
    if (cards.length !== 1) return false;
    const t = top(s.foundations[to.i]);
    return t ? t.suit === first.suit && first.rank === t.rank + 1 : first.rank === 1;
  }
  const t = top(s.tableau[to.i]);
  if (!t) return first.rank === 13;
  return t.up && isRed(t.suit) !== isRed(first.suit) && first.rank === t.rank - 1;
}

export function move(s: KlondikeState, from: From, to: To): KlondikeState | null {
  if (from.pile === to.pile && from.i === to.i) return null;
  const cards = cardsAt(s, from);
  if (!cards || !canPlace(s, cards, to)) return null;
  const n = clone(s);
  if (from.pile === 'waste') n.waste.pop();
  else if (from.pile === 'foundation') n.foundations[from.i].pop();
  else {
    n.tableau[from.i] = n.tableau[from.i].slice(0, from.index);
    const last = top(n.tableau[from.i]);
    if (last && !last.up) n.tableau[from.i][n.tableau[from.i].length - 1] = { ...last, up: true };
  }
  if (to.pile === 'foundation') n.foundations[to.i].push(...cards);
  else n.tableau[to.i].push(...cards);
  n.moves += 1;
  return n;
}

// Where a click sends a card: up to a foundation if it can go, else onto a
// tableau pile (a non-empty one first, so a King doesn't jump to an empty
// column when there's a real home for it). Null when it has nowhere to go.
export function autoMove(s: KlondikeState, from: From): KlondikeState | null {
  const cards = cardsAt(s, from);
  if (!cards) return null;
  if (cards.length === 1 && from.pile !== 'foundation') {
    for (let i = 0; i < 4; i++) {
      const r = move(s, from, { pile: 'foundation', i });
      if (r) return r;
    }
  }
  // Moving a whole column's worth (King at the bottom) to another empty
  // column achieves nothing, so skip empty piles in that case.
  const fromWholePile = from.pile === 'tableau' && from.index === 0;
  const order = [0, 1, 2, 3, 4, 5, 6].filter((i) => !(from.pile === 'tableau' && from.i === i));
  for (const i of order) if (s.tableau[i].length) { const r = move(s, from, { pile: 'tableau', i }); if (r) return r; }
  if (!fromWholePile) for (const i of order) if (!s.tableau[i].length) { const r = move(s, from, { pile: 'tableau', i }); if (r) return r; }
  return null;
}

export const isWon = (s: KlondikeState) => s.foundations.every((f) => f.length === 13);

// Everything is face up and nothing is left to draw: the rest plays itself.
export const canAutoFinish = (s: KlondikeState) =>
  !isWon(s) && !s.stock.length && !s.waste.length && s.tableau.every((p) => p.every((c) => c.up));

// One step of the auto-finish: the lowest card that can go up.
export function finishStep(s: KlondikeState): KlondikeState | null {
  const tops = s.tableau
    .map((p, i) => ({ i, card: top(p), index: p.length - 1 }))
    .filter((t) => t.card)
    .sort((a, b) => a.card!.rank - b.card!.rank);
  for (const t of tops) {
    for (let f = 0; f < 4; f++) {
      const r = move(s, { pile: 'tableau', i: t.i, index: t.index }, { pile: 'foundation', i: f });
      if (r) return r;
    }
  }
  return null;
}

// Loose check that a saved game is still a well-formed 52-card deal.
export function isValidState(s: any): s is KlondikeState {
  try {
    const all = [...s.stock, ...s.waste, ...s.foundations.flat(), ...s.tableau.flat()];
    return all.length === 52 && new Set(all.map((c: Card) => c.id)).size === 52
      && s.foundations.length === 4 && s.tableau.length === 7 && (s.drawCount === 1 || s.drawCount === 3);
  } catch { return false; }
}
