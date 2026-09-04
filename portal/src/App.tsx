import React, { useState, useEffect } from 'react';
import {
  Sun, Moon, Monitor, Plus, Minus, Crosshair, Rss,
  StickyNote, ListChecks, Link2, Trophy, Megaphone, Globe, Laptop, MapPin, Sparkles,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { useTheme, ThemeMode } from './hooks/useTheme';
import { useLocalStorage } from './hooks/useLocalStorage';

import TabContainer, { TabDef } from './components/TabContainer';
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
import PatriotsSchedule from './components/widgets/PatriotsSchedule';

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
  business:   { type: 'business',   label: 'Business',    icon: Globe,        component: BusinessNews, color: '#E69F00', activeText: 'black' },
  weird:      { type: 'weird',      label: 'Other',       icon: Sparkles,     component: WeirdNews,    color: '#CC79A7', activeText: 'black' },
  patsSchedule: { type: 'patsSchedule', label: 'Patriots Schedule', icon: CalendarIcon, component: PatriotsSchedule, color: '#0072B2', activeText: 'white' },
};

const TOOL_TYPES = ['weather', 'notes', 'tasks', 'calendar', 'links'];
const NEWS_TYPES = ['sportsnews', 'headlines', 'tech', 'local', 'business', 'weird', 'feeds'];
const SPORTS_TYPES = ['sports', 'patsSchedule'];
const ALL_TYPES = [...TOOL_TYPES, ...NEWS_TYPES, ...SPORTS_TYPES];

function makeDefaultWidgets(): WidgetInstance[] {
  return ALL_TYPES.map((type) => ({
    id: type,
    type,
    title: WIDGET_DEFINITIONS[type].label,
    config: {},
  }));
}

const NEWS_ARTICLE_TYPES = new Set(['sportsnews', 'headlines', 'tech', 'local', 'business', 'weird']);

export default function App() {
  const { mode, resolvedTheme, setMode } = useTheme();
  const [storedWidgets, setWidgets] = useLocalStorage<WidgetInstance[]>('pw6', makeDefaultWidgets());
  const [activeTool, setActiveTool] = useLocalStorage<string>('pw6-active-tool', 'weather');
  const [activeNews, setActiveNews] = useLocalStorage<string>('pw6-active-news', 'headlines');
  const [activeSports, setActiveSports] = useLocalStorage<string>('pw6-active-sports', 'sports');
  const [toolOrder, setToolOrder] = useLocalStorage<string[]>('pw6-tool-order', TOOL_TYPES);
  const [newsOrder, setNewsOrder] = useLocalStorage<string[]>('pw6-news-order', NEWS_TYPES);
  const [sportsOrder, setSportsOrder] = useLocalStorage<string[]>('pw6-sports-order', SPORTS_TYPES);
  const [weatherEditing, setWeatherEditing] = useState(false);
  const [weatherInput, setWeatherInput] = useState('');
  const [currentTime, setCurrentTime] = useState<string>('');

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

  // Guards against activeNews still pointing at 'sports' from a browser
  // that had it selected before Sports moved out of the News section —
  // falls back to a tab that's actually still in News.
  const safeActiveNews = NEWS_TYPES.includes(activeNews) ? activeNews : NEWS_TYPES[0];

  const activeToolWidget = widgets.find((w) => w.type === activeTool)!;
  const activeNewsWidget = widgets.find((w) => w.type === safeActiveNews)!;
  const activeSportsWidget = widgets.find((w) => w.type === activeSports)!;

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
          className="px-2 py-1 text-xs rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-400"
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
            className="flex items-center justify-center p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/70 transition"
          >
            <Crosshair size={14} />
          </button>
          <button
            onClick={() => {
              setWeatherEditing(true);
              setWeatherInput(displayLocation);
            }}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/70 transition"
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
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-teal-500 hover:bg-teal-600 text-white transition"
        >
          <Plus size={13} /> Add link
        </button>
      );
    }

    if (activeTool === 'calendar') {
      const eventCount = activeToolWidget.config.eventCount || 5;
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Events</span>
          <button
            onClick={() => updateWidgetConfig('calendar', { ...activeToolWidget.config, eventCount: Math.max(1, eventCount - 1) })}
            className="w-6 h-6 flex items-center justify-center rounded-md bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 transition"
          >
            <Minus size={13} />
          </button>
          <span className="text-xs font-bold w-5 text-center text-gray-700 dark:text-gray-200">{eventCount}</span>
          <button
            onClick={() => updateWidgetConfig('calendar', { ...activeToolWidget.config, eventCount: Math.min(20, eventCount + 1) })}
            className="w-6 h-6 flex items-center justify-center rounded-md bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 transition"
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
        <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Articles</span>
        <button
          onClick={() => updateWidgetConfig(safeActiveNews, { ...activeNewsWidget.config, articleCount: Math.max(1, count - 1) })}
          className="w-6 h-6 flex items-center justify-center rounded-md bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 transition"
        >
          <Minus size={13} />
        </button>
        <span className="text-xs font-bold w-5 text-center text-gray-700 dark:text-gray-200">{displayCount}</span>
        <button
          onClick={() => updateWidgetConfig(safeActiveNews, { ...activeNewsWidget.config, articleCount: Math.min(100, count + 1) })}
          className="w-6 h-6 flex items-center justify-center rounded-md bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 transition"
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
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black transition"
        >
          <Plus size={13} /> Add team
        </button>
      );
    }
    return null;
  };

  const ToolComponent = WIDGET_DEFINITIONS[activeTool].component;
  const NewsComponent = WIDGET_DEFINITIONS[safeActiveNews].component;
  const SportsComponent = WIDGET_DEFINITIONS[activeSports].component;

  return (
    <div className={resolvedTheme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100">
        <header className="sticky top-0 z-50 bg-white dark:bg-slate-800 shadow-md">
          <div className="px-6 py-4 flex justify-between items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex-shrink-0">
              {currentTime || 'Loading...'}
            </h1>
            <div className="flex items-center bg-gray-100 dark:bg-slate-700 rounded-lg p-1 gap-0.5 flex-shrink-0">
              {(['light', 'system', 'dark'] as ThemeMode[]).map((m) => {
                const Icon = m === 'light' ? Sun : m === 'dark' ? Moon : Monitor;
                const isActive = mode === m;
                return (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    title={m.charAt(0).toUpperCase() + m.slice(1)}
                    aria-pressed={isActive}
                    className={`p-1.5 rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                      isActive
                        ? 'bg-white dark:bg-slate-900 shadow-sm text-blue-600 dark:text-yellow-400'
                        : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <main className="p-6">
          <div className="flex flex-row gap-6 items-start w-full">
            <div className="flex-1 min-w-0">
              <TabContainer
                sectionLabel="Tools"
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
            </div>

            <div className="flex-1 min-w-0">
              <TabContainer
                sectionLabel="News"
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
            </div>

            <div className="flex-1 min-w-0">
              <TabContainer
                sectionLabel="Sports"
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
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
