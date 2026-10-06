import React, { useState, useEffect, useMemo } from 'react';
import {
  Sun, CalendarClock, Star, Clock, StickyNote, Calendar as CalendarIcon,
  Newspaper, Trophy, TrendingUp, Settings2, GripVertical, Eye, EyeOff, Plus, Trash2, Clock3, Plane,
} from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { HomeLayout, LayoutsState, ActiveChoice, MAX_LAYOUTS, initialLayouts, resolveActive, localDay } from '../lib/homeLayouts';
import { getWidgetConfig } from '../lib/portalStorage';
import { getFavoriteLinks } from './widgets/QuickLinks';
import { getRecentLinks, RecentLink } from '../lib/recentLinks';
import { getAttentionSummary } from '../lib/attention';
import AttentionSummary from './home/AttentionSummary';
import CompactWeather from './home/CompactWeather';
import TodayAgenda, { CalendarEvent } from './home/TodayAgenda';
import FavoritesList from './home/FavoritesList';
import RecentList from './home/RecentList';
import Scratchpad from './widgets/Scratchpad';
import OnThisDayHighlight from './home/OnThisDayHighlight';
import NewsHighlight from './home/NewsHighlight';
import SportsHighlight from './home/SportsHighlight';
import StocksHighlight from './home/StocksHighlight';
import FlightsHighlight from './home/FlightsHighlight';

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
  flights: { id: 'flights', label: 'Flights Overhead', icon: Plane, span: 'half' },
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
  flights: 'flights',
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
      className={`glass-card rounded-2xl p-4 flex flex-col gap-2.5 ${
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
  // Layouts replace the single pw6-home-enabled / pw6-home-order pair; the
  // first run copies that pair into the "Home" layout.
  const [layoutsState, setLayoutsState] = useLocalStorage<LayoutsState>('pw6-home-layouts', initialLayouts(DEFAULT_MODULE_ORDER));
  const [choice, setChoice] = useLocalStorage<ActiveChoice | null>('pw6-home-active', null);
  // Re-check the auto schedule every minute so it flips at 8 AM / 5 PM.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);
  const layouts = layoutsState.layouts?.length ? layoutsState.layouts : initialLayouts(DEFAULT_MODULE_ORDER).layouts;
  const activeId = resolveActive({ ...layoutsState, layouts }, choice);
  const active = layouts.find((l) => l.id === activeId) || layouts[0];
  const enabledModules = active.enabled;
  const moduleOrder = active.order;

  const updateActive = (patch: Partial<HomeLayout>) =>
    setLayoutsState((prev) => ({
      ...prev,
      layouts: (prev.layouts?.length ? prev.layouts : layouts).map((l) => (l.id === active.id ? { ...l, ...patch } : l)),
    }));
  const setEnabledModules = (enabled: string[]) => updateActive({ enabled });
  const setModuleOrder = (order: string[]) => updateActive({ order });
  const pickLayout = (id: string) => setChoice({ id, date: localDay() });

  const addLayout = () => {
    if (layouts.length >= MAX_LAYOUTS) return;
    const id = `layout-${Date.now()}`;
    setLayoutsState((prev) => ({ ...prev, layouts: [...layouts, { id, name: `Layout ${layouts.length + 1}`, enabled: [...active.enabled], order: [...active.order] }] }));
    pickLayout(id);
  };
  const deleteActiveLayout = () => {
    if (layouts.length <= 1) return;
    setLayoutsState((prev) => ({ ...prev, layouts: layouts.filter((l) => l.id !== active.id) }));
    setChoice(null);
  };
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const [favoriteLinks, setFavoriteLinks] = useState<ReturnType<typeof getFavoriteLinks>>([]);
  const [recentLinks, setRecentLinks] = useState<RecentLink[]>([]);
  const [attentionCounts, setAttentionCounts] = useState(() => ({ ...getAttentionSummary(), eventsToday: 0 }));
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);

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
        return <AttentionSummary counts={attentionCounts} events={todayEvents} />;
      case 'weather':
        return <CompactWeather />;
      case 'agenda':
        return <TodayAgenda onEvents={(evs) => { setTodayEvents(evs); setAttentionCounts((prev) => ({ ...prev, eventsToday: evs.length })); }} />;
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
      case 'flights':
        return <FlightsHighlight />;
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 overflow-x-auto no-scrollbar" role="tablist" aria-label="Home layouts">
          {layouts.map((l) => {
            const isActive = l.id === active.id;
            return (
              <button
                key={l.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => pickLayout(l.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'bg-white dark:bg-zinc-950 shadow-sm text-zinc-900 dark:text-white'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                {l.name}
              </button>
            );
          })}
          {layoutsState.auto && (
            <span className="px-1.5 text-zinc-400 dark:text-zinc-500" title="Switches automatically: Work on weekdays 8 AM–5 PM, Weekend on Sat/Sun, Home otherwise. Picking one holds it for the rest of today.">
              <Clock3 size={12} />
            </span>
          )}
        </div>
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
        <div className="glass-card rounded-2xl p-3 mb-4">
          <div className="flex flex-wrap items-center gap-2 mb-3 px-1 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <label className="text-xs text-zinc-500 dark:text-zinc-400">Layout name</label>
            <input
              value={active.name}
              onChange={(e) => updateActive({ name: e.target.value.slice(0, 24) })}
              onBlur={(e) => { if (!e.target.value.trim()) updateActive({ name: 'Untitled' }); }}
              className="px-2 py-1 text-sm rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-36"
            />
            <button
              onClick={addLayout}
              disabled={layouts.length >= MAX_LAYOUTS}
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors duration-150"
              title={layouts.length >= MAX_LAYOUTS ? `Up to ${MAX_LAYOUTS} layouts` : 'Add a layout (starts as a copy of this one)'}
            >
              <Plus size={12} /> Add layout
            </button>
            {layouts.length > 1 && (confirmDelete ? (
              <span className="flex items-center gap-1 text-xs">
                Delete "{active.name}"?
                <button onClick={() => { deleteActiveLayout(); setConfirmDelete(false); }} className="px-2 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium">Delete</button>
                <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800">Cancel</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg text-zinc-500 hover:text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150">
                <Trash2 size={12} /> Delete layout
              </button>
            ))}
            <label className="ml-auto flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer" title="Work on weekdays 8 AM–5 PM, Weekend on Saturday and Sunday, Home otherwise. Picking a layout yourself holds it for the rest of the day.">
              <input
                type="checkbox"
                checked={!!layoutsState.auto}
                onChange={(e) => setLayoutsState((prev) => ({ ...prev, layouts, auto: e.target.checked }))}
                className="accent-indigo-600"
              />
              Switch automatically
            </label>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2 px-1">
            Drag to reorder, or toggle a card off to hide it from the "{active.name}" layout.
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
                    title={isOn ? `Hide from ${active.name}` : `Show on ${active.name}`}
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
        <div className="glass-card rounded-2xl p-8 text-center">
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
