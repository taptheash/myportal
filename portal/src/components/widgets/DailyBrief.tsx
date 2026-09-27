import React, { useEffect, useRef, useState } from 'react';
import { Sunrise, Newspaper, Sun, CalendarDays, ListChecks, Trophy, TrendingUp, TrendingDown, ExternalLink, Loader2 } from 'lucide-react';
import { allCategories, fetchCategory, DEFAULT_MY_NEWS, TaggedArticle } from '../../lib/newsCategories';
import { getWidgetConfig } from '../../lib/portalStorage';
import { getAllTaskItems } from './Notes';
import { DEFAULT_TEAMS } from './Sports';
import CompactWeather from '../home/CompactWeather';
import TodayAgenda from '../home/TodayAgenda';
import SaveButton from './SaveButton';

interface BriefProps {
  id: string;
  config: Record<string, any>;
  onUpdateConfig: (config: Record<string, any>) => void;
  isEditing: boolean;
}

// A one-minute morning read, built fresh each time it's opened: the top
// story from each My News category, today's weather, calendar, tasks due,
// your teams' games today, and a market snapshot. Plain text and links.

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Section({ icon: Icon, title, children }: { icon: typeof Sun; title: string; children: React.ReactNode }) {
  return (
    <section className="surface-card bg-white dark:bg-zinc-900 rounded-xl p-3 flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        <Icon size={13} className="text-indigo-500" /> {title}
      </h3>
      {children}
    </section>
  );
}

