import { newDeal, LAYOUT, isFree, removePair, findPair, reshuffle, isWon, matchKey, MahjongState } from './mahjong';

test('the turtle has 144 tiles and every face appears the right number of times', () => {
  expect(LAYOUT).toHaveLength(144);
  const s = newDeal(3);
  const count = new Map<string, number>();
  s.tiles.forEach((t) => count.set(matchKey(t.face), (count.get(matchKey(t.face)) || 0) + 1));
  count.forEach((n) => expect(n).toBe(4));
  expect(count.size).toBe(36);
});

test('the top tile is free; the tiles under it are not', () => {
  const s = newDeal(4);
  const topTile = s.tiles.find((t) => t.z === 4)!;
  expect(isFree(s, topTile)).toBe(true);
  s.tiles.filter((t) => t.z === 3).forEach((t) => expect(isFree(s, t)).toBe(false));
  const middle = s.tiles.find((t) => t.z === 0 && t.x === 12 && t.y === 6)!;
  expect(isFree(s, middle)).toBe(false);
});

test('only free matching tiles come off in pairs', () => {
  const s = newDeal(5);
  const [a, b] = findPair(s)!;
  const n = removePair(s, a, b)!;
  expect(n.tiles.filter((t) => t.gone)).toHaveLength(2);
  expect(removePair(n, a, b)).toBeNull();
});

test('every deal can be cleared: its build order takes every tile off', () => {
  for (let seed = 1; seed <= 20; seed++) {
    let s: MahjongState = newDeal(seed);
    for (const [a, b] of s.order) {
      const n = removePair(s, a, b);
      expect(n).not.toBeNull();
      s = n!;
    }
    expect(isWon(s)).toBe(true);
  }
});

test('reshuffling keeps the same tiles and leaves a pair to take', () => {
  let s = newDeal(8);
  for (let k = 0; k < 20; k++) { const p = findPair(s)!; s = removePair(s, p[0], p[1])!; }
  const before = s.tiles.filter((t) => !t.gone).map((t) => matchKey(t.face)).sort();
  const r = reshuffle(s, 99)!;
  expect(r.tiles.filter((t) => !t.gone).map((t) => matchKey(t.face)).sort()).toEqual(before);
  expect(findPair(r)).not.toBeNull();
  expect(r.shuffles).toBe(1);
  let cur = r;
  for (const [a, b] of r.order) cur = removePair(cur, a, b)!;
  expect(isWon(cur)).toBe(true);
});
