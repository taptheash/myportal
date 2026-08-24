import React, { useState, useEffect } from 'react';
import {
  Sun, Moon, Monitor, Plus, Minus,
  StickyNote, Link2, Trophy, Megaphone, Globe, Laptop, MapPin, Sparkles,
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
import QuickLinks from './components/widgets/QuickLinks';
import Sports from './components/widgets/Sports';
import SportsNews from './components/widgets/SportsNews';

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
  color: string;
}

const WIDGET_DEFINITIONS: Record<string, WidgetDef> = {
  weather:    { type: 'weather',    label: 'Weather',     icon: Sun,          component: Weather,    color: 'from-yellow-400 to-orange-500' },
  notes:      { type: 'notes',      label: 'Notes',       icon: StickyNote,   component: Notes,      color: 'from-amber-300 to-yellow-400' },
  calendar:   { type: 'calendar',   label: 'Calendar',    icon: CalendarIcon, component: Calendar,   color: 'from-purple-500 to-pink-500' },
  links:      { type: 'links',      label: 'Quick Links', icon: Link2,        component: QuickLinks, color: 'from-teal-500 to-cyan-400' },
  sports:     { type: 'sports',     label: 'Sports',      icon: Trophy,       component: Sports,     color: 'from-blue-800 to-red-700' },
  sportsnews: { type: 'sportsnews', label: 'NE Sports',   icon: Megaphone,    component: SportsNews, color: 'from-blue-700 to-cyan-600' },
  headlines:  { type: 'headlines',  label: 'Headlines',   icon: Globe,        component: Headlines,  color: 'from-red-500 to-orange-400' },
  tech:       { type: 'tech',       label: 'Tech & AI',   icon: Laptop,       component: TechNews,   color: 'from-indigo-500 to-blue-600' },
  local:      { type: 'local',      label: 'NH Local',    icon: MapPin,       component: LocalNews,  color: 'from-green-500 to-emerald-400' },
  business:   { type: 'business',   label: 'Business',    icon: Globe,        component: BusinessNews, color: 'from-amber-500 to-yellow-600' },
  weird:      { type: 'weird',      label: 'Other',       icon: Sparkles,     component: WeirdNews,  color: 'from-pink-500 to-rose-400' },
};

const TOOL_TYPES = ['weather', 'notes', 'calendar', 'links', 'sports'];
const NEWS_TYPES = ['sportsnews', 'headlines', 'tech', 'local', 'business', 'weird'];
const ALL_TYPES = [...TOOL_TYPES, ...NEWS_TYPES];

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
  const [weatherEditing, setWeatherEditing] = useState(false);
  const [weatherInput, setWeatherInput] = useState('');
  const [currentTime, setCurrentTime] = useState<string>('');

  // Live clock: Full Month, Day Year HH:MM:SS
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const month = now.toLocaleString('en-US', { month: 'long' });
      const day = now.getDate();
      const year = now.getFullYear();
      const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      setCurrentTime(`${month} ${day}, ${year} ${time}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Bing wallpaper of the day
  useEffect(() => {
    const fetchBingWallpaper = async () => {
      try {
        const response = await fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=en-US');
        const data = await response.json();
        if (data.images && data.images.length > 0) {
          const imageUrl = `https://www.bing.com${data.images[0].url}`;
          document.body.style.backgroundImage = `url('${imageUrl}')`;
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
    return { type: def.type, label: def.label, icon: def.icon, color: def.color };
  };

  const toolTabs = TOOL_TYPES.map(toTabDef);
  const newsTabs = NEWS_TYPES.map(toTabDef);

  const activeToolWidget = widgets.find((w) => w.type === activeTool)!;
  const activeNewsWidget = widgets.find((w) => w.type === activeNews)!;

  const renderToolControls = () => {
    if (activeTool === 'weather') {
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
        <button
          onClick={() => {
            setWeatherEditing(true);
            setWeatherInput(activeToolWidget.config.location || 'New Hampshire');
          }}
          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/70 transition"
        >
          <MapPin size={12} /> {activeToolWidget.config.location || 'New Hampshire'}
        </button>
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

    return null;
  };

  const renderNewsControls = () => {
    if (!NEWS_ARTICLE_TYPES.has(activeNews)) return null;
    const count = activeNewsWidget.config.articleCount || 10;
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Articles</span>
        <button
          onClick={() => updateWidgetConfig(activeNews, { ...activeNewsWidget.config, articleCount: Math.max(1, count - 1) })}
          className="w-6 h-6 flex items-center justify-center rounded-md bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 transition"
        >
          <Minus size={13} />
        </button>
        <span className="text-xs font-bold w-5 text-center text-gray-700 dark:text-gray-200">{count}</span>
        <button
          onClick={() => updateWidgetConfig(activeNews, { ...activeNewsWidget.config, articleCount: Math.min(100, count + 1) })}
          className="w-6 h-6 flex items-center justify-center rounded-md bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 transition"
        >
          <Plus size={13} />
        </button>
      </div>
    );
  };

  const ToolComponent = WIDGET_DEFINITIONS[activeTool].component;
  const NewsComponent = WIDGET_DEFINITIONS[activeNews].component;

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
                activeType={activeNews}
                onSelect={setActiveNews}
                controls={renderNewsControls()}
              >
                <NewsComponent
                  id={activeNewsWidget.id}
                  config={activeNewsWidget.config}
                  onUpdateConfig={(config: any) => updateWidgetConfig(activeNews, config)}
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
