// Runs the computer player off the main thread so the page stays responsive
// while it thinks. Receives { id, state, level } and replies { id, move }.
/* eslint-disable no-restricted-globals */
import { bestMove, LEVELS, ChessState, Level } from './chess';

self.onmessage = (e: MessageEvent<{ id: number; state: ChessState; level: Level }>) => {
  const { id, state, level } = e.data;
  const move = bestMove(state, LEVELS[level]);
  (self as unknown as Worker).postMessage({ id, move });
};

export {};
