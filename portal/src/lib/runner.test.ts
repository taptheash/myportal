import { newRun, step, collided, score, RunState, MOOSE_X } from './runner';

const withObstacle = (kind: 'rock' | 'goose', x: number, y = 0): RunState => {
  const s = newRun();
  s.nextGap = 1e9;
  s.obstacles = [{ kind, x, y, w: kind === 'rock' ? 20 : 34, h: kind === 'rock' ? 16 : 22 }];
  return s;
};
const run = (s: RunState, seconds: number, input: (t: number) => { jump: boolean; duck: boolean }) => {
  for (let t = 0; t < seconds && !s.over; t += 1 / 60) step(s, 1 / 60, input(t));
  return s;
};

test('running into a rock ends the game', () => {
  expect(run(withObstacle('rock', 200), 2, () => ({ jump: false, duck: false })).over).toBe(true);
});

test('jumping at the right time clears a rock', () => {
  // Jump when the rock is about 70 units ahead.
  const s = withObstacle('rock', 200);
  let jumped = false;
  run(s, 2, () => {
    const o = s.obstacles[0];
    const now = !jumped && o && o.x - MOOSE_X < 110;
    if (now) jumped = true;
    return { jump: now, duck: false };
  });
  expect(jumped).toBe(true);
  expect(s.over).toBe(false);
  expect(s.obstacles.every((o) => o.x < MOOSE_X)).toBe(true); // the rock is behind us (or gone)
});

test('ducking passes under a head-height goose; standing does not', () => {
  expect(run(withObstacle('goose', 250, 34), 2, () => ({ jump: false, duck: true })).over).toBe(false);
  expect(run(withObstacle('goose', 250, 34), 2, () => ({ jump: false, duck: false })).over).toBe(true);
});

test('it speeds up and scores distance', () => {
  const s = newRun();
  s.nextGap = 1e9;
  const start = s.speed;
  run(s, 5, () => ({ jump: false, duck: false }));
  expect(s.speed).toBeGreaterThan(start);
  expect(score(s)).toBeGreaterThan(100);
  expect(collided(s)).toBe(false);
});

test('spawned obstacles always leave room to land before the next', () => {
  let seed = 1;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const s = newRun();
  for (let k = 0; k < 60 * 60; k++) {
    step(s, 1 / 60, { jump: false, duck: false }, rand);
    s.over = false; // keep going: we're only checking the spacing
    const ground = s.obstacles.filter((o) => o.kind !== 'goose').sort((a, b) => a.x - b.x);
    for (let i = 1; i < ground.length; i++) expect(ground[i].x - (ground[i - 1].x + ground[i - 1].w)).toBeGreaterThan(s.speed * 0.5);
  }
});
