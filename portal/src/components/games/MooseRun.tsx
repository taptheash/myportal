import React, { useEffect, useRef, useState } from 'react';
import { RunState, Obstacle, newRun, step, score, WORLD_W, MOOSE_X } from '../../lib/runner';
import { useBoardWidth } from './cards';

// Moose Run: an endless runner. Space / Up (or click / tap) to jump, Down to
// duck. Jump rocks, stumps and fences; duck the geese. Gets faster as you go.
// All drawn from scratch as pixel art.

type Props = { config: Record<string, any>; onUpdateConfig: (c: Record<string, any>) => void };

// Pixel art: X = filled. Each pixel is 2 world units.
const RUN_A = [
  '................X.X..X.X..',
  '...............XXXXX.XXX..',
  '..............XXXXXXXXXX..',
  '...............XXXXXXXX...',
  '..................XXX.....',
  '.................XXXXX....',
  '...........XX...XXXXXXX...',
  '........XXXXXXX.XXXXXXXXX.',
  '.....XXXXXXXXXXXXXXXXXXXXX',
  '...XXXXXXXXXXXXXXXXX..XXXX',
  '.XXXXXXXXXXXXXXXXXXX...XX.',
  'XXXXXXXXXXXXXXXXXXXX.X....',
  'XXXXXXXXXXXXXXXXXXX..X....',
  'XXXXXXXXXXXXXXXXXXX.......',
  'XXXXXXXXXXXXXXXXXXX.......',
  '.XXXXXXXXXXXXXXXXX........',
  '..XXX.XX....XXXXX.........',
  '..XX...X....XX..X.........',
  '..XX...X....XX..X.........',
  '..X....X....X...X.........',
  '..X....X....X....X........',
  '..X....X....X....X........',
  '..X.....X...X.....X.......',
  '.XX....XX..XX....XX.......',
];
const RUN_B = [
  ...RUN_A.slice(0, 16),
  '..XXX.XX....XXXXX.........',
  '...XX.X......XX.X.........',
  '...X..X......X..X.........',
  '...X..X......X..X.........',
  '..X...X.....X...X.........',
  '..X...X.....X...X.........',
  '.X....X....X....X.........',
  'XX...XX...XX...XX.........',
];
const DUCK = [
  '.....................X.X..',
  '....................XXXXX.',
  '...........XX......XXXXXX.',
  '........XXXXXXX...XXXXX...',
  '.....XXXXXXXXXXXXXXXXXXX..',
  '...XXXXXXXXXXXXXXXXXXXXXXX',
  '.XXXXXXXXXXXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXXXXXX...XX.',
  'XXXXXXXXXXXXXXXXXXX..X....',
  'XXXXXXXXXXXXXXXXXXX.......',
  '.XXXXXXXXXXXXXXXXX........',
  '..XXX.XX....XXXXX.........',
  '..XX...X....XX..X.........',
  '..X....X....X...X.........',
  '.XX....XX..XX...XX........',
];
const GOOSE_UP = [
  '....XX...........',
  '....XXX..........',
  '.....XXX.........',
  '......XXX........',
  'XX....XXXX.......',
  'XXXXXXXXXXXXXXX..',
  '..XXXXXXXXXXXXXXX',
  '.....XXXXXXXXX...',
  '.................',
];
const GOOSE_DOWN = [
  '.................',
  '.................',
  '.................',
  '.................',
  'XX...............',
  'XXXXXXXXXXXXXXX..',
  '..XXXXXXXXXXXXXXX',
  '.....XXXXXX......',
  '......XXXX.......',
  '......XXX........',
  '.....XXX.........',
];

// Draws each row as runs of filled pixels, overlapping a hair so no seams
// show when the canvas is scaled.
function drawPixels(ctx: CanvasRenderingContext2D, rows: string[], x: number, yTop: number, px: number) {
  rows.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (row[c] !== 'X') { c++; continue; }
      let end = c;
      while (end < row.length && row[end] === 'X') end++;
      ctx.fillRect(x + c * px, yTop + r * px, (end - c) * px + 0.3, px + 0.3);
      c = end;
    }
  });
}

