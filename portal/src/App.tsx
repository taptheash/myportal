import React, { useState, useEffect } from 'react';
import {
  Sun, Moon, Monitor, Plus, Minus, Crosshair, Rss, Wrench, Newspaper, TrendingUp, BarChart3, Flame,
  StickyNote, ListChecks, Link2, Trophy, Megaphone, Globe, Laptop, MapPin, Sparkles, Home as HomeIcon,
  Calendar as CalendarIcon, Search as SearchIcon,
} from 'lucide-react';
import { useTheme, ThemeMode } from './hooks/useTheme';
import { useLocalStorage } from './hooks/useLocalStorage';

import TabContainer, { TabDef } from './components/TabContainer';
import { OnThisDayPill, NationalDayPill } from './components/TodayFacts';
import HomeDashboard from './components/HomeDashboard';
import CommandPalette from './components/CommandPalette';
import Weather from './components/widgets/Weather';
import Calendar from './components/widgets/Calendar';
import Headlines from './components/widgets/Headlines';
import TechNews from './components/widgets/TechNews';
import LocalNews from './components/widgets/LocalNews';
import WeirdNews from './components/widgets/WeirdNews';
import BusinessNews from './components/widgets/BusinessNews';
import Notes from './components/widgets/Notes';
import FreeformNotes from './components/widgets/FreeformNotes';
import QuickLinks from './components/widgets/QuickLinks';
import Sports from './components/widgets/Sports';
import SportsNews from './components/widgets/SportsNews';
import CustomFeeds from './components/widgets/CustomFeeds';
import RedditPopular from './components/widgets/RedditPopular';
import { makeTeamSchedule } from './components/widgets/TeamSchedule';
import NflSchedule from './components/widgets/NflSchedule';
import Watchlist from './components/widgets/Watchlist';
import MarketOverview from './components/widgets/MarketOverview';

const PatsSchedule = makeTeamSchedule('football', 'nfl', 'ne', 'Pats', '#0072B2');
const SoxSchedule = makeTeamSchedule('baseball', 'mlb', 'bos', 'Sox', '#D55E00');
const CelticsSchedule = makeTeamSchedule('basketball', 'nba', 'bos', 'Celtics', '#009E73');
const BruinsSchedule = makeTeamSchedule('hockey', 'nhl', 'bos', 'Bruins', '#E69F00');

interface WidgetInstance {
  id: string;
  type: string;
  title: string;
  config: Record<string, any>;
}

interface WidgetDef {
  type: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  component: React.ComponentType<any>;
  color: string;       // hex from the Okabe-Ito colorblind-safe palette (verified distinguishable under protanopia/deuteranopia/tritanopia)
  activeText: 'black' | 'white'; // pre-verified WCAG AA (>=4.5:1) text color for `color`
}

// Okabe-Ito colorblind-safe palette. Reused across the two containers since only
// same-container tabs need to be mutually distinguishable from each other.
const WIDGET_DEFINITIONS: Record<string, WidgetDef> = {
  weather:    { type: 'weather',    label: 'Weather',     icon: Sun,          component: Weather,      color: '#E69F00', activeText: 'black' },
  notes:      { type: 'notes',      label: 'Notes',       icon: StickyNote,   component: FreeformNotes, color: '#F0E442', activeText: 'black' },
  tasks:      { type: 'tasks',      label: 'Tasks',       icon: ListChecks,   component: Notes,        color: '#009E73', activeText: 'black' },
  calendar:   { type: 'calendar',   label: 'Calendar',    icon: CalendarIcon, component: Calendar,     color: '#CC79A7', activeText: 'black' },
  links:      { type: 'links',      label: 'Quick Links', icon: Link2,        component: QuickLinks,   color: '#56B4E9', activeText: 'black' },
  sports:     { type: 'sports',     label: 'Sports',      icon: Trophy,       component: Sports,       color: '#F0E442', activeText: 'black' },
  sportsnews: { type: 'sportsnews', label: 'NE Sports',   icon: Megaphone,    component: SportsNews,   color: '#56B4E9', activeText: 'black' },
  headlines:  { type: 'headlines',  label: 'Headlines',   icon: Globe,        component: Headlines,    color: '#D55E00', activeText: 'black' },
  tech:       { type: 'tech',       label: 'Tech & AI',   icon: Laptop,       component: TechNews,     color: '#0072B2', activeText: 'white' },
  local:      { type: 'local',      label: 'NH Local',    icon: MapPin,       component: LocalNews,    color: '#009E73', activeText: 'black' },
  feeds:      { type: 'feeds',      label: 'Feeds',       icon: Rss,          component: CustomFeeds,  color: '#56B4E9', activeText: 'black' },
  reddit:     { type: 'reddit',     label: 'Reddit Popular', icon: Flame,     component: RedditPopular, color: '#F0E442', activeText: 'black' },
  business:   { type: 'business',   label: 'Business',    icon: Globe,        component: BusinessNews, color: '#E69F00', activeText: 'black' },
  weird:      { type: 'weird',      label: 'Other',       icon: Sparkles,     component: WeirdNews,    color: '#CC79A7', activeText: 'black' },
  nflSchedule: { type: 'nflSchedule', label: 'NFL Schedule', icon: CalendarIcon, component: NflSchedule, color: '#CC79A7', activeText: 'black' },
  patsSchedule: { type: 'patsSchedule', label: 'Patriots Schedule', icon: CalendarIcon, component: PatsSchedule, color: '#0072B2', activeText: 'white' },
  soxSchedule: { type: 'soxSchedule', label: 'Red Sox Schedule', icon: CalendarIcon, component: SoxSchedule, color: '#D55E00', activeText: 'black' },
  celticsSchedule: { type: 'celticsSchedule', label: 'Celtics Schedule', icon: CalendarIcon, component: CelticsSchedule, color: '#009E73', activeText: 'black' },
  bruinsSchedule: { type: 'bruinsSchedule', label: 'Bruins Schedule', icon: CalendarIcon, component: BruinsSchedule, color: '#E69F00', activeText: 'black' },
  watchlist: { type: 'watchlist', label: 'Watchlist', icon: TrendingUp, component: Watchlist, color: '#0072B2', activeText: 'white' },
  marketOverview: { type: 'marketOverview', label: 'Market Overview', icon: BarChart3, component: MarketOverview, color: '#009E73', activeText: 'black' },
};

