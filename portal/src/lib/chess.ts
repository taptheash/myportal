// Chess rules and a computer player.
//
// Board: 64 squares, index 0 = a8 ... 7 = h8, 56 = a1 ... 63 = h1.
// Pieces: 'PNBRQK' white, 'pnbrqk' black, '' empty.

export type Color = 'w' | 'b';
export interface Move { from: number; to: number; piece: string; captured: string; promo: string; castle: '' | 'K' | 'Q'; ep: boolean }
export interface ChessState {
  board: string[];
  turn: Color;
  castling: string;     // subset of 'KQkq'
  ep: number;           // en-passant target square, -1 if none
  halfmove: number;     // for the 50-move rule
  fullmove: number;
  seen: string[];       // earlier positions, for threefold repetition
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
export const FILES = 'abcdefgh';
export const sqName = (i: number) => `${FILES[i % 8]}${8 - Math.floor(i / 8)}`;
const colorOf = (p: string): Color | '' => (!p ? '' : p === p.toUpperCase() ? 'w' : 'b');
const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

export function fromPlacement(placement: string, turn: Color = 'w', castling = 'KQkq'): ChessState {
  const board: string[] = [];
  for (const ch of placement.replace(/\//g, '')) {
    if (/\d/.test(ch)) for (let k = 0; k < Number(ch); k++) board.push('');
    else board.push(ch);
  }
  return { board, turn, castling, ep: -1, halfmove: 0, fullmove: 1, seen: [] };
}
export const newGame = () => fromPlacement(START);

const key = (s: ChessState) => `${s.board.map((p) => p || '.').join('')}${s.turn}${s.castling}${s.ep}`;

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const at = (r: number, f: number) => (r >= 0 && r < 8 && f >= 0 && f < 8 ? r * 8 + f : -1);

// Is square `sq` attacked by `by`?
export function attacked(board: string[], sq: number, by: Color): boolean {
  const r = Math.floor(sq / 8), f = sq % 8;
  const up = by === 'w' ? 1 : -1; // white pawns attack toward lower row numbers
  for (const df of [-1, 1]) {
    const s = at(r + up, f + df);
    if (s >= 0 && board[s] === (by === 'w' ? 'P' : 'p')) return true;
  }
  for (const [dr, df] of KNIGHT) { const s = at(r + dr, f + df); if (s >= 0 && board[s] === (by === 'w' ? 'N' : 'n')) return true; }
  for (const [dr, df] of KING) { const s = at(r + dr, f + df); if (s >= 0 && board[s] === (by === 'w' ? 'K' : 'k')) return true; }
  const slide = (dirs: number[][], pieces: string) => dirs.some(([dr, df]) => {
    let rr = r + dr, ff = f + df;
    while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
      const p = board[rr * 8 + ff];
      if (p) return colorOf(p) === by && pieces.includes(p.toLowerCase());
      rr += dr; ff += df;
    }
    return false;
  });
  return slide(DIAG, 'bq') || slide(ORTHO, 'rq');
}

export const kingSquare = (board: string[], c: Color) => board.indexOf(c === 'w' ? 'K' : 'k');
export const inCheck = (s: ChessState, c: Color = s.turn) => attacked(s.board, kingSquare(s.board, c), other(c));

function pseudoMoves(s: ChessState): Move[] {
  const out: Move[] = [];
  const { board, turn } = s;
  const add = (from: number, to: number, extra: Partial<Move> = {}) =>
    out.push({ from, to, piece: board[from], captured: board[to], promo: '', castle: '', ep: false, ...extra });
  for (let from = 0; from < 64; from++) {
    const p = board[from];
    if (!p || colorOf(p) !== turn) continue;
    const r = Math.floor(from / 8), f = from % 8;
    const t = p.toLowerCase();
    if (t === 'p') {
      const dir = turn === 'w' ? -1 : 1;
      const startRow = turn === 'w' ? 6 : 1;
      const lastRow = turn === 'w' ? 0 : 7;
      const pushTo = (to: number, extra: Partial<Move> = {}) => {
        if (Math.floor(to / 8) === lastRow) for (const q of 'qrbn') add(from, to, { ...extra, promo: turn === 'w' ? q.toUpperCase() : q });
        else add(from, to, extra);
      };
      const one = at(r + dir, f);
      if (one >= 0 && !board[one]) {
        pushTo(one);
        const two = at(r + 2 * dir, f);
        if (r === startRow && !board[two]) add(from, two);
      }
      for (const df of [-1, 1]) {
        const cap = at(r + dir, f + df);
        if (cap < 0) continue;
        if (board[cap] && colorOf(board[cap]) !== turn) pushTo(cap);
        else if (cap === s.ep) add(from, cap, { ep: true, captured: turn === 'w' ? 'p' : 'P' });
      }
    } else if (t === 'n' || t === 'k') {
      for (const [dr, df] of t === 'n' ? KNIGHT : KING) {
        const to = at(r + dr, f + df);
        if (to >= 0 && colorOf(board[to]) !== turn) add(from, to);
      }
      if (t === 'k') {
        const home = turn === 'w' ? 60 : 4;
        const [kc, qc] = turn === 'w' ? ['K', 'Q'] : ['k', 'q'];
        const opp = other(turn);
        if (from === home && !attacked(board, home, opp)) {
          if (s.castling.includes(kc) && !board[home + 1] && !board[home + 2] && board[home + 3] === (turn === 'w' ? 'R' : 'r')
            && !attacked(board, home + 1, opp) && !attacked(board, home + 2, opp)) add(from, home + 2, { castle: 'K' });
          if (s.castling.includes(qc) && !board[home - 1] && !board[home - 2] && !board[home - 3] && board[home - 4] === (turn === 'w' ? 'R' : 'r')
            && !attacked(board, home - 1, opp) && !attacked(board, home - 2, opp)) add(from, home - 2, { castle: 'Q' });
        }
      }
    } else {
      const dirs = t === 'b' ? DIAG : t === 'r' ? ORTHO : [...DIAG, ...ORTHO];
      for (const [dr, df] of dirs) {
        let rr = r + dr, ff = f + df;
        while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
          const to = rr * 8 + ff;
          if (board[to]) { if (colorOf(board[to]) !== turn) add(from, to); break; }
          add(from, to);
          rr += dr; ff += df;
        }
      }
    }
  }
  return out;
}

