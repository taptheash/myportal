import React, { useState } from 'react';
import { Moon, Sun, Plus, Minus } from 'lucide-react';
import { useTheme } from './hooks/useTheme';
import { useLocalStorage } from './hooks/useLocalStorage';

import DailyQuote from './components/DailyQuote';
import Weather from './components/widgets/Weather';
import Calendar from './components/widgets/Calendar';
import Headlines from './components/widgets/Headlines';
import TechNews from './components/widgets/TechNews';
import LocalNews from './components/widgets/LocalNews';
import WeirdNews from './components/widgets/WeirdNews';
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
  title: string;
  component: React.ComponentType<any>;
  color: string;
}

const WIDGET_DEFINITIONS: Record<string, WidgetDef> = {
  weather:    { type: 'weather',    title: '☀️ Weather',           component: Weather,    color: 'from-yellow-400 to-orange-500' },
  calendar:   { type: 'calendar',   title: '📅 Google Calendar',   component: Calendar,   color: 'from-purple-500 to-pink-500' },
  sports:     { type: 'sports',     title: '🏆 New England Sports',component: Sports,     color: 'from-blue-800 to-red-700' },
  sportsnews: { type: 'sportsnews', title: '📣 NE Sports News',    component: SportsNews, color: 'from-blue-700 to-cyan-600' },
  headlines:  { type: 'headlines',  title: '🌍 Top Headlines',     component: Headlines,  color: 'from-red-500 to-orange-400' },
  tech:       { type: 'tech',       title: '💻 Tech & AI News',    component: TechNews,   color: 'from-indigo-500 to-blue-600' },
  local:      { type: 'local',      title: '📍 NH Local News',     component: LocalNews,  color: 'from-green-500 to-emerald-400' },
  weird:      { type: 'weird',      title: '📰 Other News',        component: WeirdNews,  color: 'from-pink-500 to-rose-400' },
  notes:      { type: 'notes',      title: '📝 Notes',             component: Notes,      color: 'from-amber-300 to-yellow-400' },
  links:      { type: 'links',      title: '🔗 Quick Links',       component: QuickLinks, color: 'from-teal-500 to-cyan-400' },
};

const DEFAULT_ORDER = ['weather', 'calendar', 'notes', 'links', 'sports', 'sportsnews', 'headlines', 'tech', 'local', 'weird'];

