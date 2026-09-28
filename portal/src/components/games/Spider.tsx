import React from 'react';
import { SpiderState, SuitCount, From, newDeal, move, autoMove, dealRow, isWon, isValidState } from '../../lib/spider';
import { useGameSession } from './useGameSession';
import GameShell, { Felt, Segmented } from './GameShell';
import { CardFace, Slot, DragLayer, useBoardWidth, useCardDrag, cardSize } from './cards';

// Spider. Build down in any suit, but only same-suit runs move together.
// A full King-to-Ace run in one suit lifts off; lift all eight to win.
// 1 suit is relaxed, 2 is a real game, 4 is hard. Stats are kept per level.

type Props = { config: Record<string, any>; onUpdateConfig: (c: Record<string, any>) => void };

export default function Spider({ config, onUpdateConfig }: Props) {
  const suits: SuitCount = config.suits === 2 || config.suits === 4 ? config.suits : 1;
  const { session, game, apply, undo, canUndo, newGame, stats } = useGameSession<SpiderState>({
    storageKey: 'pw6-game-spider',
    create: () => newDeal(suits),
    isValid: isValidState,
    isWon,
    config,
    onUpdateConfig,
    statsKey: `suits${suits}`,
  });

  const { ref: boardRef, width } = useBoardWidth();
  const { gap, cw, ch } = cardSize(width, 10, 96);
  const colX = (i: number) => i * (cw + gap);
  const downStep = Math.round(ch * 0.09);
  const maxPile = ch * 5;
  const upStepFor = (downs: number, ups: number) =>
    ups <= 1 ? 0 : Math.min(Math.round(ch * 0.24), (maxPile - ch - downs * downStep) / (ups - 1));

  const { drag, dragIds, onCardDown } = useCardDrag<From>({
    disabled: session.won,
    onClick: (from) => apply(autoMove(game, from)),
    onDrop: (from, spec) => apply(move(game, from, Number(spec.slice(1)))),
  });

  const setSuits = (n: SuitCount) => {
    if (n === suits) return;
    onUpdateConfig({ ...config, suits: n });
    newGame(() => newDeal(n));
  };

  const box = (x: number, y: number, z = 1): React.CSSProperties => ({ position: 'absolute', left: x, top: y, width: cw, height: ch, zIndex: z });
  const layout = game.tableau.map((pile) => {
    const downs = pile.filter((c) => !c.up).length;
    const up = upStepFor(downs, pile.length - downs);
    let y = 0;
    return pile.map((c) => { const at = y; y += c.up ? up : downStep; return at; });
  });
  const tableauHeight = Math.max(ch * 3, ...layout.map((ys) => (ys[ys.length - 1] || 0) + ch)) + gap;
  const dealsLeft = game.stock.length / 10;
  const emptyColumn = game.tableau.some((p) => !p.length);

  return (
    <GameShell
      onNew={() => newGame()}
      onUndo={undo}
      canUndo={canUndo}
      controls={<Segmented value={suits} onChange={setSuits} title="Changing this starts a new game"
        options={[{ value: 1, label: '1 suit' }, { value: 2, label: '2 suits' }, { value: 4, label: '4 suits' }]} />}
      moves={session.moves}
      elapsedMs={session.elapsedMs}
      won={session.won}
      help="Click a run to move it, or drag it. Click the stock (top right) to deal a card onto every column; you can't deal while a column is empty."
      stats={stats}
    >
      <Felt>
        <div ref={boardRef} className="relative mx-auto" style={{ maxWidth: 10 * 96 + 9 * 12 }}>
          <div className="relative" style={{ height: ch + gap * 1.5 }}>
            {/* Finished runs, shown as their King */}
            {Array.from({ length: 8 }, (_, k) => {
              const suit = game.completed[k];
              return (
                <div key={k} style={box(k * Math.round(cw * 0.32), 0, 1 + k)}>
                  {suit ? <CardFace card={{ id: `done${k}`, suit, rank: 13, up: true }} w={cw} /> : k === 0 ? <Slot /> : null}
                </div>
              );
            })}
            {/* Stock */}
            <div style={{ ...box(colX(9) - Math.max(0, dealsLeft - 1) * Math.round(cw * 0.12), 0, 1), width: cw + Math.max(0, dealsLeft - 1) * Math.round(cw * 0.12) }}
              className={dealsLeft && !session.won ? 'cursor-pointer' : ''}
              title={!dealsLeft ? 'No more deals' : emptyColumn ? 'Fill every column before dealing' : `Deal a row (${dealsLeft} left)`}
              onClick={() => { if (!session.won) apply(dealRow(game)); }}>
              {dealsLeft ? Array.from({ length: dealsLeft }, (_, k) => (
                <div key={k} style={box(k * Math.round(cw * 0.12), 0, 1 + k)}>
                  <CardFace card={{ id: `stock${k}`, suit: 'S', rank: 1, up: false }} w={cw} />
                </div>
              )) : <div style={box(Math.max(0, dealsLeft - 1) * Math.round(cw * 0.12), 0)}><Slot /></div>}
              {dealsLeft > 0 && emptyColumn && (
                <div className="absolute inset-0 rounded-[9%] bg-black/35 z-20" />
              )}
            </div>
          </div>

          <div className="relative" style={{ height: tableauHeight }}>
            {game.tableau.map((pile, i) => (
              <div key={i} data-drop={`t${i}`} className="absolute" style={{ left: colX(i), top: 0, width: cw, height: tableauHeight }}>
                <div className="absolute" style={{ left: 0, top: 0, width: cw, height: ch }}><Slot /></div>
                {pile.map((c, index) => (
                  <div key={c.id} style={{ ...box(0, layout[i][index], 2 + index), visibility: dragIds.has(c.id) ? 'hidden' : undefined, cursor: c.up ? 'grab' : 'default' }}
                    onPointerDown={c.up ? (e) => onCardDown(e, { i, index }, pile.slice(index)) : undefined}>
                    <CardFace card={c} w={cw} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Felt>
      <DragLayer drag={drag} cw={cw} ch={ch} step={Math.round(ch * 0.24)} />
    </GameShell>
  );
}
