import React, { useEffect, useState } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import {
  KlondikeState, Card, From, To, newDeal, draw, move, autoMove, isWon, canAutoFinish, finishStep, isValidState,
} from '../../lib/klondike';
import { useGameSession } from './useGameSession';
import GameShell, { Felt, Segmented, gameBtn } from './GameShell';
import { CardFace, Slot, DragLayer, useBoardWidth, useCardDrag, cardSize } from './cards';

// Klondike solitaire. Click a card to send it somewhere useful (up to its
// foundation if it can go, else onto a column), or drag it where you want.

type Props = { config: Record<string, any>; onUpdateConfig: (c: Record<string, any>) => void };

export default function Klondike({ config, onUpdateConfig }: Props) {
  const drawCount: 1 | 3 = config.draw === 3 ? 3 : 1;
  const { session, game, apply, undo, canUndo, newGame, stats } = useGameSession<KlondikeState>({
    storageKey: 'pw6-game-klondike',
    create: () => newDeal(drawCount),
    isValid: isValidState,
    isWon,
    config,
    onUpdateConfig,
  });
  const [finishing, setFinishing] = useState(false);
  const busy = session.won || finishing;

  const { ref: boardRef, width } = useBoardWidth();
  const { gap, cw, ch } = cardSize(width, 7);
  const downStep = Math.round(ch * 0.11);
  const upStep = Math.round(ch * 0.25);
  const colX = (i: number) => i * (cw + gap);

  const { drag, dragIds, onCardDown } = useCardDrag<From>({
    disabled: busy,
    onClick: (from) => apply(autoMove(game, from)),
    onDrop: (from, spec) => {
      const to: To = { pile: spec[0] === 'f' ? 'foundation' : 'tableau', i: Number(spec.slice(1)) };
      apply(move(game, from, to));
    },
  });

  // Auto-finish: play the remaining cards up one at a time.
  useEffect(() => {
    if (!finishing) return;
    if (isWon(game)) { setFinishing(false); return; }
    const t = setTimeout(() => { if (!apply(finishStep(game))) setFinishing(false); }, 90);
    return () => clearTimeout(t);
  }, [finishing, game, apply]);

  const restart = (count: 1 | 3 = drawCount) => { setFinishing(false); newGame(() => newDeal(count)); };
  const setDraw = (count: 1 | 3) => {
    if (count === drawCount) return;
    onUpdateConfig({ ...config, draw: count });
    restart(count);
  };

  const cardStyle = (x: number, y: number, z: number): React.CSSProperties => ({ position: 'absolute', left: x, top: y, width: cw, height: ch, zIndex: z });
  const pileOffsets = (pile: Card[]) => {
    const ys: number[] = [];
    let y = 0;
    pile.forEach((c) => { ys.push(y); y += c.up ? upStep : downStep; });
    return ys;
  };
  const tableauHeight = Math.max(ch * 2.6, ...game.tableau.map((p) => { const ys = pileOffsets(p); return (ys[ys.length - 1] || 0) + ch; })) + gap;
  const wasteShown = game.waste.slice(drawCount === 3 ? -3 : -1);
  const fanStep = Math.round(cw * 0.24);

  return (
    <GameShell
      onNew={() => restart()}
      onUndo={() => { setFinishing(false); undo(); }}
      canUndo={canUndo}
      controls={<>
        <Segmented value={drawCount} onChange={setDraw} title="Changing this starts a new game"
          options={[{ value: 1, label: 'Draw 1' }, { value: 3, label: 'Draw 3' }]} />
        {canAutoFinish(game) && !finishing && (
          <button onClick={() => setFinishing(true)} className={`${gameBtn} bg-emerald-600 hover:bg-emerald-500 text-white`}>
            <Sparkles size={13} /> Finish
          </button>
        )}
      </>}
      moves={session.moves}
      elapsedMs={session.elapsedMs}
      won={session.won}
      help="Click a card to send it where it fits, or drag it."
      stats={stats}
    >
      <Felt>
        <div ref={boardRef} className="relative mx-auto" style={{ maxWidth: 7 * 112 + 6 * 14 }}>
          {/* Top row: stock, waste, (space), four foundations */}
          <div className="relative" style={{ height: ch + gap * 1.5 }}>
            <div className="absolute cursor-pointer" style={cardStyle(colX(0), 0, 1)}
              onClick={() => { if (!busy) apply(draw(game)); }}
              title={game.stock.length ? 'Turn over cards' : 'Turn the pile back over'}>
              {game.stock.length ? <CardFace card={game.stock[game.stock.length - 1]} w={cw} /> : <Slot label={<RotateCcw size={cw * 0.3} />} />}
            </div>

            <div className="absolute" style={cardStyle(colX(1), 0, 1)}>{!game.waste.length && <Slot />}</div>
            {wasteShown.map((c, k) => {
              const isTop = k === wasteShown.length - 1;
              return (
                <div key={c.id} style={{ ...cardStyle(colX(1) + k * fanStep, 0, 2 + k), visibility: dragIds.has(c.id) ? 'hidden' : undefined, cursor: isTop ? 'grab' : undefined }}
                  onPointerDown={isTop ? (e) => onCardDown(e, { pile: 'waste' }, [c]) : undefined}>
                  <CardFace card={c} w={cw} />
                </div>
              );
            })}

            {game.foundations.map((f, i) => {
              const topCard = f[f.length - 1];
              const under = f[f.length - 2];
              return (
                <div key={i} data-drop={`f${i}`} style={cardStyle(colX(3 + i), 0, 1)}>
                  <Slot label="A" w={cw} />
                  {under && topCard && dragIds.has(topCard.id) && <CardFace card={under} w={cw} />}
                  {topCard && (
                    <div className="absolute inset-0 cursor-grab" style={{ visibility: dragIds.has(topCard.id) ? 'hidden' : undefined }}
                      onPointerDown={(e) => onCardDown(e, { pile: 'foundation', i }, [topCard])}>
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
                  <div className="absolute" style={{ left: 0, top: 0, width: cw, height: ch }}><Slot label="K" w={cw} /></div>
                  {pile.map((c, index) => (
                    <div key={c.id}
                      style={{ ...cardStyle(0, ys[index], 2 + index), visibility: dragIds.has(c.id) ? 'hidden' : undefined, cursor: c.up ? 'grab' : 'default' }}
                      onPointerDown={c.up ? (e) => onCardDown(e, { pile: 'tableau', i, index }, pile.slice(index)) : undefined}>
                      <CardFace card={c} w={cw} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </Felt>
      <DragLayer drag={drag} cw={cw} ch={ch} step={upStep} />
    </GameShell>
  );
}