function TopStories({ nonce }: { nonce: unknown }) {
  const [stories, setStories] = useState<TaggedArticle[] | null>(null);
  const lastNonce = useRef(nonce);
  useEffect(() => {
    const force = nonce !== undefined && nonce !== lastNonce.current;
    lastNonce.current = nonce;
    const picked: string[] = getWidgetConfig('mynews').categories || DEFAULT_MY_NEWS;
    const cats = allCategories().filter((c) => picked.includes(c.key));
    let cancelled = false;
    Promise.allSettled(cats.map((c) => fetchCategory(c, force))).then((results) => {
      if (cancelled) return;
      const seen = new Set<string>();
      const top: TaggedArticle[] = [];
      results.forEach((r) => {
        if (r.status !== 'fulfilled') return;
        const first = r.value.find((a) => a.link && !seen.has(a.link));
        if (first) { seen.add(first.link); top.push(first); }
      });
      setStories(top);
    });
    return () => { cancelled = true; };
  }, [nonce]);

  if (!stories) return <Loader2 size={14} className="animate-spin text-zinc-400" />;
  if (stories.length === 0) return <p className="text-xs text-zinc-400">No stories right now. Pick categories in My News.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {stories.map((s) => (
        <li key={s.link}>
          <a href={s.link} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-2">
            <span className="mt-0.5 px-1.5 py-px rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 flex-shrink-0 w-20 truncate text-center">{s.categoryLabel}</span>
            <span className="flex-1 min-w-0 text-sm text-zinc-800 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-150">
              {s.title} <span className="text-xs text-zinc-400">— {s.sourceName}</span>
            </span>
            <SaveButton article={{ link: s.link, title: s.title, source: s.sourceName }} size={13} />
            <ExternalLink size={12} className="flex-shrink-0 text-zinc-400 mt-1" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function TasksToday() {
  const today = todayKey();
  const tasks = getAllTaskItems(getWidgetConfig('tasks')).filter((t) => !t.done && t.dueDate && t.dueDate <= today);
  if (tasks.length === 0) return <p className="text-xs text-zinc-400 dark:text-zinc-500">Nothing due today. You're caught up.</p>;
  tasks.sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
  return (
    <ul className="flex flex-col gap-1">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-center gap-2 text-sm">
          <span className={`text-[10px] font-semibold px-1.5 py-px rounded ${t.dueDate! < today ? 'bg-red-50 text-red-500 dark:bg-red-950/40' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'}`}>
            {t.dueDate! < today ? 'Overdue' : 'Today'}
          </span>
          <span className="text-zinc-800 dark:text-zinc-100 truncate">{t.text}</span>
          <span className="text-xs text-zinc-400 truncate">· {t.noteTitle}</span>
        </li>
      ))}
    </ul>
  );
}

interface GameLine { key: string; emoji: string; name: string; text: string; live: boolean }

function GamesToday() {
  const [lines, setLines] = useState<GameLine[] | null>(null);
  useEffect(() => {
    const teams: any[] = getWidgetConfig('sports').teams || DEFAULT_TEAMS;
    const today = todayKey();
    let cancelled = false;
    Promise.all(teams.map(async (t): Promise<GameLine | null> => {
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${t.sport}/${t.league}/teams/${t.team}`);
        if (!res.ok) return null;
        const ev = (await res.json())?.team?.nextEvent?.[0];
        if (!ev?.date || todayKey(new Date(ev.date)) !== today) return null;
        const status = ev.competitions?.[0]?.status?.type;
        const when = status?.state === 'pre'
          ? new Date(ev.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          : status?.shortDetail || status?.description || '';
        return { key: t.key, emoji: t.emoji, name: t.name, text: `${ev.shortName} · ${when}`, live: status?.state === 'in' };
      } catch {
        return null;
      }
    })).then((r) => { if (!cancelled) setLines(r.filter((x): x is GameLine => x !== null)); });
    return () => { cancelled = true; };
  }, []);

  if (!lines) return <Loader2 size={14} className="animate-spin text-zinc-400" />;
  if (lines.length === 0) return <p className="text-xs text-zinc-400 dark:text-zinc-500">None of your teams play today.</p>;
  return (
    <ul className="flex flex-col gap-1">
      {lines.map((l) => (
        <li key={l.key} className="flex items-center gap-2 text-sm">
          <span aria-hidden="true">{l.emoji}</span>
          <span className="font-medium text-zinc-800 dark:text-zinc-100">{l.name}</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{l.text}</span>
          {l.live && <span className="px-1.5 py-px rounded-full bg-red-500 text-white text-[10px] font-bold">LIVE</span>}
        </li>
      ))}
    </ul>
  );
}

const INDICES = [
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^DJI', label: 'Dow' },
  { symbol: '^IXIC', label: 'Nasdaq' },
];

function Markets() {
  const [quotes, setQuotes] = useState<Array<{ label: string; pct: number | null; price: number | null }> | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all(INDICES.map(async (i) => {
      try {
        const res = await fetch(`/api/stock-chart?symbol=${encodeURIComponent(i.symbol)}&range=1M`);
        const d = res.ok ? await res.json() : {};
        return { label: i.label, pct: typeof d.percentChange === 'number' ? d.percentChange : null, price: typeof d.price === 'number' ? d.price : null };
      } catch {
        return { label: i.label, pct: null, price: null };
      }
    })).then((q) => { if (!cancelled) setQuotes(q); });
    return () => { cancelled = true; };
  }, []);

  if (!quotes) return <Loader2 size={14} className="animate-spin text-zinc-400" />;
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {quotes.map((q) => {
        const up = (q.pct ?? 0) >= 0;
        return (
          <div key={q.label} className="px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{q.label}</div>
            {q.pct === null ? (
              <div className="text-xs text-zinc-400">—</div>
            ) : (
              <div className={`flex items-center gap-1 text-xs font-semibold tabular-nums ${up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {up ? '+' : ''}{q.pct.toFixed(2)}%
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DailyBrief({ config }: BriefProps) {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 px-1">
        <Sunrise size={18} className="text-amber-500" />
        <div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-white">{greeting}, Doug</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} — here's your day
          </div>
        </div>
      </div>
      <Section icon={Newspaper} title="Top stories"><TopStories nonce={config.refreshNonce} /></Section>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <Section icon={Sun} title="Weather"><CompactWeather /></Section>
        <Section icon={TrendingUp} title="Markets"><Markets /></Section>
      </div>
      <Section icon={CalendarDays} title="Today's calendar"><TodayAgenda /></Section>
      <Section icon={ListChecks} title="Tasks due"><TasksToday /></Section>
      <Section icon={Trophy} title="Your teams today"><GamesToday /></Section>
    </div>
  );
}