const TOOL_TYPES = ['weather', 'notes', 'tasks', 'calendar', 'links'];
const NEWS_TYPES = ['sportsnews', 'headlines', 'tech', 'local', 'business', 'weird', 'feeds', 'reddit'];
const SPORTS_TYPES = ['sports', 'nflSchedule', 'patsSchedule', 'soxSchedule', 'celticsSchedule', 'bruinsSchedule'];
const STOCK_TYPES = ['watchlist', 'marketOverview'];
const ALL_TYPES = [...TOOL_TYPES, ...NEWS_TYPES, ...SPORTS_TYPES, ...STOCK_TYPES];

function makeDefaultWidgets(): WidgetInstance[] {
  return ALL_TYPES.map((type) => ({
    id: type,
    type,
    title: WIDGET_DEFINITIONS[type].label,
    config: {},
  }));
}

const NEWS_ARTICLE_TYPES = new Set(['sportsnews', 'headlines', 'tech', 'local', 'business', 'weird']);

// Top-level section nav — adding a future section is one entry here, plus
// one more conditional render branch below. No layout-width juggling needed
// the way the old side-by-side/stacked columns required every time a
// section was added.
const SECTIONS = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'sports', label: 'Sports', icon: Trophy },
  { id: 'stocks', label: 'Stocks', icon: TrendingUp },
];

