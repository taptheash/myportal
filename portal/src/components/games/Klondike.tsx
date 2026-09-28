import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, Undo2, Sparkles, Trophy } from 'lucide-react';
import {
  KlondikeState, Card, From, To, newDeal, draw, move, autoMove, isWon, canAutoFinish, finishStep,
  isValidState, isRed, RANK_LABEL, SUIT_SYMBOL,
} from '../../lib/klondike';

// Klondike solitaire. Click a card to send it somewhere useful (up to its
// foundation if it can go, else onto a column), or drag it where you want.
// The game in progress is kept per browser, so leaving the tab and coming back
// picks up where you were. Draw 1/3 and your stats live in the widget config.

interface Stats { played: number; won: number; bestMs: number | null; bestMoves: number | null }
interface Saved { game: KlondikeState; elapsedMs: number; started: boolean; won: boolean }

const SAVE_KEY = 'pw6-game-klondike';
const MAX_UNDO = 300;

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && isValidState(s.game) ? s : null;
  } catch { return null; }
}
function store(s: Saved) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ }
}
const fmtTime = (ms: number) => {
  const t = Math.floor(ms / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

// ---- Cards -------------------------------------------------------------------

function CardFace({ card, w }: { card: Card; w: number }) {
  if (!card.up) {
    return (
      <div className="absolute inset-0 rounded-[9%] border border-white/70 shadow-sm"
        style={{
          background: 'repeating-linear-gradient(45deg, #3730a3 0 4px, #4338ca 4px 8px)',
          boxShadow: 'inset 0 0 0 3px #eef2ff55, 0 1px 2px rgba(0,0,0,.35)',
        }} />
    );
  }
  const color = isRed(card.suit) ? '#c81e1e' : '#18181b';
  const rank = RANK_LABEL[card.rank];
  const sym = SUIT_SYMBOL[card.suit];
  const corner = (
    <div className="flex flex-col items-center leading-[0.95] font-semibold" style={{ fontSize: w * 0.2 }}>
      <span style={{ letterSpacing: rank === '10' ? '-0.08em' : undefined }}>{rank}</span>
      <span style={{ fontSize: w * 0.17 }}>{sym}</span>
    </div>
  );
  return (
    <div className="absolute inset-0 rounded-[9%] bg-white border border-zinc-300 select-none"
      style={{ color, boxShadow: '0 1px 2px rgba(0,0,0,.35)' }}>
      <div className="absolute" style={{ left: w * 0.06, top: w * 0.05 }}>{corner}</div>
      <div className="absolute rotate-180" style={{ right: w * 0.06, bottom: w * 0.05 }}>{corner}</div>
      <div className="absolute inset-0 flex items-center justify-center font-semibold"
        style={{ fontSize: card.rank > 10 ? w * 0.36 : w * 0.42 }}>
        {card.rank > 10 ? <span>{rank}<span style={{ fontSize: w * 0.26 }}>{sym}</span></span> : sym}
      </div>
    </div>
  );
}

const Slot = ({ label }: { label?: React.ReactNode }) => (
  <div className="absolute inset-0 rounded-[9%] border-2 border-dashed border-white/25 flex items-center justify-center text-white/35 font-semibold">
    {label}
  </div>
);

// ---- Game ----------------------------------------------------------------------

interface Drag { from: From; cards: Card[]; x: number; y: number; offX: number; offY: number }

export default function Klondike({ config, onUpdateConfig }: { config: Record<string, any>; onUpdateConfig: (c: Record<string, any>) => void }) {
  const drawCount: 1 | 3 = config.draw === 3 ? 3 : 1;
  const stats: Stats = { played: 0, won: 0, bestMs: null, bestMoves: null, ...(config.stats || {}) };

  const [saved, setSaved] = useState<Saved>(() => loadSaved() || { game: newDeal(drawCount), elapsedMs: 0, started: false, won: false });
  const history = useRef<KlondikeState[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [finishing, setFinishing] = useState(false);
  const game = saved.game;

  // Keep the latest config/stats reachable from callbacks without re-binding.
  const cfgRef = useRef(config);
  cfgRef.current = config;

  useEffect(() => { store(saved); }, [saved]);

  // Board sizing: seven columns across whatever width the page gives us.
  const boardRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const gap = Math.max(6, Math.round(width * 0.014));
  const cw = Math.min(112, Math.floor((width - gap * 6) / 7));
  const ch = Math.round(cw * 1.4);
  const downStep = Math.round(ch * 0.11);
  const upStep = Math.round(ch * 0.25);
  const colX = (i: number) => i * (cw + gap);

  // Timer: runs from your first move until you win, only while you're looking.
  useEffect(() => {
    if (!saved.started || saved.won) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') setSaved((s) => ({ ...s, elapsedMs: s.elapsedMs + 1000 }));
    }, 1000);
    return () => clearInterval(t);
  }, [saved.started, saved.won]);

  const recordStats = useCallback((patch: Partial<Stats>) => {
    const cur = cfgRef.current;
    onUpdateConfig({ ...cur, stats: { played: 0, won: 0, bestMs: null, bestMoves: null, ...(cur.stats || {}), ...patch } });
  }, [onUpdateConfig]);

  // Apply a new game state (from any move), with undo, stats and win check.
  // Works from a ref of the latest state so quick moves never see a stale one.
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const apply = useCallback((next: KlondikeState | null) => {
    if (!next) return false;
    const s = savedRef.current;
    history.current.push(s.game);
    if (history.current.length > MAX_UNDO) history.current.shift();
    const won = isWon(next);
    if (!s.started || (won && !s.won)) {
      const st: Stats = { played: 0, won: 0, bestMs: null, bestMoves: null, ...(cfgRef.current.stats || {}) };
      if (!s.started) st.played += 1;       // a game counts once you make a move
      if (won && !s.won) {
        st.won += 1;
        st.bestMs = st.bestMs == null ? s.elapsedMs : Math.min(st.bestMs, s.elapsedMs);
        st.bestMoves = st.bestMoves == null ? next.moves : Math.min(st.bestMoves, next.moves);
      }
      recordStats(st);
    }
    const n: Saved = { ...s, game: next, started: true, won };
    savedRef.current = n;
    setSaved(n);
    return true;
  }, [recordStats]);

  const newGame = (count: 1 | 3 = drawCount) => {
    history.current = [];
    setFinishing(false);
    setSaved({ game: newDeal(count), elapsedMs: 0, started: false, won: false });
  };
  const setDraw = (count: 1 | 3) => {
    if (count === drawCount) return;
    onUpdateConfig({ ...config, draw: count });
    newGame(count);
  };
  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (!prev) return;
    setFinishing(false);
    const s = savedRef.current;
    const n: Saved = { ...s, game: { ...prev, moves: s.game.moves + 1 }, won: false };
    savedRef.current = n;
    setSaved(n);
  }, []);

  // Ctrl+Z / Cmd+Z undoes, unless you're typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [undo]);

  // Auto-finish: play the remaining cards up one at a time.
  useEffect(() => {
    if (!finishing) return;
    if (isWon(game)) { setFinishing(false); return; }
    const t = setTimeout(() => { if (!apply(finishStep(game))) setFinishing(false); }, 90);
    return () => clearTimeout(t);
  }, [finishing, game, apply]);

  // ---- Pointer handling: a click auto-moves, a drag drops where you let go.
  const press = useRef<{ from: From; cards: Card[]; x: number; y: number; offX: number; offY: number } | null>(null);
  const dragging = useRef(false);

  const onCardDown = (e: React.PointerEvent, from: From) => {
    if (e.button !== 0 || saved.won || finishing) return;
    const cards = from.pile === 'waste' ? [game.waste[game.waste.length - 1]]
      : from.pile === 'foundation' ? [game.foundations[from.i][game.foundations[from.i].length - 1]]
      : game.tableau[from.i].slice(from.index);
    if (!cards.length || !cards[0].up) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    press.current = { from, cards, x: e.clientX, y: e.clientY, offX: e.clientX - r.left, offY: e.clientY - r.top };
    dragging.current = false;
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      if (!dragging.current && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 5) return;
      dragging.current = true;
      setDrag({ ...p, x: e.clientX, y: e.clientY });
    };
    const onUp = (e: PointerEvent) => {
      const p = press.current;
      press.current = null;
      if (!p) return;
      if (!dragging.current) { apply(autoMove(game, p.from)); return; }
      dragging.current = false;
      setDrag(null);
      const target = document.elementsFromPoint(e.clientX, e.clientY)
        .map((el) => (el as HTMLElement).closest?.('[data-drop]') as HTMLElement | null)
        .find(Boolean);
      const spec = target?.dataset.drop;
      if (!spec) return;
      const to: To = { pile: spec[0] === 'f' ? 'foundation' : 'tableau', i: Number(spec.slice(1)) };
      apply(move(game, p.from, to));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [game, apply]);

  const dragIds = new Set(drag?.cards.map((c) => c.id) || []);
  const cardStyle = (x: number, y: number, z: number): React.CSSProperties => ({ position: 'absolute', left: x, top: y, width: cw, height: ch, zIndex: z });

  // Tableau layout: face-down cards tuck close, face-up ones fan out.
  const pileOffsets = (pile: Card[]) => {
    const ys: number[] = [];
    let y = 0;
    pile.forEach((c) => { ys.push(y); y += c.up ? upStep : downStep; });
    return ys;
  };
  const tableauHeight = Math.max(ch * 2.6, ...game.tableau.map((p) => { const ys = pileOffsets(p); return (ys[ys.length - 1] || 0) + ch; })) + gap;

  const wasteShown = game.waste.slice(drawCount === 3 ? -3 : -1);
  const fanStep = Math.round(cw * 0.24);
  const won = saved.won;

  const btn = 'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150';

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => newGame()} className={`${btn} bg-indigo-600 hover:bg-indigo-500 text-white`}>
          <RotateCcw size={13} /> New game
        </button>
        <button onClick={undo} disabled={!history.current.length || won} title="Undo (Ctrl+Z)"
          className={`${btn} bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-default`}>
          <Undo2 size={13} /> Undo
        </button>
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5" title="Changing this starts a new game">
          {([1, 3] as const).map((n) => (
            <button key={n} onClick={() => setDraw(n)}
              className={`${btn} ${drawCount === n ? 'bg-white dark:bg-zinc-950 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
              Draw {n}
            </button>
          ))}
        </div>
        {canAutoFinish(game) && !finishing && (
          <button onClick={() => setFinishing(true)} className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-white`}>
            <Sparkles size={13} /> Finish
          </button>
        )}
        <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
          <span>Moves {game.moves}</span>
          <span>{fmtTime(saved.elapsedMs)}</span>
        </div>
      </div>

      {/* Table */}
      <div className="relative rounded-xl p-3 sm:p-4 select-none"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, #2f8a55 0%, #1f6b41 60%, #175233 100%)', touchAction: 'none' }}>
        <div ref={boardRef} className="relative mx-auto" style={{ maxWidth: 7 * 112 + 6 * 14 }}>
          {/* Top row: stock, waste, (space), four foundations */}
          <div className="relative" style={{ height: ch + gap * 1.5 }}>
            <div className="absolute cursor-pointer" style={cardStyle(colX(0), 0, 1)}
              onClick={() => { if (!won && !finishing) apply(draw(game)); }}
              title={game.stock.length ? 'Turn over cards' : 'Turn the pile back over'}>
              {game.stock.length ? <CardFace card={game.stock[game.stock.length - 1]} w={cw} /> : <Slot label={<RotateCcw size={cw * 0.3} />} />}
            </div>

            <div className="absolute" style={cardStyle(colX(1), 0, 1)}>
              {!game.waste.length && <Slot />}
            </div>
            {wasteShown.map((c, k) => {
              const isTop = k === wasteShown.length - 1;
              return (
                <div key={c.id} style={{ ...cardStyle(colX(1) + k * fanStep, 0, 2 + k), visibility: dragIds.has(c.id) ? 'hidden' : undefined, cursor: isTop ? 'grab' : undefined }}
                  onPointerDown={isTop ? (e) => onCardDown(e, { pile: 'waste' }) : undefined}>
                  <CardFace card={c} w={cw} />
                </div>
              );
            })}

            {game.foundations.map((f, i) => {
              const topCard = f[f.length - 1];
              const under = f[f.length - 2];
              return (
                <div key={i} data-drop={`f${i}`} style={cardStyle(colX(3 + i), 0, 1)}>
                  <Slot label={<span style={{ fontSize: cw * 0.3 }}>A</span>} />
                  {under && dragIds.has(topCard?.id) && <CardFace card={under} w={cw} />}
                  {topCard && (
                    <div className="absolute inset-0 cursor-grab" style={{ visibility: dragIds.has(topCard.id) ? 'hidden' : undefined }}
                      onPointerDown={(e) => onCardDown(e, { pile: 'foundation', i })}>
                      <CardFace card={topCard} w={cw} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tableau */}
          <div className="relative" style={{ height: tableauHeight }}>
            {game.tableau.map((pile, i) => {
              const ys = pileOffsets(pile);
              return (
                <div key={i} data-drop={`t${i}`} className="absolute" style={{ left: colX(i), top: 0, width: cw, height: tableauHeight }}>
                  <div className="absolute" style={{ left: 0, top: 0, width: cw, height: ch }}><Slot label={<span style={{ fontSize: cw * 0.3 }}>K</span>} /></div>
                  {pile.map((c, index) => (
                    <div key={c.id}
                      style={{ ...cardStyle(0, ys[index], 2 + index), visibility: dragIds.has(c.id) ? 'hidden' : undefined, cursor: c.up ? 'grab' : 'default' }}
                      onPointerDown={c.up ? (e) => onCardDown(e, { pile: 'tableau', i, index }) : undefined}>
                      <CardFace card={c} w={cw} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {won && (
          <div className="absolute inset-0 rounded-xl bg-black/45 flex items-center justify-center">
            <div className="rounded-2xl bg-white dark:bg-zinc-900 px-8 py-6 text-center shadow-2xl">
              <Trophy size={36} className="mx-auto text-amber-500" />
              <div className="mt-2 text-xl font-semibold text-zinc-900 dark:text-white">You won!</div>
              <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{game.moves} moves · {fmtTime(saved.elapsedMs)}</div>
              <button onClick={() => newGame()} className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium">Deal again</button>
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
        Click a card to send it where it fits, or drag it. Games won {stats.won} of {stats.played}
        {stats.bestMs != null && <> · best time {fmtTime(stats.bestMs)}</>}
        {stats.bestMoves != null && <> · fewest moves {stats.bestMoves}</>}.
      </p>

      {/* The card(s) you're dragging. Drawn on <body> so it follows the pointer
          exactly (a parent with a transform would otherwise offset it). */}
      {drag && createPortal(
        <div className="fixed pointer-events-none z-[300]" style={{ left: drag.x - drag.offX, top: drag.y - drag.offY, width: cw }}>
          {drag.cards.map((c, k) => (
            <div key={c.id} style={{ position: 'absolute', left: 0, top: k * upStep, width: cw, height: ch, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.35))' }}>
              <CardFace card={c} w={cw} />
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
