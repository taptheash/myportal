import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PlayingCard, isRed, RANK_LABEL, SUIT_SYMBOL } from '../../lib/cardDeck';

// Shared pieces for the card games (Klondike, FreeCell, Spider): how a card
// looks, empty-pile outlines, board sizing, and click-or-drag handling.

export type { Suit, PlayingCard } from '../../lib/cardDeck';
export { isRed, RANK_LABEL, SUIT_SYMBOL } from '../../lib/cardDeck';

export function CardFace({ card, w }: { card: PlayingCard; w: number }) {
  if (!card.up) {
    return (
      <div className="absolute inset-0 rounded-[9%] border border-white/70"
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

// Dashed outline where a pile is empty.
export const Slot = ({ label, w }: { label?: React.ReactNode; w?: number }) => (
  <div className="absolute inset-0 rounded-[9%] border-2 border-dashed border-white/25 flex items-center justify-center text-white/35 font-semibold"
    style={w ? { fontSize: w * 0.3 } : undefined}>
    {label}
  </div>
);

// Width of the board, so cards scale to fit however many columns there are.
export function useBoardWidth(initial = 900) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

// Card size for `columns` across `width`, capped so cards don't get huge.
export function cardSize(width: number, columns: number, maxW = 112) {
  const gap = Math.max(5, Math.round(width * 0.012));
  const cw = Math.max(34, Math.min(maxW, Math.floor((width - gap * (columns - 1)) / columns)));
  return { gap, cw, ch: Math.round(cw * 1.4) };
}

// Click-or-drag. A press that moves under 5px is a click (onClick); otherwise
// the cards follow the pointer and onDrop gets the data-drop value of whatever
// they were let go over.
export interface Drag<F> { from: F; cards: PlayingCard[]; x: number; y: number; offX: number; offY: number }

export function useCardDrag<F>({ onClick, onDrop, disabled }: {
  onClick: (from: F) => void;
  onDrop: (from: F, target: string) => void;
  disabled?: boolean;
}) {
  const [drag, setDrag] = useState<Drag<F> | null>(null);
  const press = useRef<Drag<F> | null>(null);
  const dragging = useRef(false);
  const cb = useRef({ onClick, onDrop });
  cb.current = { onClick, onDrop };

  const onCardDown = (e: React.PointerEvent, from: F, cards: PlayingCard[]) => {
    if (e.button !== 0 || disabled || !cards.length) return;
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
      if (!dragging.current) { cb.current.onClick(p.from); return; }
      dragging.current = false;
      setDrag(null);
      const target = document.elementsFromPoint(e.clientX, e.clientY)
        .map((el) => (el as HTMLElement).closest?.('[data-drop]') as HTMLElement | null)
        .find(Boolean);
      if (target?.dataset.drop) cb.current.onDrop(p.from, target.dataset.drop);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const dragIds = new Set(drag?.cards.map((c) => c.id) || []);
  return { drag, dragIds, onCardDown };
}

// The card(s) being dragged. Drawn on <body> so they follow the pointer
// exactly (a parent with a transform would otherwise offset them).
export function DragLayer<F>({ drag, cw, ch, step }: { drag: Drag<F> | null; cw: number; ch: number; step: number }) {
  if (!drag) return null;
  return createPortal(
    <div className="fixed pointer-events-none z-[300]" style={{ left: drag.x - drag.offX, top: drag.y - drag.offY, width: cw }}>
      {drag.cards.map((c, k) => (
        <div key={c.id} style={{ position: 'absolute', left: 0, top: k * step, width: cw, height: ch, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.35))' }}>
          <CardFace card={c} w={cw} />
        </div>
      ))}
    </div>,
    document.body,
  );
}
