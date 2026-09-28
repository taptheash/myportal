// Playing-card basics shared by the card games' rules (Klondike, FreeCell,
// Spider): suits, ranks, and a seeded shuffle so any deal can be replayed.

export type Suit = 'S' | 'H' | 'D' | 'C';
export interface PlayingCard { id: string; suit: Suit; rank: number; up: boolean } // rank 1 (A) .. 13 (K)

export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const isRed = (s: Suit) => s === 'H' || s === 'D';
export const RANK_LABEL = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const newSeed = () => Math.floor(Math.random() * 2 ** 31);

// A standard 52-card deck (face down). `tag` keeps ids unique when a game
// uses more than one deck.
export function deck(tag = ''): PlayingCard[] {
  const out: PlayingCard[] = [];
  for (const suit of SUITS) for (let rank = 1; rank <= 13; rank++) out.push({ id: `${suit}${rank}${tag}`, suit, rank, up: false });
  return out;
}
