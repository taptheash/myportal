// Mahjong solitaire (tile matching) on the classic "turtle" layout: 144 tiles
// in five layers. A tile is free when nothing sits on it and its left or right
// side is open. Remove free tiles in matching pairs; flowers match any flower
// and seasons any season. Every deal is built by playing a game backwards,
// so it can always be cleared.

import { rng, shuffle, newSeed } from './cardDeck';

export interface Tile { id: number; x: number; y: number; z: number; face: string; gone: boolean }
export interface MahjongState {
  tiles: Tile[];
  seed: number;
  shuffles: number;
  order: Array<[number, number]>; // one way to clear the table (tile ids, in order)
}

// Positions in half-tile units: a tile at (x, y) covers x..x+2, y..y+2.
function turtle(): Array<{ x: number; y: number; z: number }> {
  const out: Array<{ x: number; y: number; z: number }> = [];
  const rowSpans: Array<[number, number]> = [[1, 12], [3, 10], [2, 11], [1, 12], [1, 12], [2, 11], [3, 10], [1, 12]];
  rowSpans.forEach(([a, b], r) => { for (let c = a; c <= b; c++) out.push({ x: c * 2, y: r * 2, z: 0 }); });
  out.push({ x: 0, y: 7, z: 0 }, { x: 26, y: 7, z: 0 }, { x: 28, y: 7, z: 0 });
  for (let r = 1; r <= 6; r++) for (let c = 4; c <= 9; c++) out.push({ x: c * 2, y: r * 2, z: 1 });
  for (let r = 2; r <= 5; r++) for (let c = 5; c <= 8; c++) out.push({ x: c * 2, y: r * 2, z: 2 });
  for (let r = 3; r <= 4; r++) for (let c = 6; c <= 7; c++) out.push({ x: c * 2, y: r * 2, z: 3 });
  out.push({ x: 13, y: 7, z: 4 });
  return out;
}
export const LAYOUT = turtle();
export const BOARD_W = 30; // half-units
export const BOARD_H = 16;

// Faces: d = dots, b = bamboo, c = characters (1-9); w = winds (E S W N);
// r = dragons (R red, G green, W white); f = flowers, s = seasons (1-4).
const NORMAL = [
  ...['d', 'b', 'c'].flatMap((s) => Array.from({ length: 9 }, (_, i) => `${s}${i + 1}`)),
  'wE', 'wS', 'wW', 'wN', 'rR', 'rG', 'rW',
];
export const matchKey = (face: string) => (face[0] === 'f' ? 'F' : face[0] === 's' ? 'S' : face);
export const matches = (a: string, b: string) => matchKey(a) === matchKey(b);

function allPairs(): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  NORMAL.forEach((f) => { pairs.push([f, f], [f, f]); });
  pairs.push(['f1', 'f2'], ['f3', 'f4'], ['s1', 's2'], ['s3', 's4']);
  return pairs;
}

const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;

export function isFreeAmong(t: { x: number; y: number; z: number }, present: Array<{ x: number; y: number; z: number }>): boolean {
  let left = false, right = false;
  for (const o of present) {
    if (o === t) continue;
    if (o.z === t.z + 1 && overlaps(o, t)) return false;
    if (o.z === t.z && Math.abs(o.y - t.y) < 2) {
      if (o.x === t.x - 2) left = true;
      if (o.x === t.x + 2) right = true;
    }
  }
  return !left || !right;
}

export const isFree = (s: MahjongState, t: Tile) => !t.gone && isFreeAmong(t, s.tiles.filter((o) => !o.gone));

// Give `spots` the faces from `pairs` so the result can be cleared: take the
// spots apart two free ones at a time and hand each such pair a matching pair.
function assign(spots: Array<{ x: number; y: number; z: number }>, pairs: Array<[string, string]>, rand: () => number):
  { faces: string[]; order: Array<[number, number]> } | null {
  const faces: string[] = Array(spots.length).fill('');
  const order: Array<[number, number]> = [];
  const remaining = spots.map((p, idx) => ({ ...p, idx }));
  const queue = shuffle(pairs, rand);
  while (remaining.length) {
    const free = remaining.filter((t) => isFreeAmong(t, remaining));
    if (free.length < 2) return null;
    const [a, b] = shuffle(free, rand);
    const [fa, fb] = queue.pop()!;
    faces[a.idx] = fa;
    faces[b.idx] = fb;
    order.push([a.idx, b.idx]);
    remaining.splice(remaining.indexOf(a), 1);
    remaining.splice(remaining.indexOf(b), 1);
  }
  return { faces, order };
}

export function newDeal(seed = newSeed()): MahjongState {
  const rand = rng(seed);
  for (let attempt = 0; attempt < 200; attempt++) {
    const r = assign(LAYOUT, allPairs(), rand);
    if (r) return { tiles: LAYOUT.map((p, id) => ({ id, ...p, face: r.faces[id], gone: false })), seed, shuffles: 0, order: r.order };
  }
  throw new Error('Could not deal');
}

export function removePair(s: MahjongState, a: number, b: number): MahjongState | null {
  const ta = s.tiles[a], tb = s.tiles[b];
  if (a === b || !ta || !tb || !isFree(s, ta) || !isFree(s, tb) || !matches(ta.face, tb.face)) return null;
  return { ...s, tiles: s.tiles.map((t) => (t.id === a || t.id === b ? { ...t, gone: true } : t)) };
}

// A pair you could take right now, or null when you're stuck.
export function findPair(s: MahjongState): [number, number] | null {
  const free = s.tiles.filter((t) => isFree(s, t));
  for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
    if (matches(free[i].face, free[j].face)) return [free[i].id, free[j].id];
  }
  return null;
}

// Rearrange the tiles still on the table so the game can be finished again.
// Null when no arrangement can be finished (e.g. only tiles stacked on each
// other are left): then the way out is Undo or a new game.
export function reshuffle(s: MahjongState, seed = newSeed()): MahjongState | null {
  const left = s.tiles.filter((t) => !t.gone);
  const byKey = new Map<string, string[]>();
  left.forEach((t) => { const k = matchKey(t.face); byKey.set(k, [...(byKey.get(k) || []), t.face]); });
  const pairs: Array<[string, string]> = [];
  byKey.forEach((faces) => { for (let k = 0; k + 1 < faces.length; k += 2) pairs.push([faces[k], faces[k + 1]]); });
  const rand = rng(seed);
  for (let attempt = 0; attempt < 200; attempt++) {
    const r = assign(left, pairs, rand);
    if (r) {
      const byId = new Map(left.map((t, k) => [t.id, r.faces[k]]));
      return {
        ...s,
        shuffles: s.shuffles + 1,
        tiles: s.tiles.map((t) => (byId.has(t.id) ? { ...t, face: byId.get(t.id)! } : t)),
        order: r.order.map(([a, b]) => [left[a].id, left[b].id] as [number, number]),
      };
    }
  }
  return null;
}

export const isWon = (s: MahjongState) => s.tiles.every((t) => t.gone);
export const tilesLeft = (s: MahjongState) => s.tiles.filter((t) => !t.gone).length;

export function isValidState(s: any): s is MahjongState {
  try { return Array.isArray(s.tiles) && s.tiles.length === LAYOUT.length && s.tiles.every((t: Tile) => typeof t.face === 'string') && Array.isArray(s.order); } catch { return false; }
}
