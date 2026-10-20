import React from 'react';
import DailyShell from './DailyShell';
import { svgToDataUri } from '../../lib/dailyContent';

interface ComicPanel {
  svg: string;
  caption?: string;
  dialogue?: { who: string; text: string }[];
}

interface ComicEntry {
  date: string;
  title: string;
  panels: ComicPanel[];
  directorNote?: string;
  sample?: boolean;
}

// One strip per day, made by a three-agent chain: the Director picks the
// premise and keeps the cast "bible", the Storyteller writes the script, the
// Cartoonist draws each panel as SVG. Words live under each panel as plain
// text, so the drawings stay clean and the dialogue stays readable.
export default function ComicBook(_props: any) {
  return (
    <DailyShell<ComicEntry>
      kind="comic"
      emptyText="No strips yet. The first one arrives after the daily task runs."
      render={(entry) => (
        <article className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{entry.title}</h2>
          <div className={`grid gap-3 ${entry.panels.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {entry.panels.map((p, i) => {
              const src = svgToDataUri(p.svg);
              return (
                <figure key={i} className="surface-card bg-white dark:bg-zinc-900 rounded-xl overflow-hidden flex flex-col">
                  {src ? (
                    <img src={src} alt={p.caption || `Panel ${i + 1}`} className="w-full bg-white block" />
                  ) : (
                    <div className="aspect-[320/220] flex items-center justify-center text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800">Panel unavailable</div>
                  )}
                  {(p.caption || (p.dialogue && p.dialogue.length > 0)) && (
                    <figcaption className="px-3 py-2 flex flex-col gap-1 text-sm text-zinc-800 dark:text-zinc-100">
                      {p.caption && <span className="italic text-zinc-500 dark:text-zinc-400">{p.caption}</span>}
                      {p.dialogue?.map((d, j) => (
                        <span key={j}><b>{d.who}:</b> {d.text}</span>
                      ))}
                    </figcaption>
                  )}
                </figure>
              );
            })}
          </div>
          {entry.directorNote && (
            <details className="text-xs text-zinc-500 dark:text-zinc-400">
              <summary className="cursor-pointer select-none">Director's note</summary>
              <p className="mt-1">{entry.directorNote}</p>
            </details>
          )}
          <p className="text-[11px] text-zinc-400">Directed, written and drawn by Claude: Director → Storyteller → Cartoonist.</p>
        </article>
      )}
    />
  );
}
