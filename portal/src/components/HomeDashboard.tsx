import React, { useState, useEffect, useMemo } from 'react';
import {
  Sun, CalendarClock, Star, Clock, StickyNote, Calendar as CalendarIcon,
  Newspaper, Trophy, TrendingUp, Settings2, GripVertical, Eye, EyeOff,
} from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { getWidgetConfig } from '../lib/portalStorage';
import { getFavoriteLinks } from './widgets/QuickLinks';
import { getRecentLinks, RecentLink } from '../lib/recentLinks';
import { getAttentionSummary } from '../lib/attention';
import AttentionSummary from './home/AttentionSummary';
import CompactWeather from './home/CompactWeather';
import TodayAgenda from './home/TodayAgenda';
import FavoritesList from './home/FavoritesList';
import RecentList from './home/RecentList';
import Scratchpad from './widgets/Scratchpad';
import OnThisDayHighlight from './home/OnThisDayHighlight';
import NewsHighlight from './home/NewsHighlight';
import SportsHighlight from './home/SportsHighlight';
import StocksHighlight from './home/StocksHighlight';

// Home is a fixed set of small, restrained modules — NOT a general widget
// grid. Doug's spec explicitly asked for a small curated set (weather,
// calendar, tasks, favorites, recent, news/sports/stocks highlights, On This
// Day, scratchpad) rather than "every widget available." Customization is
// deliberately limited to show/hide + reorder, matching the simple approach
// Doug picked over a full drag-grid library.

interface ModuleDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  span: 'half' | 'full'; // 'half' = sits two-up on wide screens, 'full' = own row
}

const MODULE_DEFS: Record<string, ModuleDef> = {
  attention: { id: 'attention', label: 'Today', icon: CalendarClock, span: 'full' },
  weather: { id: 'weather', label: 'Weather', icon: Sun, span: 'half' },
  agenda: { id: 'agenda', label: "Today's Calendar", icon: CalendarIcon, span: 'half' },
  favorites: { id: 'favorites', label: 'Favorites', icon: Star, span: 'half' },
  recent: { id: 'recent', label: 'Recently Used', icon: Clock, span: 'half' },
  scratchpad: { id: 'scratchpad', label: 'Scratchpad', icon: StickyNote, span: 'half' },
  onthisday: { id: 'onthisday', label: 'On This Day', icon: CalendarClock, span: 'half' },
  news: { id: 'news', label: 'Top Stories', icon: Newspaper, span: 'half' },
  sports: { id: 'sports', label: 'Sports', icon: Trophy, span: 'half' },
  stocks: { id: 'stocks', label: 'Markets', icon: TrendingUp, span: 'half' },
};

const DEFAULT_MODULE_ORDER = [
  'attention', 'weather', 'agenda', 'favorites', 'recent', 'scratchpad', 'onthisday', 'news', 'sports', 'stocks',
];

// Modules that correspond to a real section elsewhere in the app get a
// clickable header that jumps there — e.g. clicking "Top Stories" opens the
// full News tab. Modules with no single-section home (Favorites, Recent,
// Scratchpad, On This Day) just get a plain, non-interactive header.
const MODULE_TARGET_SECTION: Record<string, string> = {
  agenda: 'tools',
  news: 'news',
  sports: 'sports',
  stocks: 'stocks',
};

function ModuleCard({
  def,
  onNavigate,
  children,
}: {
  def: ModuleDef;
  onNavigate?: () => void;
  children: React.ReactNode;
}) {
  const Icon = def.icon;
  const Header = onNavigate ? 'button' : 'div';
  return (
    <div
      className={`surface-card bg-white dark:bg-zinc-900 rounded-2xl p-4 flex flex-col gap-2.5 ${
        def.span === 'full' ? 'col-span-full' : ''
      }`}
    >
      <Header
        onClick={onNavigate}
        className={`flex items-center gap-2 ${onNavigate ? 'text-left hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors duration-150 group' : ''}`}
      >
        <Icon size={14} className="text-zinc-400 dark:text-zinc-500 group-hover:text-indigo-400" />
        <h3 className="text-[13px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide group-hover:text-indigo-500 dark:group-hover:text-indigo-400">{def.label}</h3>
      </Header>
      <div>{children}</div>
    </div>
  );
}

