// Moose Run: an endless runner. The moose runs right; rocks, stumps and fences
// come along the ground and geese fly at different heights. Jump over things,
// duck under geese. It speeds up the longer you last.
//
// World units: 600 wide, ground at y = 0, y counts upward.

export type Kind = 'rock' | 'rocks' | 'stump' | 'fence' | 'goose';
export interface Obstacle { kind: Kind; x: number; y: number; w: number; h: number }
export interface RunState {
  distance: number;
  speed: number;       // units per second
  y: number;           // moose height above ground
  vy: number;
  ducking: boolean;
  obstacles: Obstacle[];
  nextGap: number;     // distance until the next obstacle appears
  over: boolean;
}

export const WORLD_W = 600;
export const MOOSE_X = 40;
export const MOOSE = { w: 52, h: 48, duckW: 52, duckH: 30 };
const GRAVITY = 2600;
const JUMP_V = 760;
const START_SPEED = 330;
const MAX_SPEED = 820;
const ACCEL = 8; // per second

const SIZES: Record<Kind, [number, number]> = { rock: [20, 16], rocks: [40, 16], stump: [18, 30], fence: [34, 24], goose: [34, 22] };
// Goose heights: skims the ground (jump it), head height (duck), or high (run under).
const GOOSE_Y = [6, 34, 66];

export const score = (s: RunState) => Math.floor(s.distance / 10);

export function newRun(): RunState {
  return { distance: 0, speed: START_SPEED, y: 0, vy: 0, ducking: false, obstacles: [], nextGap: 500, over: false };
}

function spawn(s: RunState, rand: () => number) {
  const geese = score(s) > 250;
  const roll = rand();
  let kind: Kind;
  if (geese && roll < 0.22) kind = 'goose';
  else if (roll < 0.5) kind = 'rock';
  else if (roll < 0.68) kind = 'stump';
  else if (roll < 0.84) kind = 'rocks';
  else kind = 'fence';
  const [w, h] = SIZES[kind];
  const y = kind === 'goose' ? GOOSE_Y[Math.floor(rand() * GOOSE_Y.length)] : 0;
  s.obstacles.push({ kind, x: WORLD_W + 10, y, w, h });
  // Gap before the next one: always long enough to land and jump again.
  const air = (2 * JUMP_V) / GRAVITY;
  const minGap = s.speed * air * 1.25 + w;
  s.nextGap = minGap + rand() * s.speed * 1.1;
}

export function hitbox(s: RunState) {
  const h = s.ducking && s.y === 0 ? MOOSE.duckH : MOOSE.h;
  const w = s.ducking && s.y === 0 ? MOOSE.duckW : MOOSE.w;
  // A little forgiving: the drawn moose has antlers and legs with gaps.
  return { x: MOOSE_X + 6, y: s.y + 2, w: w - 12, h: h - 8 };
}

const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function collided(s: RunState): boolean {
  const me = hitbox(s);
  return s.obstacles.some((o) => overlap(me, { x: o.x + 3, y: o.y + 2, w: o.w - 6, h: o.h - 4 }));
}

// Advance the game by dt seconds. Changes and returns the same state (it runs
// 60 times a second, so no copying).
export function step(s: RunState, dt: number, input: { jump: boolean; duck: boolean }, rand: () => number = Math.random): RunState {
  if (s.over) return s;
  dt = Math.min(dt, 0.05); // a stalled tab shouldn't teleport you into a rock
  s.speed = Math.min(MAX_SPEED, s.speed + ACCEL * dt);
  const move = s.speed * dt;
  s.distance += move;

  const onGround = s.y <= 0;
  if (onGround && input.jump) s.vy = JUMP_V;
  s.ducking = input.duck;
  // Ducking in the air drops you faster.
  s.vy -= GRAVITY * (input.duck && !onGround ? 3 : 1) * dt;
  s.y = Math.max(0, s.y + s.vy * dt);
  if (s.y === 0 && s.vy < 0) s.vy = 0;

  s.obstacles.forEach((o) => { o.x -= move * (o.kind === 'goose' ? 1.12 : 1); });
  s.obstacles = s.obstacles.filter((o) => o.x + o.w > -20);
  s.nextGap -= move;
  if (s.nextGap <= 0) spawn(s, rand);

  if (collided(s)) s.over = true;
  return s;
}