export default function MooseRun({ config, onUpdateConfig }: Props) {
  const best: number = config.best || 0;
  const played: number = config.played || 0;
  const { ref: boxRef, width } = useBoardWidth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const run = useRef<RunState>(newRun());
  // `tapped` remembers a quick press for a moment so it isn't lost between frames.
  const keys = useRef({ jump: false, duck: false, tapped: 0 });
  const [phase, setPhase] = useState<'ready' | 'running' | 'over'>('ready');
  const [shown, setShown] = useState(0);
  const cfgRef = useRef(config);
  cfgRef.current = config;

  const viewW = Math.min(width, 900);
  const scale = viewW / WORLD_W;
  const viewH = Math.round(170 * scale);

  const start = () => {
    run.current = newRun();
    keys.current = { jump: false, duck: false, tapped: 0 };
    setShown(0);
    setPhase('running');
  };

  // Input: Space / Up / W jump, Down / S duck; click or tap jumps too.
  useEffect(() => {
    const isJump = (k: string) => k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W';
    const isDuck = (k: string) => k === 'ArrowDown' || k === 's' || k === 'S';
    const down = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (!isJump(e.key) && !isDuck(e.key)) return;
      e.preventDefault();
      if (phase !== 'running') { if (isJump(e.key)) start(); return; }
      if (isJump(e.key)) { keys.current.jump = true; keys.current.tapped = performance.now(); }
      if (isDuck(e.key)) keys.current.duck = true;
    };
    const up = (e: KeyboardEvent) => {
      if (isJump(e.key)) keys.current.jump = false;
      if (isDuck(e.key)) keys.current.duck = false;
    };
    document.addEventListener('keydown', down);
    document.addEventListener('keyup', up);
    return () => { document.removeEventListener('keydown', down); document.removeEventListener('keyup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Game loop + drawing.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    let raf = 0;
    let last = performance.now();
    let frame = 0;

    const draw = () => {
      const s = run.current;
      const dark = document.documentElement.classList.contains('dark');
      const ink = dark ? '#d4d4d8' : '#3f3f46';
      const soft = dark ? '#3f3f46' : '#d4d4d8';
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      ctx.clearRect(0, 0, WORLD_W, 170);
      const groundY = 150; // screen y of the ground line
      const toScreen = (y: number, h: number) => groundY - y - h;

      // Distant pines, drifting slowly.
      ctx.fillStyle = soft;
      const off = (s.distance * 0.15) % 120;
      for (let k = -1; k < 7; k++) {
        const x = k * 120 - off + ((k * 37) % 50);
        const h = 34 + ((k * 13) % 18);
        ctx.beginPath(); ctx.moveTo(x, groundY - 2); ctx.lineTo(x + 12, groundY - 2 - h); ctx.lineTo(x + 24, groundY - 2); ctx.fill();
      }
      // Ground line with gravel flecks.
      ctx.fillStyle = ink;
      ctx.fillRect(0, groundY, WORLD_W, 1.5);
      const flecks = (s.distance) % 40;
      for (let x = -flecks; x < WORLD_W; x += 40) { ctx.fillRect(x + 7, groundY + 5, 3, 1.5); ctx.fillRect(x + 26, groundY + 10, 2, 1.5); }

      // Obstacles.
      s.obstacles.forEach((o: Obstacle) => {
        const top = toScreen(o.y, o.h);
        if (o.kind === 'rock' || o.kind === 'rocks') {
          const n = o.kind === 'rocks' ? 2 : 1;
          for (let k = 0; k < n; k++) {
            const x = o.x + k * 20;
            ctx.beginPath();
            ctx.moveTo(x, groundY); ctx.lineTo(x + 2, top + 6); ctx.lineTo(x + 7, top); ctx.lineTo(x + 15, top + 2); ctx.lineTo(x + 20, top + 9); ctx.lineTo(x + 20, groundY);
            ctx.fill();
          }
        } else if (o.kind === 'stump') {
          ctx.fillRect(o.x + 2, top + 3, o.w - 4, o.h - 3);
          ctx.fillRect(o.x, groundY - 4, o.w, 4);
          ctx.fillStyle = dark ? '#18181b' : '#fafafa';
          ctx.fillRect(o.x + 5, top + 6, o.w - 10, 1.5);
          ctx.fillStyle = ink;
          ctx.fillRect(o.x + 1, top, o.w - 2, 4);
        } else if (o.kind === 'fence') {
          ctx.fillRect(o.x + 2, top, 4, o.h);
          ctx.fillRect(o.x + o.w - 6, top, 4, o.h);
          ctx.fillRect(o.x, top + 5, o.w, 3);
          ctx.fillRect(o.x, top + 14, o.w, 3);
        } else {
          drawPixels(ctx, frame % 16 < 8 ? GOOSE_UP : GOOSE_DOWN, o.x, top, 2);
        }
      });

      // Moose.
      const ducking = s.ducking && s.y === 0;
      const sprite = ducking ? DUCK : s.y > 0 ? RUN_A : (Math.floor(s.distance / 30) % 2 ? RUN_A : RUN_B);
      drawPixels(ctx, sprite, MOOSE_X, toScreen(s.y, sprite.length * 2), 2);

      // Score.
      ctx.font = 'bold 13px ui-monospace, Menlo, Consolas, monospace';
      ctx.textAlign = 'right';
      const hi = Math.max(cfgRef.current.best || 0, score(s));
      ctx.fillText(`HI ${String(hi).padStart(5, '0')}   ${String(score(s)).padStart(5, '0')}`, WORLD_W - 8, 20);
    };

    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      frame++;
      if (phase === 'running' && document.visibilityState === 'visible') {
        const k = keys.current;
        const s = step(run.current, dt, { jump: k.jump || now - k.tapped < 150, duck: k.duck });
        if (s.y > 0) k.tapped = 0; // that press has been used
        if (frame % 6 === 0) setShown(score(s));
        if (s.over) {
          const c = cfgRef.current;
          onUpdateConfig({ ...c, best: Math.max(c.best || 0, score(s)), played: (c.played || 0) + 1 });
          setShown(score(s));
          setPhase('over');
        }
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, viewW, viewH]);

  const tap = (e: React.PointerEvent) => {
    e.preventDefault();
    if (phase !== 'running') { start(); return; }
    keys.current.tapped = performance.now();
  };

  return (
    <div className="flex flex-col gap-3">
      <div ref={boxRef} className="w-full">
        <div className="relative mx-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 overflow-hidden select-none"
          style={{ width: viewW, height: viewH, touchAction: 'none' }} onPointerDown={tap}>
          <canvas ref={canvasRef} style={{ width: viewW, height: viewH, display: 'block' }} />
          {phase !== 'running' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-zinc-700 dark:text-zinc-200">
              {phase === 'over' && <div className="text-lg font-bold tracking-widest">GAME OVER</div>}
              <div className="text-sm">{phase === 'ready' ? 'Press Space or tap to start' : `Score ${shown}. Press Space or tap to run again`}</div>
            </div>
          )}
        </div>
      </div>
      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
        Space or Up to jump, Down to duck (or tap to jump). Jump the rocks, stumps and fences; duck the geese. Best {best} · runs {played}.
      </p>
    </div>
  );
}