function makeDefaultWidgets(): WidgetInstance[] {
  return DEFAULT_ORDER.map((type) => ({
    id: type,
    type,
    title: WIDGET_DEFINITIONS[type].title,
    config: {},
  }));
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [widgets, setWidgets] = useLocalStorage<WidgetInstance[]>('pw6', makeDefaultWidgets());
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [weatherEditId, setWeatherEditId] = useState<string | null>(null);
  const [weatherInput, setWeatherInput] = useState('');

  const activeTypes = widgets.map((w) => w.type);
  const availableToAdd = Object.keys(WIDGET_DEFINITIONS).filter((t) => !activeTypes.includes(t));

  const handleAddWidget = (type: string) => {
    const def = WIDGET_DEFINITIONS[type];
    if (!def) return;
    setWidgets([...widgets, { id: type, type, title: def.title, config: {} }]);
    setShowAddMenu(false);
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100">

        {/* Header */}
        <header className="sticky top-0 z-50 bg-white dark:bg-slate-800 shadow-md">
          <div className="px-6 py-4 flex justify-between items-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent flex-shrink-0">
              ✨ Doug's Portal
            </h1>
            <DailyQuote />
            <div className="flex gap-3 items-center flex-shrink-0">
              {availableToAdd.length > 0 && (
                <div className="relative">
                  <button onClick={() => setShowAddMenu(!showAddMenu)}
                    className="p-2.5 rounded-lg bg-green-100 dark:bg-green-900 hover:bg-green-200 dark:hover:bg-green-800 transition-all" title="Add widget">
                    <Plus size={20} className="text-green-600 dark:text-green-400" />
                  </button>
                  {showAddMenu && (
                    <div className="absolute right-0 top-12 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-600 z-50 min-w-48">
                      {availableToAdd.map((type) => (
                        <button key={type} onClick={() => handleAddWidget(type)}
                          className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                          {WIDGET_DEFINITIONS[type].title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button onClick={toggleTheme}
                className="p-2.5 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-all" title="Toggle theme">
                {theme === 'dark' ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-slate-600" />}
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Grid — fixed order, sized to content */}
        <main className="p-6 bg-gray-50 dark:bg-slate-900 min-h-screen">
          <div className="grid grid-cols-12 gap-4 items-start">
            {widgets.map((widget) => {
              const def = WIDGET_DEFINITIONS[widget.type];
              if (!def) return null;
              const Component = def.component;

              return (
                <div
                  key={widget.id}
                  className="rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  style={{ gridColumn: 'span 3' }}
                >
                  {/* TITLE BAR */}
                  <div className={`bg-gradient-to-r ${def.color} text-white px-3 py-2 flex justify-between items-center text-sm font-semibold select-none`}>
                    {widget.type === 'weather' ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span>{def.title}</span>
                        {weatherEditId === widget.id ? (
                          <input type="text" value={weatherInput}
                            onChange={(e) => setWeatherInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && weatherInput.trim()) {
                                setWidgets(widgets.map((w) => w.id === widget.id ? { ...w, config: { ...w.config, location: weatherInput.trim() } } : w));
                                setWeatherEditId(null); setWeatherInput('');
                              }
                              if (e.key === 'Escape') { setWeatherEditId(null); setWeatherInput(''); }
                            }}
                            onBlur={() => { setWeatherEditId(null); setWeatherInput(''); }}
                            placeholder="ZIP or city"
                            className="flex-1 px-2 py-0.5 text-xs rounded bg-white bg-opacity-20 text-white border border-white border-opacity-40 focus:outline-none"
                            autoFocus />
                        ) : (
                          <button onClick={() => { setWeatherEditId(widget.id); setWeatherInput(widget.config.location || 'New Hampshire'); }}
                            className="text-xs bg-white bg-opacity-20 hover:bg-opacity-30 px-2 py-0.5 rounded truncate max-w-32">
                            📍 {widget.config.location || 'New Hampshire'}
                          </button>
                        )}
                      </div>
                    ) : <span>{def.title}</span>}

                    <div className="flex items-center gap-1">
                      {['headlines','tech','local','weird','sportsnews'].includes(widget.type) && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => { const c = widget.config.articleCount || 10; setWidgets(widgets.map((w) => w.id === widget.id ? { ...w, config: { ...w.config, articleCount: Math.max(1, c - 1) } } : w)); }}
                            className="w-5 h-5 flex items-center justify-center bg-white bg-opacity-20 hover:bg-opacity-40 rounded"><Minus size={12} /></button>
                          <span className="text-xs font-bold w-5 text-center">{widget.config.articleCount || 10}</span>
                          <button onClick={() => { const c = widget.config.articleCount || 10; setWidgets(widgets.map((w) => w.id === widget.id ? { ...w, config: { ...w.config, articleCount: Math.min(25, c + 1) } } : w)); }}
                            className="w-5 h-5 flex items-center justify-center bg-white bg-opacity-20 hover:bg-opacity-40 rounded"><Plus size={12} /></button>
                        </div>
                      )}
                      {widget.type === 'links' && (
                        <button onClick={() => setWidgets(widgets.map((w) => w.id === widget.id ? { ...w, config: { ...w.config, showAdd: true } } : w))}
                          className="w-5 h-5 flex items-center justify-center bg-white bg-opacity-20 hover:bg-opacity-40 rounded" title="Add link">
                          <Plus size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* CONTENT */}
                  <div className="p-3">
                    <Component id={widget.id} config={widget.config}
                      onUpdateConfig={(config: any) => setWidgets(widgets.map((w) => w.id === widget.id ? { ...w, config } : w))}
                      isEditing={false} />
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
