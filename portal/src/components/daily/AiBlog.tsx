import React from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import DailyShell from './DailyShell';
import { safeUrl } from '../../lib/dailyContent';

interface BlogEntry {
  date: string;
  title: string;
  tldr?: string;
  paper?: { title: string; authors?: string; url?: string; venue?: string };
  sections: { heading?: string; paragraphs: string[] }[];
  sample?: boolean;
}

// One post a day about a recent AI paper, written in plain language with a
// link to the paper itself. Plain text only: paragraphs are rendered as text,
// never as HTML.
export default function AiBlog(_props: any) {
  return (
    <DailyShell<BlogEntry>
      kind="blog"
      emptyText="No posts yet. The first one arrives after the daily task runs."
      render={(entry) => {
        const paperUrl = safeUrl(entry.paper?.url);
        return (
          <article className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{entry.title}</h2>
            {entry.tldr && (
              <p className="text-sm text-zinc-700 dark:text-zinc-200 border-l-4 border-indigo-500 pl-3">{entry.tldr}</p>
            )}

            {entry.paper && (
              <div className="surface-card bg-white dark:bg-zinc-900 rounded-xl p-3 flex items-start gap-3">
                <FileText size={18} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">The paper</span>
                  {paperUrl ? (
                    <a href={paperUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center gap-1">
                      {entry.paper.title} <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{entry.paper.title}</span>
                  )}
                  {(entry.paper.authors || entry.paper.venue) && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {[entry.paper.authors, entry.paper.venue].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {entry.sections.map((s, i) => (
              <section key={i} className="flex flex-col gap-2">
                {s.heading && <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{s.heading}</h3>}
                {s.paragraphs.map((p, j) => (
                  <p key={j} className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{p}</p>
                ))}
              </section>
            ))}

            <p className="text-[11px] text-zinc-400">Researched and written by Claude. Check the paper itself before relying on any detail here.</p>
          </article>
        );
      }}
    />
  );
}