export function makeMove(s: ChessState, m: Move): ChessState {
  const board = [...s.board];
  board[m.to] = m.promo || board[m.from];
  board[m.from] = '';
  if (m.ep) board[m.to + (s.turn === 'w' ? 8 : -8)] = '';
  if (m.castle === 'K') { board[m.to - 1] = board[m.to + 1]; board[m.to + 1] = ''; }
  if (m.castle === 'Q') { board[m.to + 1] = board[m.to - 2]; board[m.to - 2] = ''; }
  let castling = s.castling;
  const drop = (c: string) => { castling = castling.replace(c, ''); };
  if (m.piece === 'K') { drop('K'); drop('Q'); }
  if (m.piece === 'k') { drop('k'); drop('q'); }
  [[63, 'K'], [56, 'Q'], [7, 'k'], [0, 'q']].forEach(([sq, c]) => { if (m.from === sq || m.to === sq) drop(c as string); });
  const pawn = m.piece.toLowerCase() === 'p';
  const ep = pawn && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : -1;
  return {
    board,
    turn: other(s.turn),
    castling,
    ep,
    halfmove: pawn || m.captured ? 0 : s.halfmove + 1,
    fullmove: s.fullmove + (s.turn === 'b' ? 1 : 0),
    seen: [...s.seen, key(s)],
  };
}

export function legalMoves(s: ChessState): Move[] {
  return pseudoMoves(s).filter((m) => !inCheck({ ...s, board: makeMove(s, m).board }, s.turn));
}

export type Outcome = { over: false } | { over: true; winner: Color | null; reason: string };

export function outcome(s: ChessState, moves = legalMoves(s)): Outcome {
  if (!moves.length) {
    return inCheck(s) ? { over: true, winner: other(s.turn), reason: 'Checkmate' } : { over: true, winner: null, reason: 'Stalemate' };
  }
  if (s.halfmove >= 100) return { over: true, winner: null, reason: 'Draw by the 50-move rule' };
  const k = key(s);
  if (s.seen.filter((x) => x === k).length >= 2) return { over: true, winner: null, reason: 'Draw by repetition' };
  const pieces = s.board.filter((p) => p && p.toLowerCase() !== 'k').map((p) => p.toLowerCase());
  if (!pieces.length || (pieces.length === 1 && (pieces[0] === 'b' || pieces[0] === 'n'))) return { over: true, winner: null, reason: 'Draw: not enough pieces to mate' };
  return { over: false };
}

