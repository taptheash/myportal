import React, { useEffect, useState } from 'react';
import { Lightbulb, Shuffle } from 'lucide-react';
import {
  MahjongState, Tile, newDeal, removePair, findPair, reshuffle, isFree, matches, isWon, isValidState, tilesLeft, BOARD_W, BOARD_H,
} from '../../lib/mahjong';
import { useGameSession, fmtTime } from './useGameSession';
import GameShell, { plainBtn } from './GameShell';
import { useBoardWidth } from './cards';

// Mahjong solitaire. Click two matching free tiles to take them off. A tile is
// free when nothing is on top of it and its left or right side is open.
// Flowers match any flower, seasons any season. Tiles are drawn from scratch.

type Props = { config: Record<string, any>; onUpdateConfig: (c: Record<string, any>) => void };

const CJK = "'Microsoft YaHei','PingFang SC','Hiragino Sans GB','Noto Sans CJK SC','Noto Sans SC',SimSun,sans-serif";
const NUMERALS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const WIND: Record<string, string> = { E: '東', S: '南', W: '西', N: '北' };
const FLOWER = ['', '梅', '蘭', '菊', '竹'];
const SEASON = ['', '春', '夏', '秋', '冬'];

const DOTS: Record<number, Array<[number, number]>> = {
  1: [[50, 65]],
  2: [[50, 36], [50, 94]],
  3: [[26, 30], [50, 65], [74, 100]],
  4: [[30, 36], [70, 36], [30, 94], [70, 94]],
  5: [[28, 32], [72, 32], [50, 65], [28, 98], [72, 98]],
  6: [[32, 28], [68, 28], [32, 65], [68, 65], [32, 102], [68, 102]],
  7: [[22, 20], [50, 36], [78, 52], [32, 84], [68, 84], [32, 112], [68, 112]],
  8: [[32, 20], [68, 20], [32, 50], [68, 50], [32, 80], [68, 80], [32, 110], [68, 110]],
  9: [[22, 28], [50, 28], [78, 28], [22, 65], [50, 65], [78, 65], [22, 102], [50, 102], [78, 102]],
};
const STICKS: Record<number, Array<[number, number]>> = {
  2: [[50, 36], [50, 94]],
  3: [[50, 36], [30, 94], [70, 94]],
  4: [[30, 36], [70, 36], [30, 94], [70, 94]],
  5: [[26, 36], [74, 36], [50, 65], [26, 94], [74, 94]],
  6: [[25, 36], [50, 36], [75, 36], [25, 94], [50, 94], [75, 94]],
  7: [[50, 24], [25, 68], [50, 68], [75, 68], [25, 108], [50, 108], [75, 108]],
  8: [[20, 36], [40, 36], [60, 36], [80, 36], [20, 94], [40, 94], [60, 94], [80, 94]],
  9: [[25, 26], [50, 26], [75, 26], [25, 65], [50, 65], [75, 65], [25, 104], [50, 104], [75, 104]],
};
const DOT_COLORS = ['#1d4ed8', '#15803d', '#b91c1c'];

function TileFace({ face }: { face: string }) {
  const kind = face[0];
  const n = Number(face.slice(1));
  const text = (ch: string, color: string, size: number, y = 66) => (
    <text x="50" y={y} textAnchor="middle" dominantBaseline="central" fontSize={size} fill={color} fontFamily={CJK} fontWeight={700}>{ch}</text>
  );
  let body: React.ReactNode = null;
  if (kind === 'd') {
    const r = n === 1 ? 24 : n >= 7 ? 11 : 13;
    body = DOTS[n].map(([x, y], k) => (
      <g key={k}>
        <circle cx={x} cy={y} r={r} fill={DOT_COLORS[(n === 1 ? 0 : k) % 3]} />
        <circle cx={x} cy={y} r={r * 0.62} fill="#fbf7ec" />
        <circle cx={x} cy={y} r={r * 0.32} fill={DOT_COLORS[(n === 1 ? 2 : k + 1) % 3]} />
      </g>
    ));
  } else if (kind === 'b') {
    if (n === 1) {
      body = (
        <g>
          <rect x="41" y="20" width="18" height="90" rx="8" fill="#15803d" />
          <rect x="38" y="42" width="24" height="5" rx="2" fill="#b91c1c" />
          <rect x="38" y="83" width="24" height="5" rx="2" fill="#b91c1c" />
        </g>
      );
    } else {
      const h = n >= 7 ? 30 : 38;
      body = STICKS[n].map(([x, y], k) => {
        const red = (n === 5 && k === 2) || (n === 9 && k % 3 === 1) || (n === 7 && k === 0);
        const fill = red ? '#b91c1c' : '#15803d';
        return (
          <g key={k}>
            <rect x={x - 5} y={y - h / 2} width="10" height={h} rx="4" fill={fill} />
            <rect x={x - 6.5} y={y - 1.5} width="13" height="3" rx="1.5" fill={red ? '#7f1d1d' : '#14532d'} />
          </g>
        );
      });
    }
  } else if (kind === 'c') {
    body = <>{text(NUMERALS[n], '#18181b', 40, 40)}{text('萬', '#b91c1c', 44, 96)}</>;
  } else if (kind === 'w') {
    body = text(WIND[face[1]], '#18181b', 62);
  } else if (kind === 'r') {
    body = face[1] === 'R' ? text('中', '#b91c1c', 64)
      : face[1] === 'G' ? text('發', '#15803d', 62)
      : <><rect x="20" y="22" width="60" height="86" rx="6" fill="none" stroke="#1d4ed8" strokeWidth="6" /><rect x="31" y="33" width="38" height="64" rx="3" fill="none" stroke="#1d4ed8" strokeWidth="3" /></>;
  } else if (kind === 'f' || kind === 's') {
    const color = kind === 'f' ? '#be185d' : '#0f766e';
    body = <>{text((kind === 'f' ? FLOWER : SEASON)[n], color, 58, 70)}<text x="14" y="22" fontSize="20" fill={color} fontFamily="sans-serif" fontWeight={700}>{n}</text></>;
  }
  return <svg viewBox="0 0 100 130" className="absolute inset-0 w-full h-full">{body}</svg>;
}

