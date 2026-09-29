import { newGame, fromPlacement, legalMoves, makeMove, outcome, san, bestMove, inCheck, ChessState } from './chess';

const perft = (s: ChessState, d: number): number => (d === 0 ? 1 : legalMoves(s).reduce((n, m) => n + perft(makeMove(s, m), d - 1), 0));

test('move counts from the start match the published perft numbers', () => {
  const s = newGame();
  expect([1, 2, 3].map((d) => perft(s, d))).toEqual([20, 400, 8902]);
});

test('castling, en passant and promotion: "Kiwipete" perft', () => {
  const s = fromPlacement('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R', 'w', 'KQkq');
  expect([1, 2].map((d) => perft(s, d))).toEqual([48, 2039]);
});

test('en passant and pins: perft position 3', () => {
  const s = fromPlacement('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8', 'w', '');
  expect([1, 2, 3].map((d) => perft(s, d))).toEqual([14, 191, 2812]);
});

test('promotion positions: perft position 4', () => {
  const s = fromPlacement('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1', 'w', 'kq');
  expect([1, 2].map((d) => perft(s, d))).toEqual([6, 264]);
});

test('notation, checkmate and the computer finding a mate in one', () => {
  let s = newGame();
  const play = (text: string) => {
    const moves = legalMoves(s);
    const m = moves.find((x) => san(s, x, moves) === text);
    if (!m) throw new Error(`no move ${text}`);
    s = makeMove(s, m);
  };
  ['f3', 'e5', 'g4'].forEach(play);
  const mate = bestMove(s, { depth: 2 })!;
  expect(san(s, mate)).toBe('Qh4#');
  s = makeMove(s, mate);
  expect(inCheck(s)).toBe(true);
  expect(outcome(s)).toEqual({ over: true, winner: 'b', reason: 'Checkmate' });
});

test('stalemate and bare kings are draws', () => {
  expect(outcome(fromPlacement('7k/5Q2/6K1/8/8/8/8/8', 'b', '')).over && outcome(fromPlacement('7k/5Q2/6K1/8/8/8/8/8', 'b', ''))).toMatchObject({ winner: null, reason: 'Stalemate' });
  expect(outcome(fromPlacement('7k/8/6K1/8/8/8/8/8', 'w', ''))).toMatchObject({ over: true, winner: null });
});

test('the computer grabs a free queen', () => {
  const s = fromPlacement('4k3/8/8/3q4/8/8/3R4/4K3', 'w', '');
  expect(san(s, bestMove(s, { depth: 2 })!)).toBe('Rxd5');
});
