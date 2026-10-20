import React from 'react';
import { ExternalLink } from 'lucide-react';
import DailyShell from './DailyShell';
import { formatDay, safeUrl } from '../../lib/dailyContent';

interface NewsItem {
  headline: string;
  dek?: string;
  body?: string;
  section?: string;
  basedOn?: { title: string; source?: string; url?: string }[];
}

interface NewsEntry {
  date: string;
  forDate: string; // the day this paper is dated (tomorrow, relative to `date`)
  masthead?: string;
  items: NewsItem[];
  sample?: boolean;
}

// Reads today's real headlines and writes tomorrow's front page. It is a
// forecast / fiction exercise, so the page says so and links the real stories
// each item was extrapolated from.
export default function TomorrowNews(_props: any) {
  return (
    <DailyShell<NewsEntry>
      kind="news"
      emptyText="No edition yet. The first one arrives after the daily task runs."
      render={(entry) => {
        const [lead, ...rest] = entry.items;
        return (
          <article className="flex flex-col gap-4">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs px-3 py-2">
              A forecast, not reporting. Written by Claude from today's real headlines; none of this has happened.
            </div>

            <header className="text-center border-y-2 border-zinc-800 dark:border-zinc-200 py-3">
              <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {entry.masthead || 'The Tomorrow Times'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{formatDay(entry.forDate, true)}</p>
            </header>

            {lead && <Story item={lead} lead />}
            {rest.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {rest.map((it, i) => <Story key={i} item={it} />)}
              </div>
            )}
          </article>
        );
      }}
    />
  );
}

function Story({ item, lead }: { item: NewsItem; lead?: boolean }) {
  return (
    <section className={`surface-card bg-white dark:bg-zinc-900 rounded-xl p-4 flex flex-col gap-2 `}>
      {item.section && (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">{item.section}</span>
      )}
      <h3 className={`font-serif font-bold text-zinc-900 dark:text-zinc-100 ${lead ? 'text-2xl' : 'text-lg'}`}>{item.headline}</h3>
      {item.dek && <p className="text-sm italic text-zinc-600 dark:text-zinc-300">{item.dek}</p>}
      {item.body && <p className="text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-line">{item.body}</p>}
      {item.basedOn && item.basedOn.length > 0 && (
        <p className="text-[11px] text-zinc-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span>Based on:</span>
          {item.basedOn.map((b, i) => {
            const url = safeUrl(b.url);
            const label = b.source ? `${b.title} (${b.source})` : b.title;
            return url ? (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-indigo-600 dark:hover:text-indigo-400">
                {label} <ExternalLink size={10} />
              </a>
            ) : (
              <span key={i}>{label}</span>
            );
          })}
        </p>
      )}
    </section>
  );
}