export default function Mahjong({ config, onUpdateConfig }: Props) {
  const { session, game, apply, undo, canUndo, newGame, stats } = useGameSession<MahjongState>({
    storageKey: 'pw6-game-mahjong',
    create: () => newDeal(),
    isValid: isValidState,
    isWon,
    config,
    onUpdateConfig,
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState<[number, number] | null>(null);
  const [stuckMsg, setStuckMsg] = useState('');

  // Clear the selection/hint whenever the tiles change (a move, undo, new game).
  useEffect(() => { setSelected(null); setHint(null); setStuckMsg(''); }, [game]);
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), 2500);
    return () => clearTimeout(t);
  }, [hint]);

  const { ref: boardRef, width } = useBoardWidth();
  const dz = Math.max(3, Math.round(width * 0.006));
  const tw = Math.max(26, Math.min(50, Math.floor((width - 6 * dz) / (BOARD_W / 2 + 0.3))));
  const th = Math.round(tw * 1.3);
  const side = Math.max(2, Math.round(dz * 0.8));
  const boardW = (BOARD_W / 2) * tw + 5 * dz + side;
  const boardH = (BOARD_H / 2) * th + 5 * dz + side;

  const stuck = !session.won && !findPair(game);

  const clickTile = (t: Tile) => {
    if (session.won || !isFree(game, t)) { setSelected(null); return; }
    if (selected === null || selected === t.id) { setSelected(selected === t.id ? null : t.id); return; }
    const other = game.tiles[selected];
    if (matches(other.face, t.face)) apply(removePair(game, selected, t.id));
    else setSelected(t.id);
  };

  const doShuffle = () => {
    const r = reshuffle(game);
    if (r) apply(r);
    else setStuckMsg("These tiles can't all come off any more. Undo a few moves or start a new game.");
  };

  const order = [...game.tiles].filter((t) => !t.gone).sort((a, b) => a.z - b.z || b.x - a.x || a.y - b.y);

  return (
    <GameShell
      onNew={() => newGame()}
      onUndo={undo}
      canUndo={canUndo}
      controls={<>
        <button onClick={() => setHint(findPair(game))} disabled={session.won || stuck} className={plainBtn}>
          <Lightbulb size={13} /> Hint
        </button>
        <button onClick={doShuffle} disabled={session.won} className={plainBtn} title="Rearrange the tiles left">
          <Shuffle size={13} /> Shuffle
        </button>
      </>}
      status={<span>{tilesLeft(game)} tiles left</span>}
      elapsedMs={session.elapsedMs}
      won={session.won}
      wonDetail={<>Cleared in {fmtTime(session.elapsedMs)}{game.shuffles ? ` with ${game.shuffles} shuffle${game.shuffles > 1 ? 's' : ''}` : ''}</>}
      help="Click two matching free tiles to take them off. A tile is free when nothing is on it and its left or right side is open. Flowers match any flower, seasons any season."
      stats={stats}
      showBestMoves={false}
    >
      <div className="relative rounded-xl p-3 sm:p-4 select-none"
        style={{ background: 'radial-gradient(ellipse at 50% 35%, #2b5f8a 0%, #1f4868 65%, #183a55 100%)' }}>
        <div ref={boardRef} className="relative mx-auto w-full" style={{ maxWidth: 15.3 * 50 + 40 }}>
          <div className="relative mx-auto" style={{ width: boardW, height: boardH }}>
            {order.map((t) => {
              const free = isFree(game, t);
              const isSel = selected === t.id;
              const isHint = !!hint && (hint[0] === t.id || hint[1] === t.id);
              return (
                <div key={t.id} onClick={() => clickTile(t)}
                  className={`absolute rounded-[12%] border ${free ? 'cursor-pointer' : 'cursor-default'}`}
                  style={{
                    left: side + (t.x / 2) * tw + t.z * dz,
                    top: (t.y / 2) * th + (4 - t.z) * dz,
                    width: tw,
                    height: th,
                    background: isSel ? '#fde68a' : isHint ? '#a5f3fc' : '#fbf7ec',
                    borderColor: isSel ? '#d97706' : '#b8a57a',
                    boxShadow: `${-side}px ${side}px 0 #d6c69c, ${-side - 1}px ${side + 1}px 0 #8f7d52, ${-side - 2}px ${side + 3}px 4px rgba(0,0,0,.35)`,
                  }}>
                  <TileFace face={t.face} />
                </div>
              );
            })}
          </div>
        </div>
        {stuck && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-40 flex items-center gap-3 rounded-xl bg-white dark:bg-zinc-900 px-4 py-2 shadow-xl text-sm">
            <span className="text-zinc-700 dark:text-zinc-200">{stuckMsg || 'No more matching pairs.'}</span>
            {!stuckMsg && <button onClick={doShuffle} className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium">Shuffle</button>}
            {stuckMsg && canUndo && <button onClick={undo} className="px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 font-medium">Undo</button>}
          </div>
        )}
      </div>
    </GameShell>
  );
}