// Standard algebraic notation, e.g. Nf3, exd5, O-O, e8=Q+.
export function san(s: ChessState, m: Move, moves = legalMoves(s)): string {
  let out: string;
  if (m.castle) out = m.castle === 'K' ? 'O-O' : 'O-O-O';
  else {
    const t = m.piece.toUpperCase();
    const capture = !!m.captured;
    if (t === 'P') out = `${capture ? `${FILES[m.from % 8]}x` : ''}${sqName(m.to)}${m.promo ? `=${m.promo.toUpperCase()}` : ''}`;
    else {
      const rivals = moves.filter((o) => o.piece === m.piece && o.to === m.to && o.from !== m.from);
      let dis = '';
      if (rivals.length) {
        const sameFile = rivals.some((o) => o.from % 8 === m.from % 8);
        const sameRank = rivals.some((o) => Math.floor(o.from / 8) === Math.floor(m.from / 8));
        dis = !sameFile ? FILES[m.from % 8] : !sameRank ? sqName(m.from)[1] : sqName(m.from);
      }
      out = `${t}${dis}${capture ? 'x' : ''}${sqName(m.to)}`;
    }
  }
  const next = makeMove(s, m);
  const replies = legalMoves(next);
  if (inCheck(next)) out += replies.length ? '+' : '#';
  return out;
}

// ---- Computer player ---------------------------------------------------------

const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
// Piece-square tables (white's view, a8 first): small bonuses for good squares.
const PST: Record<string, number[]> = {
  p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};

// Score from the side to move's point of view (positive = good for them).
export function evaluate(s: ChessState): number {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = s.board[i];
    if (!p) continue;
    const t = p.toLowerCase();
    const white = p !== t;
    const v = VALUE[t] + PST[t][white ? i : (7 - Math.floor(i / 8)) * 8 + (i % 8)];
    score += white ? v : -v;
  }
  return s.turn === 'w' ? score : -score;
}

const order = (moves: Move[]) => moves
  .map((m) => ({ m, k: (m.captured ? 10 * VALUE[m.captured.toLowerCase()] - VALUE[m.piece.toLowerCase()] + 1000 : 0) + (m.promo ? 800 : 0) }))
  .sort((a, b) => b.k - a.k)
  .map((x) => x.m);

const MATE = 100000;

export interface SearchOptions { depth: number; timeMs?: number; randomness?: number; rand?: () => number }

// Picks a move for the side to move: alpha-beta search to `depth` (deepening
// step by step while time allows), then captures to the end so it doesn't
// stop in the middle of a trade. `randomness` (in centipawns) makes the
// easier levels play looser, varied moves.
export function bestMove(s: ChessState, opts: SearchOptions): Move | null {
  const moves = legalMoves(s);
  if (!moves.length) return null;
  const rand = opts.rand || Math.random;
  const deadline = opts.timeMs ? Date.now() + opts.timeMs : Infinity;
  let outOfTime = false;

  const quiesce = (st: ChessState, alpha: number, beta: number, depth: number): number => {
    const stand = evaluate(st);
    if (stand >= beta) return beta;
    if (alpha < stand) alpha = stand;
    if (depth <= 0) return alpha;
    for (const m of order(legalMoves(st).filter((x) => x.captured || x.promo))) {
      const score = -quiesce(makeMove(st, m), -beta, -alpha, depth - 1);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  };

  const search = (st: ChessState, depth: number, alpha: number, beta: number, ply: number): number => {
    if (Date.now() > deadline) { outOfTime = true; return 0; }
    const ms = legalMoves(st);
    if (!ms.length) return inCheck(st) ? -MATE + ply : 0;
    if (st.halfmove >= 100) return 0;
    if (depth === 0) return quiesce(st, alpha, beta, 4);
    for (const m of order(ms)) {
      const score = -search(makeMove(st, m), depth - 1, -beta, -alpha, ply + 1);
      if (outOfTime) return 0;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  };

  let scored: Array<{ m: Move; score: number }> = order(moves).map((m) => ({ m, score: 0 }));
  for (let depth = 1; depth <= opts.depth; depth++) {
    const round: Array<{ m: Move; score: number }> = [];
    for (const { m } of scored) {
      const score = -search(makeMove(s, m), depth - 1, -MATE - 1, MATE + 1, 1);
      if (outOfTime) break;
      round.push({ m, score });
    }
    if (outOfTime && round.length < scored.length) break; // keep the last full round
    scored = round.sort((a, b) => b.score - a.score);
    if (scored[0].score > MATE - 100) break; // found a mate
  }
  const noise = opts.randomness || 0;
  if (!noise) return scored[0].m;
  const jittered = scored.map((x) => ({ ...x, score: x.score + (rand() - 0.5) * 2 * noise }));
  jittered.sort((a, b) => b.score - a.score);
  return jittered[0].m;
}

export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: Record<Level, SearchOptions & { label: string }> = {
  easy: { label: 'Easy', depth: 1, randomness: 180 },
  medium: { label: 'Medium', depth: 2, randomness: 30 },
  hard: { label: 'Hard', depth: 5, timeMs: 1800 },
};

export function isValidState(s: any): s is ChessState {
  try {
    return s.board.length === 64 && (s.turn === 'w' || s.turn === 'b') && s.board.includes('K') && s.board.includes('k') && Array.isArray(s.seen);
  } catch { return false; }
}