export default function HomeDashboard({ onNavigate }: { onNavigate: (section: string) => void }) {
  const [enabledModules, setEnabledModules] = useLocalStorage<string[]>('pw6-home-enabled', DEFAULT_MODULE_ORDER);
  const [moduleOrder, setModuleOrder] = useLocalStorage<string[]>('pw6-home-order', DEFAULT_MODULE_ORDER);
  const [customizing, setCustomizing] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const [favoriteLinks, setFavoriteLinks] = useState<ReturnType<typeof getFavoriteLinks>>([]);
  const [recentLinks, setRecentLinks] = useState<RecentLink[]>([]);
  const [attentionCounts, setAttentionCounts] = useState(() => ({ ...getAttentionSummary(), eventsToday: 0 }));

  // Home is read-heavy against localStorage state owned by other tabs
  // (Quick Links' favorites, Tasks' due dates, recent-link log). Since those
  // are only ever written while THEIR tab is active — never simultaneously
  // with Home — a fresh read on mount/focus is all that's needed; no
  // subscription machinery required.
  useEffect(() => {
    const refresh = () => {
      setFavoriteLinks(getFavoriteLinks(getWidgetConfig('links')));
      setRecentLinks(getRecentLinks(6));
      setAttentionCounts((prev) => ({ ...getAttentionSummary(), eventsToday: prev.eventsToday }));
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  // Backfill guard for module lists saved before a module existed — same
  // defensive pattern App.tsx already uses for tab order.
  const resolvedOrder = useMemo(
    () => moduleOrder.filter((id) => id in MODULE_DEFS).concat(Object.keys(MODULE_DEFS).filter((id) => !moduleOrder.includes(id))),
    [moduleOrder]
  );
  const visibleOrder = resolvedOrder.filter((id) => enabledModules.includes(id));

  const toggleModule = (id: string) => {
    setEnabledModules(
      enabledModules.includes(id) ? enabledModules.filter((m) => m !== id) : [...enabledModules, id]
    );
  };

  const commitReorder = (from: number, to: number) => {
    if (from === to) return;
    const order = [...resolvedOrder];
    const [moved] = order.splice(from, 1);
    const insertAt = from < to ? to - 1 : to;
    order.splice(insertAt, 0, moved);
    setModuleOrder(order);
  };

  const renderModule = (id: string) => {
    switch (id) {
      case 'attention':
        return <AttentionSummary counts={attentionCounts} />;
      case 'weather':
        return <CompactWeather />;
      case 'agenda':
        return <TodayAgenda onCount={(n) => setAttentionCounts((prev) => ({ ...prev, eventsToday: n }))} />;
      case 'favorites':
        return <FavoritesList links={favoriteLinks} />;
      case 'recent':
        return <RecentList links={recentLinks} />;
      case 'scratchpad':
        return <Scratchpad />;
      case 'onthisday':
        return <OnThisDayHighlight />;
      case 'news':
        return <NewsHighlight />;
      case 'sports':
        return <SportsHighlight />;
      case 'stocks':
        return <StocksHighlight />;
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setCustomizing((c) => !c)}
          aria-pressed={customizing}
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors duration-150 ${
            customizing
              ? 'bg-indigo-600 text-white'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }`}
        >
          <Settings2 size={13} />
          {customizing ? 'Done' : 'Customize'}
        </button>
      </div>

      {customizing && (
        <div className="surface-card bg-white dark:bg-zinc-900 rounded-2xl p-3 mb-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2 px-1">
            Drag to reorder, or toggle a module off to hide it from Home.
          </p>
          <div className="flex flex-col gap-1">
            {resolvedOrder.map((id, index) => {
              const def = MODULE_DEFS[id];
              const Icon = def.icon;
              const isOn = enabledModules.includes(id);
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null) commitReorder(dragIndex, index);
                    setDragIndex(null);
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${dragIndex === index ? 'opacity-40' : ''} ${isOn ? '' : 'opacity-50'}`}
                >
                  <GripVertical size={14} className="text-zinc-300 dark:text-zinc-700 cursor-grab flex-shrink-0" />
                  <Icon size={14} className="text-zinc-400 flex-shrink-0" />
                  <span className="text-sm text-zinc-700 dark:text-zinc-200 flex-1">{def.label}</span>
                  <button
                    onClick={() => toggleModule(id)}
                    className="p-1 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors duration-150"
                    title={isOn ? 'Hide from Home' : 'Show on Home'}
                  >
                    {isOn ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {visibleOrder.length === 0 ? (
        <div className="surface-card bg-white dark:bg-zinc-900 rounded-2xl p-8 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            All modules are hidden. Click Customize to bring some back.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleOrder.map((id) => (
            <ModuleCard
              key={id}
              def={MODULE_DEFS[id]}
              onNavigate={MODULE_TARGET_SECTION[id] ? () => onNavigate(MODULE_TARGET_SECTION[id]) : undefined}
            >
              {renderModule(id)}
            </ModuleCard>
          ))}
        </div>
      )}
    </div>
  );
}
