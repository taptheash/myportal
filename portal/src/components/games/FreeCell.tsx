import React from 'react';
import { FreeCellState, From, To, newDeal, move, autoMove, autoPlaySafe, isWon, isValidState } from '../../lib/freecell';
import { useGameSession } from './useGameSession';
import GameShell, { Felt } from './GameShell';
import { CardFace, Slot, DragLayer, useBoardWidth, useCardDrag, cardSize } from './cards';

// FreeCell. Everything is face up; four free cells hold one card each. Click
// a card to send it somewhere useful or drag it. Cards that can't be needed
// any more go up to the foundations by themselves.

type Props = { config: Record<string, any>; onUpdateConfig: (c: Record<string, any>) => void };

export default function FreeCell({ config, onUpdateConfig }: Props) {
  const { session, game, apply, undo, canUndo, newGame, stats } = useGameSession<FreeCellState>({
    storageKey: 'pw6-game-freecell',
    create: () => newDeal(),
    isValid: isValidState,
    isWon,
    config,
    onUpdateConfig,
  });
  const play = (n: FreeCellState | null) => apply(n ? autoPlaySafe(n) : null);

  const { ref: boardRef, width } = useBoardWidth();
  const { gap, cw, ch } = cardSize(width, 8, 104);
  const colX = (i: number) => i * (cw + gap);
  const maxPile = ch * 4.6;
  const stepFor = (n: number) => (n <= 1 ? 0 : Math.min(Math.round(ch * 0.25), (maxPile - ch) / (n - 1)));

  const { drag, dragIds, onCardDown } = useCardDrag<From>({
    disabled: session.won,
    onClick: (from) => play(autoMove(game, from)),
    onDrop: (from, spec) => {
      const i = Number(spec.slice(1));
      const to: To = spec[0] === 'c' ? { pile: 'cell', i } : spec[0] === 'f' ? { pile: 'foundation', i } : { pile: 'tableau', i };
      play(move(game, from, to));
    },
  });

  const box = (x: number, y: number, z = 1): React.CSSProperties => ({ position: 'absolute', left: x, top: y, width: cw, height: ch, zIndex: z });
  const tableauHeight = Math.max(ch * 2.6, ...game.tableau.map((p) => (p.length - 1) * stepFor(p.length) + ch)) + gap;

  return (
    <GameShell
      onNew={() => newGame()}
      onUndo={undo}
      canUndo={canUndo}
      status={<span>Game #{game.gameNo}</span>}
      moves={session.moves}
      elapsedMs={session.elapsedMs}
      won={session.won}
      help="Click a card to send it where it fits, or drag it. How many cards move at once depends on your free cells and empty columns."
      stats={stats}
    >
      <Felt>
        <div ref={boardRef} className="relative mx-auto" style={{ maxWidth: 8 * 104 + 7 * 14 }}>
          <div className="relative" style={{ height: ch + gap * 1.5 }}>
            {game.cells.map((c, i) => (
              <div key={`c${i}`} data-drop={`c${i}`} style={box(colX(i), 0)}>
                <Slot />
                {c && (
                  <div className="absolute inset-0 cursor-grab" style={{ visibility: dragIds.has(c.id) ? 'hidden' : undefined }}
                    onPointerDown={(e) => onCardDown(e, { pile: 'cell', i }, [c])}>
                    <CardFace card={c} w={cw} />
                  </div>
                )}
              </div>
            ))}
            {game.foundations.map((f, i) => {
              const t = f[f.length - 1];
              const under = f[f.length - 2];
              return (
                <div key={`f${i}`} data-drop={`f${i}`} style={box(colX(4 + i), 0)}>
                  <Slot label="A" w={cw} />
                  {under && t && dragIds.has(t.id) && <CardFace card={under} w={cw} />}
                  {t && (
                    <div className="absolute inset-0 cursor-grab" style={{ visibility: dragIds.has(t.id) ? 'hidden' : undefined }}
                      onPointerDown={(e) => onCardDown(e, { pile: 'foundation', i }, [t])}>
                      <CardFace card={t} w={cw} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="relative" style={{ height: tableauHeight }}>
            {game.tableau.map((pile, i) => {
              const step = stepFor(pile.length);
              return (
                <div key={i} data-drop={`t${i}`} className="absolute" style={{ left: colX(i), top: 0, width: cw, height: tableauHeight }}>
                  <div className="absolute" style={{ left: 0, top: 0, width: cw, height: ch }}><Slot /></div>
                  {pile.map((c, index) => (
                    <div key={c.id} style={{ ...box(0, index * step, 2 + index), visibility: dragIds.has(c.id) ? 'hidden' : undefined, cursor: 'grab' }}
                      onPointerDown={(e) => onCardDown(e, { pile: 'tableau', i, index }, pile.slice(index))}>
                      <CardFace card={c} w={cw} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </Felt>
      <DragLayer drag={drag} cw={cw} ch={ch} step={Math.round(ch * 0.25)} />
    </GameShell>
  );
}