export default function App() {
  const { mode, resolvedTheme, setMode } = useTheme();
  const [storedWidgets, setWidgets] = useLocalStorage<WidgetInstance[]>('pw6', makeDefaultWidgets());
  const [activeTool, setActiveTool] = useLocalStorage<string>('pw6-active-tool', 'weather');
  const [activeNews, setActiveNews] = useLocalStorage<string>('pw6-active-news', 'headlines');
  const [activeSports, setActiveSports] = useLocalStorage<string>('pw6-active-sports', 'sports');
  const [activeStocks, setActiveStocks] = useLocalStorage<string>('pw6-active-stocks', 'watchlist');
  const [activeSection, setActiveSection] = useLocalStorage<string>('pw6-active-section', 'home');
  const [toolOrder, setToolOrder] = useLocalStorage<string[]>('pw6-tool-order', TOOL_TYPES);
  const [newsOrder, setNewsOrder] = useLocalStorage<string[]>('pw6-news-order', NEWS_TYPES);
  const [sportsOrder, setSportsOrder] = useLocalStorage<string[]>('pw6-sports-order', SPORTS_TYPES);
  const [stocksOrder, setStocksOrder] = useLocalStorage<string[]>('pw6-stocks-order', STOCK_TYPES);
  const [weatherEditing, setWeatherEditing] = useState(false);
  const [weatherInput, setWeatherInput] = useState('');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Ctrl+K (or Cmd+K on Mac) opens the command palette from anywhere in the
  // app. Prevented from also typing "k" into whatever's focused.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // Live clock: Weekday, Full Month, Day Year HH:MM:SS
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const dayOfWeek = now.toLocaleString('en-US', { weekday: 'long' });
      const month = now.toLocaleString('en-US', { month: 'long' });
      const day = now.getDate();
      const year = now.getFullYear();
      const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      setCurrentTime(`${dayOfWeek} ${month} ${day} ${year} ${time}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Bing wallpaper of the day. Fetched via our own /api route, not bing.com
  // directly — Bing's image endpoint doesn't send CORS headers, so a direct
  // browser fetch from this origin gets silently blocked.
  useEffect(() => {
    const fetchBingWallpaper = async () => {
      try {
        const response = await fetch('/api/bing-wallpaper');
        if (!response.ok) throw new Error('Failed to fetch wallpaper');
        const data = await response.json();
        if (data.imageUrl) {
          document.body.style.backgroundImage = `url('${data.imageUrl}')`;
          document.body.style.backgroundAttachment = 'fixed';
          document.body.style.backgroundPosition = 'center';
          document.body.style.backgroundRepeat = 'no-repeat';
          document.body.style.backgroundSize = 'cover';
        }
      } catch (err) {
        console.error('Failed to fetch Bing wallpaper:', err);
      }
    };
    fetchBingWallpaper();
  }, []);

  const byType = new Map(storedWidgets.map((w) => [w.type, w]));
  const widgets: WidgetInstance[] = ALL_TYPES.map(
    (type) => byType.get(type) ?? { id: type, type, title: WIDGET_DEFINITIONS[type].label, config: {} }
  );

  const updateWidgetConfig = (type: string, config: Record<string, any>) => {
    setWidgets(widgets.map((w) => (w.type === type ? { ...w, config } : w)));
  };

  const toTabDef = (type: string): TabDef => {
    const def = WIDGET_DEFINITIONS[type];
    return { type: def.type, label: def.label, icon: def.icon, color: def.color, activeText: def.activeText };
  };

  // Backfill guards against a stored order predating a widget type that was
  // added later (e.g. Tasks, or Sports moving into News) — same defensive
  // pattern as `widgets` above.
  const resolveOrder = (stored: string[], known: string[]) =>
    stored.filter((t) => known.includes(t)).concat(known.filter((t) => !stored.includes(t)));

  const toolTabs = resolveOrder(toolOrder, TOOL_TYPES).map(toTabDef);
  const newsTabs = resolveOrder(newsOrder, NEWS_TYPES).map(toTabDef);
  const sportsTabs = resolveOrder(sportsOrder, SPORTS_TYPES).map(toTabDef);
  const stocksTabs = resolveOrder(stocksOrder, STOCK_TYPES).map(toTabDef);

  // Guards against activeNews still pointing at 'sports' from a browser
  // that had it selected before Sports moved out of the News section —
  // falls back to a tab that's actually still in News.
  const safeActiveNews = NEWS_TYPES.includes(activeNews) ? activeNews : NEWS_TYPES[0];

  const activeToolWidget = widgets.find((w) => w.type === activeTool)!;
  const activeNewsWidget = widgets.find((w) => w.type === safeActiveNews)!;
  const activeSportsWidget = widgets.find((w) => w.type === activeSports)!;
  const activeStocksWidget = widgets.find((w) => w.type === activeStocks)!;

  const renderToolControls = () => {
    if (activeTool === 'weather') {
      const displayLocation = activeToolWidget.config.location || activeToolWidget.config.resolvedLocationName || 'Detecting…';
      return weatherEditing ? (
        <input
          type="text"
          value={weatherInput}
          onChange={(e) => setWeatherInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && weatherInput.trim()) {
              updateWidgetConfig('weather', { ...activeToolWidget.config, location: weatherInput.trim() });
              setWeatherEditing(false);
            }
            if (e.key === 'Escape') setWeatherEditing(false);
          }}
          onBlur={() => setWeatherEditing(false)}
          placeholder="ZIP or city"
          className="px-2 py-1 text-xs rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          autoFocus
        />
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              // Clearing location drops hasManualLocation back to false in
              // Weather.tsx, which re-runs the same geolocation path it
              // already uses when nothing's been manually set — no new
              // fetch logic needed, just handing back control to it.
              const { location, ...rest } = activeToolWidget.config;
              updateWidgetConfig('weather', rest);
            }}
            title="Use current location"
            className="flex items-center justify-center p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors duration-150"
          >
            <Crosshair size={14} />
          </button>
          <button
            onClick={() => {
              setWeatherEditing(true);
              setWeatherInput(displayLocation);
            }}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors duration-150"
          >
            <MapPin size={12} /> {displayLocation}
          </button>
        </div>
      );
    }

    if (activeTool === 'links') {
      return (
        <button
          onClick={() => updateWidgetConfig('links', { ...activeToolWidget.config, showAdd: true })}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors duration-150"
        >
          <Plus size={13} /> Add link
        </button>
      );
    }

    if (activeTool === 'calendar') {
      const eventCount = activeToolWidget.config.eventCount || 5;
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 mr-1">Events</span>
          <button
            onClick={() => updateWidgetConfig('calendar', { ...activeToolWidget.config, eventCount: Math.max(1, eventCount - 1) })}
            className="w-6 h-6 flex items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors duration-150"
          >
            <Minus size={13} />
          </button>
          <span className="text-xs font-semibold w-5 text-center text-zinc-700 dark:text-zinc-200">{eventCount}</span>
          <button
            onClick={() => updateWidgetConfig('calendar', { ...activeToolWidget.config, eventCount: Math.min(20, eventCount + 1) })}
            className="w-6 h-6 flex items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors duration-150"
          >
            <Plus size={13} />
          </button>
        </div>
      );
    }

    return null;
  };

  const renderNewsControls = () => {
    if (!NEWS_ARTICLE_TYPES.has(safeActiveNews)) return null;
    const count = activeNewsWidget.config.articleCount || 10;
    // Show what's actually on screen, not just the requested target — the
    // source feed doesn't always have as many items as asked for.
    const displayCount = activeNewsWidget.config.lastFetchedCount ?? count;
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-zinc-500 dark:text-zinc-400 mr-1">Articles</span>
        <button
          onClick={() => updateWidgetConfig(safeActiveNews, { ...activeNewsWidget.config, articleCount: Math.max(1, count - 1) })}
          className="w-6 h-6 flex items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors duration-150"
        >
          <Minus size={13} />
        </button>
        <span className="text-xs font-semibold w-5 text-center text-zinc-700 dark:text-zinc-200">{displayCount}</span>
        <button
          onClick={() => updateWidgetConfig(safeActiveNews, { ...activeNewsWidget.config, articleCount: Math.min(100, count + 1) })}
          className="w-6 h-6 flex items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors duration-150"
        >
          <Plus size={13} />
        </button>
      </div>
    );
  };

  const renderSportsControls = () => {
    if (activeSports === 'sports') {
      return (
        <button
          onClick={() => updateWidgetConfig('sports', { ...activeSportsWidget.config, showAdd: true })}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors duration-150"
        >
          <Plus size={13} /> Add team
        </button>
      );
    }
    return null;
  };

  const renderStocksControls = () => {
    if (activeStocks === 'watchlist') {
      return (
        <button
          onClick={() => updateWidgetConfig('watchlist', { ...activeStocksWidget.config, showAdd: true })}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors duration-150"
        >
          <Plus size={13} /> Add ticker
        </button>
      );
    }
    return null;
  };

  const ToolComponent = WIDGET_DEFINITIONS[activeTool].component;
  const NewsComponent = WIDGET_DEFINITIONS[safeActiveNews].component;
  const SportsComponent = WIDGET_DEFINITIONS[activeSports].component;
  const StocksComponent = WIDGET_DEFINITIONS[activeStocks].component;

  const activeSectionMeta = SECTIONS.find((s) => s.id === activeSection)!;
  const sectionSubtitle: Record<string, string> = {
    home: 'Everything that matters today, at a glance',
    tools: 'Your shortcuts, utilities and frequently used services',
    news: 'Headlines and feeds, curated to what you actually read',
    sports: 'Live scores and schedules for the teams you follow',
    stocks: 'Watchlist and market snapshot at a glance',
  };
  const linksEntries = activeTool === 'links' ? (activeToolWidget.config?.links as any[] | undefined) : undefined;
  const toolsMeta = (() => {
    if (activeSection !== 'tools' || !linksEntries) return null;
    let linkTotal = 0;
    let folderTotal = 0;
    for (const entry of linksEntries) {
      if (entry?.type === 'folder') {
        folderTotal += 1;
        linkTotal += (entry.links || []).length;
      } else {
        linkTotal += 1;
      }
    }
    return `${linkTotal} link${linkTotal === 1 ? '' : 's'}${folderTotal ? ` · ${folderTotal} folder${folderTotal === 1 ? '' : 's'}` : ''}`;
  })();

  return (
    <div className={resolvedTheme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-200/80 dark:border-zinc-800/80">
          <div className="px-6 py-3.5 flex justify-between items-center gap-4">
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-indigo-500" aria-hidden="true" />
              <h1 className="text-[15px] font-semibold text-zinc-500 dark:text-zinc-400 tabular-nums tracking-tight">
                {currentTime || 'Loading…'}
              </h1>
            </div>

            <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
              <OnThisDayPill />
              <NationalDayPill />
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setPaletteOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                title="Search everything (Ctrl+K)"
              >
                <SearchIcon size={14} />
                <span className="hidden lg:inline">Search…</span>
                <kbd className="hidden lg:inline text-[10px] font-medium bg-white dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">Ctrl K</kbd>
              </button>

              <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 gap-0.5">
                {(['light', 'system', 'dark'] as ThemeMode[]).map((m) => {
                  const Icon = m === 'light' ? Sun : m === 'dark' ? Moon : Monitor;
                  const isActive = mode === m;
                  return (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      title={m.charAt(0).toUpperCase() + m.slice(1)}
                      aria-pressed={isActive}
                      className={`p-1.5 rounded-md transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                        isActive
                          ? 'bg-white dark:bg-zinc-950 shadow-sm text-indigo-600 dark:text-indigo-400'
                          : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                      }`}
                    >
                      <Icon size={15} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </header>

        <main className="px-6 py-6 max-w-[1440px] mx-auto">
          <div className="flex flex-row gap-6 items-start w-full">
            <nav className="w-44 flex-shrink-0 flex flex-col gap-0.5">
              {SECTIONS.map((section) => {
                const isActive = activeSection === section.id;
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    aria-current={isActive}
                    className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                      isActive
                        ? 'font-medium bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200/80 dark:ring-zinc-800'
                        : 'font-medium text-zinc-500 dark:text-zinc-500 hover:bg-zinc-100/80 dark:hover:bg-zinc-900/60 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    <Icon
                      size={15}
                      className={`flex-shrink-0 transition-colors ${
                        isActive ? 'text-indigo-500' : 'text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-500'
                      }`}
                    />
                    {section.label}
                  </button>
                );
              })}
            </nav>

            <div className="flex-1 min-w-0">
              <div className="mb-4 px-1 flex items-baseline justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                    {activeSectionMeta.label}
                  </h2>
                  <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {sectionSubtitle[activeSection]}
                  </p>
                </div>
                {toolsMeta && (
                  <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 flex-shrink-0">
                    {toolsMeta}
                  </span>
                )}
              </div>

              {activeSection === 'home' && (
                <HomeDashboard onNavigate={setActiveSection} />
              )}

              {activeSection === 'tools' && (
                <TabContainer
                  tabs={toolTabs}
                  activeType={activeTool}
                  onSelect={setActiveTool}
                  onReorder={setToolOrder}
                  controls={renderToolControls()}
                >
                  <ToolComponent
                    id={activeToolWidget.id}
                    config={activeToolWidget.config}
                    onUpdateConfig={(config: any) => updateWidgetConfig(activeTool, config)}
                    isEditing={false}
                  />
                </TabContainer>
              )}

              {activeSection === 'news' && (
                <TabContainer
                  tabs={newsTabs}
                  activeType={safeActiveNews}
                  onSelect={setActiveNews}
                  onReorder={setNewsOrder}
                  controls={renderNewsControls()}
                >
                  <NewsComponent
                    id={activeNewsWidget.id}
                    config={activeNewsWidget.config}
                    onUpdateConfig={(config: any) => updateWidgetConfig(safeActiveNews, config)}
                    isEditing={false}
                  />
                </TabContainer>
              )}

              {activeSection === 'sports' && (
                <TabContainer
                  tabs={sportsTabs}
                  activeType={activeSports}
                  onSelect={setActiveSports}
                  onReorder={setSportsOrder}
                  controls={renderSportsControls()}
                >
                  <SportsComponent
                    id={activeSportsWidget.id}
                    config={activeSportsWidget.config}
                    onUpdateConfig={(config: any) => updateWidgetConfig(activeSports, config)}
                    isEditing={false}
                  />
                </TabContainer>
              )}

              {activeSection === 'stocks' && (
                <TabContainer
                  tabs={stocksTabs}
                  activeType={activeStocks}
                  onSelect={setActiveStocks}
                  onReorder={setStocksOrder}
                  controls={renderStocksControls()}
                >
                  <StocksComponent
                    id={activeStocksWidget.id}
                    config={activeStocksWidget.config}
                    onUpdateConfig={(config: any) => updateWidgetConfig(activeStocks, config)}
                    isEditing={false}
                  />
                </TabContainer>
              )}
            </div>
          </div>
        </main>

        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onNavigate={setActiveSection}
        />
      </div>
    </div>
  );
}
