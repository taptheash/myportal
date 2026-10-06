import React, { useState, useEffect, Suspense, lazy } from 'react';
import {
  Sun, Moon, Monitor, Plus, Minus, Crosshair, Rss, Wrench, Newspaper, TrendingUp, BarChart3, Flame,
  StickyNote, ListChecks, Link2, Trophy, Megaphone, Globe, Laptop, MapPin, Sparkles, Home as HomeIcon,
  Calendar as CalendarIcon, Search as SearchIcon, RefreshCw, X as XIcon, Bookmark, Sunrise, LayoutList, Plane,
  Gamepad2, Spade, Club, Bug, LayoutGrid, Bomb, Grid3x3, Crown, SpellCheck, TreePine, MoreHorizontal, Smartphone,
} from 'lucide-react';
import { useTheme, ThemeMode } from './hooks/useTheme';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useViewMode } from './hooks/useViewMode';

// Cloud sync is optional and lives in SyncButton + lib/cloudSync.ts: the
// portal never waits on sign-in, and without Firebase config it simply
// doesn't show the sync button.
import TabContainer, { TabDef } from './components/TabContainer';
import { OnThisDayPill, NationalDayPill } from './components/TodayFacts';
import HomeDashboard from './components/HomeDashboard';
import CommandPalette from './components/CommandPalette';
import SyncButton from './components/SyncButton';
import RightRail from './components/RightRail';
import { useResolvedName, requestRelocate } from './lib/weatherLocal';
import Weather from './components/widgets/Weather';
import Calendar from './components/widgets/Calendar';
import Headlines from './components/widgets/Headlines';
import UsNews from './components/widgets/UsNews';
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
import MyNews from './components/widgets/MyNews';
import SavedArticles from './components/widgets/SavedArticles';
import DailyBrief from './components/widgets/DailyBrief';
import FlightWall from './components/flights/FlightWall';
// Games load only when you open their tab, so they don't slow the portal down.
const Klondike = lazy(() => import('./components/games/Klondike'));
const FreeCell = lazy(() => import('./components/games/FreeCell'));
const Spider = lazy(() => import('./components/games/Spider'));
const Mahjong = lazy(() => import('./components/games/Mahjong'));
const Minesweeper = lazy(() => import('./components/games/Minesweeper'));
const Sudoku = lazy(() => import('./components/games/Sudoku'));
const Chess = lazy(() => import('./components/games/Chess'));
const DailyWord = lazy(() => import('./components/games/DailyWord'));
const MooseRun = lazy(() => import('./components/games/MooseRun'));

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
  usnews:     { type: 'usnews',     label: 'US News',     icon: Newspaper,    component: UsNews,       color: '#CC79A7', activeText: 'black' },
  tech:       { type: 'tech',       label: 'Tech & AI',   icon: Laptop,       component: TechNews,     color: '#0072B2', activeText: 'white' },
  local:      { type: 'local',      label: 'NH Local',    icon: MapPin,       component: LocalNews,    color: '#009E73', activeText: 'black' },
  feeds:      { type: 'feeds',      label: 'Feeds',       icon: Rss,          component: CustomFeeds,  color: '#56B4E9', activeText: 'black' },
  reddit:     { type: 'reddit',     label: 'Reddit',      icon: Flame,        component: RedditPopular, color: '#F0E442', activeText: 'black' },
  business:   { type: 'business',   label: 'Business',    icon: Globe,        component: BusinessNews, color: '#E69F00', activeText: 'black' },
  flights:    { type: 'flights',    label: 'Flights',     icon: Plane,        component: FlightWall,   color: '#FFB000', activeText: 'black' },
  solitaire:  { type: 'solitaire',  label: 'Solitaire',   icon: Spade,        component: Klondike as React.ComponentType<any>,    color: '#009E73', activeText: 'black' },
  freecell:   { type: 'freecell',   label: 'FreeCell',    icon: Club,         component: FreeCell as React.ComponentType<any>,    color: '#56B4E9', activeText: 'black' },
  spider:     { type: 'spider',     label: 'Spider',      icon: Bug,          component: Spider as React.ComponentType<any>,      color: '#CC79A7', activeText: 'black' },
  mahjong:    { type: 'mahjong',    label: 'Mahjong',     icon: LayoutGrid,   component: Mahjong as React.ComponentType<any>,     color: '#E69F00', activeText: 'black' },
  minesweeper: { type: 'minesweeper', label: 'Minesweeper', icon: Bomb,      component: Minesweeper as React.ComponentType<any>, color: '#D55E00', activeText: 'black' },
  sudoku:     { type: 'sudoku',     label: 'Sudoku',      icon: Grid3x3,      component: Sudoku as React.ComponentType<any>,      color: '#0072B2', activeText: 'white' },
  chess:      { type: 'chess',      label: 'Chess',       icon: Crown,        component: Chess as React.ComponentType<any>,       color: '#009E73', activeText: 'black' },
  dailyword:  { type: 'dailyword',  label: 'Daily Word',  icon: SpellCheck,   component: DailyWord as React.ComponentType<any>,   color: '#F0E442', activeText: 'black' },
  mooserun:   { type: 'mooserun',   label: 'Moose Run',   icon: TreePine,     component: MooseRun as React.ComponentType<any>,    color: '#56B4E9', activeText: 'black' },
  mynews:     { type: 'mynews',     label: 'My News',     icon: LayoutList,   component: MyNews,       color: '#0072B2', activeText: 'white' },
  saved:      { type: 'saved',      label: 'Saved',       icon: Bookmark,     component: SavedArticles, color: '#009E73', activeText: 'black' },
  brief:      { type: 'brief',      label: 'Daily Brief', icon: Sunrise,      component: DailyBrief,   color: '#E69F00', activeText: 'black' },
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
const NEWS_TYPES = ['mynews', 'saved', 'brief', 'sportsnews', 'headlines', 'usnews', 'tech', 'local', 'business', 'weird', 'feeds'];
const SPORTS_TYPES = ['sports', 'nflSchedule', 'patsSchedule', 'soxSchedule', 'celticsSchedule', 'bruinsSchedule'];
const STOCK_TYPES = ['watchlist', 'marketOverview'];
// Reddit is its own top-level section (not a News tab) with exactly one
// widget — no sub-tabs, so it doesn't need an "order" array the way
// News/Sports/Stocks do, but it still needs to be in ALL_TYPES so its
// widget instance gets created/found like every other type.
const REDDIT_TYPES = ['reddit'];
const FLIGHT_TYPES = ['flights'];
// Games: one tab per game.
const GAME_TYPES = ['solitaire', 'freecell', 'spider', 'mahjong', 'minesweeper', 'sudoku', 'chess', 'dailyword', 'mooserun'];
const ALL_TYPES = [...TOOL_TYPES, ...NEWS_TYPES, ...SPORTS_TYPES, ...STOCK_TYPES, ...REDDIT_TYPES, ...FLIGHT_TYPES, ...GAME_TYPES];

function makeDefaultWidgets(): WidgetInstance[] {
  return ALL_TYPES.map((type) => ({
    id: type,
    type,
    title: WIDGET_DEFINITIONS[type].label,
    config: {},
  }));
}

const NEWS_ARTICLE_TYPES = new Set(['mynews', 'sportsnews', 'headlines', 'usnews', 'tech', 'local', 'business', 'weird']);

// Top-level section nav — adding a future section is one entry here, plus
// one more conditional render branch below. No layout-width juggling needed
// the way the old side-by-side/stacked columns required every time a
// section was added.
const SECTIONS = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'reddit', label: 'Reddit', icon: Flame },
  { id: 'sports', label: 'Sports', icon: Trophy },
  { id: 'stocks', label: 'Stocks', icon: TrendingUp },
  { id: 'flights', label: 'Flights', icon: Plane },
  { id: 'games', label: 'Games', icon: Gamepad2 },
];

// Phone layout: four sections in the bottom bar, the rest under "More".
// Flights and Games are desktop-only.
const MOBILE_PRIMARY = ['home', 'tools', 'news', 'sports'];
const MOBILE_MORE = ['reddit', 'stocks'];
const MOBILE_SECTIONS = [...MOBILE_PRIMARY, ...MOBILE_MORE];

export default function App() {
  const { mode, resolvedTheme, setMode } = useTheme();
  const { isMobile, autoIsPhone, toggle: toggleView } = useViewMode();
  const [moreOpen, setMoreOpen] = useState(false);
  const [storedWidgets, setWidgets] = useLocalStorage<WidgetInstance[]>('pw6', makeDefaultWidgets());
  const [storedActiveTool, setActiveTool] = useLocalStorage<string>('pw6-active-tool', 'weather');
  const [activeNews, setActiveNews] = useLocalStorage<string>('pw6-active-news', 'mynews');
  const [storedActiveSports, setActiveSports] = useLocalStorage<string>('pw6-active-sports', 'sports');
  const [storedActiveStocks, setActiveStocks] = useLocalStorage<string>('pw6-active-stocks', 'watchlist');
  const [storedActiveGame, setActiveGame] = useLocalStorage<string>('pw6-active-game', 'solitaire');
  const [storedActiveSection, setActiveSection] = useLocalStorage<string>('pw6-active-section', 'home');
  const [toolOrder, setToolOrder] = useLocalStorage<string[]>('pw6-tool-order', TOOL_TYPES);
  const [newsOrder, setNewsOrder] = useLocalStorage<string[]>('pw6-news-order', NEWS_TYPES);
  const [sportsOrder, setSportsOrder] = useLocalStorage<string[]>('pw6-sports-order', SPORTS_TYPES);
  const [stocksOrder, setStocksOrder] = useLocalStorage<string[]>('pw6-stocks-order', STOCK_TYPES);
  const [gamesOrder, setGamesOrder] = useLocalStorage<string[]>('pw6-games-order', GAME_TYPES);
  const [weatherEditing, setWeatherEditing] = useState(false);
  const [weatherInput, setWeatherInput] = useState('');
  const resolvedWeatherName = useResolvedName();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentTimeShort, setCurrentTimeShort] = useState<string>('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  // True for a moment after pressing G, while waiting for the section key.
  const [goArmed, setGoArmed] = useState(false);
  // Hidden links page. hiddenPageOpen is a plain useState (NOT
  // useLocalStorage) on purpose — it must never be written to localStorage
  // or reflected in the URL, so it always starts closed on every load and
  // the only way back is reloading the tab. hiddenLinksConfig is a
  // completely separate storage key from the main Quick Links widget, so it
  // never appears in Home's Favorites/Recent lists.
  const [hiddenPageOpen, setHiddenPageOpen] = useState(false);
  const [hiddenLinksConfig, setHiddenLinksConfig] = useLocalStorage<Record<string, any>>('pw6-hidden-links', { links: [] });
  // Purely a visual spin for the News refresh button — the actual re-fetch
  // is triggered by bumping the active widget's config.refreshNonce, which
  // each news widget watches to bypass its own cache for one fetch.
  const [newsRefreshSpin, setNewsRefreshSpin] = useState(false);

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

  // One-time move for browsers set up before My News existed: put My News,
  // Saved and Daily Brief at the front of the News tabs (a saved tab order
  // would otherwise tack them on at the end) and open News on My News.
  useEffect(() => {
    const FLAG = 'news-v2-migrated';
    try {
      if (localStorage.getItem(FLAG)) return;
      const front = ['mynews', 'saved', 'brief'];
      setNewsOrder((prev) => [...front, ...prev.filter((t) => !front.includes(t))]);
      setActiveNews('mynews');
      localStorage.setItem(FLAG, '1');
    } catch { /* storage blocked — defaults already put them first */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Widgets ask to move you elsewhere (e.g. a note's link to its task) via
  // lib/portalNav.ts.
  useEffect(() => {
    const onNav = (e: Event) => {
      const { section, tool } = (e as CustomEvent).detail || {};
      if (section) setActiveSection(section);
      if (tool) setActiveTool(tool);
    };
    window.addEventListener('portal-navigate', onNav);
    return () => window.removeEventListener('portal-navigate', onNav);
  }, [setActiveSection, setActiveTool]);

  // "G then a letter" jumps between sections: G H Home, G T Tools, G N News,
  // G R Reddit, G S Sports, G M Markets (Stocks), G F Flights, G G Games. Ignored while typing in a
  // field, and when Ctrl/Alt/Cmd is held, so it never steals a keystroke.
  useEffect(() => {
    const GO_KEYS: Record<string, string> = { h: 'home', t: 'tools', n: 'news', r: 'reddit', s: 'sports', m: 'stocks', f: 'flights', g: 'games' };
    let armedUntil = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const disarm = () => { armedUntil = 0; setGoArmed(false); };
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const key = e.key.toLowerCase();
      if (Date.now() < armedUntil) {
        const section = GO_KEYS[key];
        disarm();
        if (timer) clearTimeout(timer);
        if (section) {
          e.preventDefault();
          setActiveSection(section);
        }
        return;
      }
      if (key === 'g' && !e.shiftKey) {
        armedUntil = Date.now() + 1500;
        setGoArmed(true);
        if (timer) clearTimeout(timer);
        timer = setTimeout(disarm, 1500);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (timer) clearTimeout(timer);
    };
  }, [setActiveSection]);

  // storedWidgets is normally only ever changed through setWidgets below, so
  // it's kept in sync with localStorage automatically. But Home's Scratchpad
  // writes into the SAME 'pw6' localStorage key from outside React (via
  // lib/portalStorage.ts, since Home renders independently of whichever
  // Tools tab is active) — without this, a note or task filed from
  // Scratchpad wouldn't show up on the Notes/Tasks tabs until a full page
  // reload, because this component's in-memory copy never learned about the
  // out-of-band write. portalStorage.ts fires 'pw6-sync' after every write
  // for exactly this; the native 'storage' event is kept too as a fallback
  // for the same key changing in another browser tab (it never fires in the
  // tab that made the write, which is why 'pw6-sync' is needed at all).
  useEffect(() => {
    const syncWidgets = () => {
      try {
        const raw = window.localStorage.getItem('pw6');
        if (raw) setWidgets(JSON.parse(raw));
      } catch {
        // malformed storage — ignore, keep current in-memory state
      }
    };
    const onStorageEvent = (e: StorageEvent) => {
      if (e.key === 'pw6') syncWidgets();
    };
    window.addEventListener('pw6-sync', syncWidgets);
    window.addEventListener('storage', onStorageEvent);
    return () => {
      window.removeEventListener('pw6-sync', syncWidgets);
      window.removeEventListener('storage', onStorageEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const shortDate = now.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      setCurrentTimeShort(`${shortDate} · ${time.slice(0, 5)}`);
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

  // Hidden links page — a bare page with nothing else on it. Bails out of
  // the normal render entirely rather than being one more section, so none
  // of the header/nav/clock/search/theme-toggle chrome renders here.
  if (hiddenPageOpen) {
    return (
      <div className={resolvedTheme === 'dark' ? 'dark' : ''}>
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-6 py-8">
          <div className="max-w-md mx-auto flex flex-col gap-3">
            <button
              onClick={() => setHiddenLinksConfig({ ...hiddenLinksConfig, showAdd: true })}
              className="self-start flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors duration-150"
            >
              <Plus size={13} /> Add link
            </button>
            <QuickLinks
              id="hidden-links"
              config={hiddenLinksConfig}
              onUpdateConfig={setHiddenLinksConfig}
              isEditing={false}
              privateMode
            />
          </div>
        </div>
      </div>
    );
  }

  const byType = new Map(storedWidgets.map((w) => [w.type, w]));
  const widgets: WidgetInstance[] = ALL_TYPES.map(
    (type) => byType.get(type) ?? { id: type, type, title: WIDGET_DEFINITIONS[type].label, config: {} }
  );

  // Functional update against the LATEST stored list, not the `widgets`
  // snapshot from whichever render created this closure. Widgets call
  // onUpdateConfig from long-lived timers (news: hourly, weather: 10 min),
  // and the old `setWidgets(widgets.map(...))` form would write that stale
  // snapshot back — reverting anything saved in the meantime (e.g. a note
  // added in a second browser tab and synced in via the 'storage' event).
  const updateWidgetConfig = (type: string, config: Record<string, any>) => {
    setWidgets((prev) => {
      const found = prev.some((w) => w.type === type);
      return found
        ? prev.map((w) => (w.type === type ? { ...w, config } : w))
        : [...prev, { id: type, type, title: WIDGET_DEFINITIONS[type]?.label ?? type, config }];
    });
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
  const gamesTabs = resolveOrder(gamesOrder, GAME_TYPES).map(toTabDef);

  // Guards against activeNews still pointing at 'sports' from a browser
  // that had it selected before Sports moved out of the News section —
  // falls back to a tab that's actually still in News.
  const safeActiveNews = NEWS_TYPES.includes(activeNews) ? activeNews : NEWS_TYPES[0];
  // Same guard for every other section. Without it, a stored tab/section id
  // that no longer exists (a renamed or removed widget type, or a hand-edited
  // localStorage value) makes WIDGET_DEFINITIONS[...] undefined and the whole
  // portal renders as a blank white page with no way to recover in the UI.
  const activeTool = TOOL_TYPES.includes(storedActiveTool) ? storedActiveTool : TOOL_TYPES[0];
  const activeSports = SPORTS_TYPES.includes(storedActiveSports) ? storedActiveSports : SPORTS_TYPES[0];
  const activeStocks = STOCK_TYPES.includes(storedActiveStocks) ? storedActiveStocks : STOCK_TYPES[0];
  const activeGame = GAME_TYPES.includes(storedActiveGame) ? storedActiveGame : GAME_TYPES[0];
  const knownSection = SECTIONS.some((s) => s.id === storedActiveSection) ? storedActiveSection : 'home';
  // On the phone, a section that isn't offered there (Flights, Games — e.g.
  // G-key jump or the command palette) falls back to Home without touching
  // the stored choice.
  const activeSection = isMobile && !MOBILE_SECTIONS.includes(knownSection) ? 'home' : knownSection;

  const activeToolWidget = widgets.find((w) => w.type === activeTool)!;
  const activeNewsWidget = widgets.find((w) => w.type === safeActiveNews)!;
  const activeSportsWidget = widgets.find((w) => w.type === activeSports)!;
  const activeStocksWidget = widgets.find((w) => w.type === activeStocks)!;
  const activeGameWidget = widgets.find((w) => w.type === activeGame)!;
  // Reddit has no sub-tabs (it's a single-widget section), so unlike the
  // others there's no "active<X>" selection state to track — just the one
  // widget instance.
  const redditWidget = widgets.find((w) => w.type === 'reddit')!;

  const renderToolControls = () => {
    if (activeTool === 'weather') {
      const displayLocation = activeToolWidget.config.location || resolvedWeatherName || 'Detecting…';
      const recentLocations: Array<{ query: string; name: string }> = Array.isArray(activeToolWidget.config.recentLocations)
        ? activeToolWidget.config.recentLocations
        : [];
      const chooseLocation = (query: string) => {
        updateWidgetConfig('weather', { ...activeToolWidget.config, location: query });
        setWeatherEditing(false);
      };
      const forgetLocation = (query: string) =>
        updateWidgetConfig('weather', {
          ...activeToolWidget.config,
          recentLocations: recentLocations.filter((r) => r.query !== query),
        });
      const filter = weatherInput.trim().toLowerCase();
      const shownRecents = recentLocations.filter(
        (r) => !filter || filter === displayLocation.toLowerCase() || r.query.toLowerCase().includes(filter) || r.name.toLowerCase().includes(filter)
      );
      return weatherEditing ? (
        <div className="relative">
          <input
            type="text"
            value={weatherInput}
            onChange={(e) => setWeatherInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && weatherInput.trim()) chooseLocation(weatherInput.trim());
              if (e.key === 'Escape') setWeatherEditing(false);
            }}
            onFocus={(e) => e.target.select()}
            onBlur={() => setWeatherEditing(false)}
            placeholder="ZIP or city"
            className="px-2 py-1 text-xs rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-48"
            autoFocus
          />
          {shownRecents.length > 0 && (
            // onMouseDown + preventDefault so clicking a place doesn't blur
            // (and close) the input before the click registers.
            <div
              onMouseDown={(e) => e.preventDefault()}
              className="absolute right-0 mt-1 w-64 z-50 p-1 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-lg"
            >
              <div className="px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Recent locations</div>
              {shownRecents.map((r) => (
                <div key={r.query} className="group flex items-center gap-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <button
                    onClick={() => chooseLocation(r.query)}
                    className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 text-left text-xs text-zinc-700 dark:text-zinc-200"
                  >
                    <MapPin size={12} className="flex-shrink-0 text-zinc-400" />
                    <span className="truncate">{r.name}</span>
                    {r.query.toLowerCase() !== r.name.toLowerCase() && (
                      <span className="text-zinc-400 dark:text-zinc-500 truncate">({r.query})</span>
                    )}
                  </button>
                  <button
                    onClick={() => forgetLocation(r.query)}
                    title="Remove from recent locations"
                    className="p-1 mr-1 rounded text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity duration-150"
                  >
                    <XIcon size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              // Clearing location drops hasManualLocation back to false in
              // Weather.tsx, which re-runs the same geolocation path it
              // already uses when nothing's been manually set — no new
              // fetch logic needed, just handing back control to it.
              // locateNonce forces a fresh position lookup every press, even
              // if no manual location was set; clearing resolvedLocationName
              // shows "Detecting…" so you can see it's working.
              // The re-locate signal and the resolved place name are kept on
              // this device only (lib/weatherLocal.ts); the old synced
              // resolvedLocationName/locateNonce fields are dropped here.
              const { location, resolvedLocationName, locateNonce, ...rest } = activeToolWidget.config;
              if (location !== undefined || resolvedLocationName !== undefined || locateNonce !== undefined) {
                updateWidgetConfig('weather', rest);
              }
              requestRelocate();
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
    const isArticleType = NEWS_ARTICLE_TYPES.has(safeActiveNews);
    const count = activeNewsWidget.config.articleCount || 10;
    // Show what's actually on screen, not just the requested target — the
    // source feed doesn't always have as many items as asked for.
    const displayCount = activeNewsWidget.config.lastFetchedCount ?? count;
    return (
      <div className="flex items-center gap-3">
        {isArticleType && (
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
        )}
        <button
          onClick={() => {
            // The widget itself watches for this nonce changing and does one
            // cache-bypassing fetch when it does — see refreshNonce handling
            // in each news widget component.
            setNewsRefreshSpin(true);
            updateWidgetConfig(safeActiveNews, { ...activeNewsWidget.config, refreshNonce: Date.now() });
            setTimeout(() => setNewsRefreshSpin(false), 900);
          }}
          title="Refresh this feed now"
          className="flex items-center justify-center p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors duration-150"
        >
          <RefreshCw size={14} className={newsRefreshSpin ? 'animate-spin' : ''} />
        </button>
      </div>
    );
  };

  const renderRedditControls = () => {
    const count = redditWidget.config.articleCount || 10;
    const displayCount = redditWidget.config.lastFetchedCount ?? count;
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-zinc-500 dark:text-zinc-400 mr-1">Posts</span>
        <button
          onClick={() => updateWidgetConfig('reddit', { ...redditWidget.config, articleCount: Math.max(1, count - 1) })}
          className="w-6 h-6 flex items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors duration-150"
        >
          <Minus size={13} />
        </button>
        <span className="text-xs font-semibold w-5 text-center text-zinc-700 dark:text-zinc-200">{displayCount}</span>
        <button
          onClick={() => updateWidgetConfig('reddit', { ...redditWidget.config, articleCount: Math.min(100, count + 1) })}
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
  const GameComponent = WIDGET_DEFINITIONS[activeGame].component;

  const themeToggle = (
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
  );

  const activeSectionMeta = SECTIONS.find((s) => s.id === activeSection)!;
  // Desktop: the page title sits on the tab row (see TabContainer).
  const tabTitle = isMobile ? undefined : activeSectionMeta.label;
  const sectionSubtitle: Record<string, string> = {
    home: 'Everything that matters today, at a glance',
    tools: 'Your shortcuts, utilities and frequently used services',
    news: 'Headlines and feeds, curated to what you actually read',
    reddit: 'Hot posts from the subreddits you follow',
    sports: 'Live scores and schedules for the teams you follow',
    stocks: 'Watchlist and market snapshot at a glance',
    flights: 'Live aircraft over the areas you pick, FlightWall style',
    games: 'Something to pass the time',
  };
  return (
    <div className={resolvedTheme === 'dark' ? 'dark' : ''}>
      <div className={`min-h-screen app-bg text-zinc-900 dark:text-zinc-100 ${isMobile ? '' : 'pl-[84px]'}`}>
        {/* Hidden entry point to the private links page: a small box in the
            bottom-left corner, filled with the page background color, with
            a single 1px dot in its center in a slightly different color so
            it's findable. The whole box is the click target. No hover
            state, no tooltip, not focusable. */}
        <div
          onClick={() => setHiddenPageOpen(true)}
          aria-hidden="true"
          className="fixed left-0 w-3 h-3 flex items-center justify-center bg-transparent z-[9999]"
          // On the phone it sits just above the bottom tab bar instead of on top of it.
          style={{ bottom: isMobile ? 'calc(56px + env(safe-area-inset-bottom))' : 0 }}
        >
          <span className="block w-px h-px bg-zinc-400 dark:bg-zinc-500" />
        </div>

        {/* A phone showing the desktop layout gets a way back, as a strip
            above everything: the desktop header is too crowded at phone
            width, and a fixed-position button can land off-screen once the
            browser zooms out to fit the wide layout. */}
        {!isMobile && autoIsPhone && (
          <button
            onClick={toggleView}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-[14px] font-medium text-white bg-indigo-600"
          >
            <Smartphone size={15} /> Switch to mobile view
          </button>
        )}

        {!isMobile && (
          <nav className="fixed left-0 top-0 bottom-0 z-[60] w-[84px] flex flex-col items-center gap-1 py-4 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md border-r border-white/80 dark:border-zinc-800">
            <div className="mb-3 w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-[13px] font-bold tracking-tight shadow-sm" aria-hidden="true">MP</div>
            {SECTIONS.map((section) => {
              const isActive = activeSection === section.id;
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  aria-current={isActive}
                  title={section.label}
                  className={`w-[68px] flex flex-col items-center gap-1 py-2 rounded-xl text-[11px] font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                    isActive
                      ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/70 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <Icon size={20} strokeWidth={1.75} />
                  {section.label}
                </button>
              );
            })}
          </nav>
        )}

        <header className={isMobile
          ? 'sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-200/80 dark:border-zinc-800/80'
          : 'sticky top-0 z-50 bg-[#eceef3]/80 dark:bg-[#0f0f14]/80 backdrop-blur-md'}>
          {isMobile ? (
          <div className="px-3 pt-2.5 pb-2 flex flex-col gap-2">
            <div className="flex justify-between items-center gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" aria-hidden="true" />
                <h1 className="text-[14px] font-semibold text-zinc-500 dark:text-zinc-400 tabular-nums tracking-tight truncate">
                  {currentTimeShort || 'Loading…'}
                </h1>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <SyncButton />
                <button
                  onClick={() => setPaletteOpen(true)}
                  aria-label="Search"
                  className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800"
                >
                  <SearchIcon size={15} />
                </button>
                {themeToggle}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <OnThisDayPill />
              <NationalDayPill />
            </div>
          </div>
          ) : (
          <div className="px-6 py-3 flex items-center justify-end gap-3">
            <div className="text-[13px] font-medium text-zinc-600 dark:text-zinc-300 tabular-nums whitespace-nowrap">
              {currentTime || 'Loading…'}
            </div>
            <span className="w-px h-6 bg-zinc-300/70 dark:bg-zinc-700" aria-hidden="true" />
            <OnThisDayPill />
            <span className="w-px h-6 bg-zinc-300/70 dark:bg-zinc-700" aria-hidden="true" />
            <NationalDayPill />
            <span className="w-px h-6 bg-zinc-300/70 dark:bg-zinc-700" aria-hidden="true" />
            <SyncButton />
            {/* The search box lives at the top of the right column; below
                that width the column is hidden, so search shows here. */}
            <button
              onClick={() => setPaletteOpen(true)}
              className="xl:hidden flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] text-zinc-400 dark:text-zinc-500 bg-white/70 dark:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300"
              title="Search everything (Ctrl+K)"
            >
              <SearchIcon size={14} /> Search…
            </button>
            {themeToggle}
          </div>
          )}
        </header>

        <main
          className={isMobile ? 'px-3 pt-3' : 'px-6 pt-2 pb-8 max-w-[1760px]'}
          style={isMobile ? { paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' } : undefined}
        >
          <div className={isMobile ? 'w-full' : 'flex flex-row gap-6 items-start w-full'}>


            <div className="flex-1 min-w-0">
              {(isMobile || activeSection === 'home' || activeSection === 'flights') && (
              <div className={`${isMobile ? 'mb-2' : 'mb-4'} px-1 flex items-baseline justify-between gap-4 flex-wrap`}>
                <div>
                  <h2 className={`${isMobile ? 'text-lg' : 'text-[28px]'} font-semibold tracking-tight text-zinc-900 dark:text-white`}>
                    {activeSectionMeta.label}
                  </h2>
                  {!isMobile && (
                  <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {sectionSubtitle[activeSection]}
                  </p>
                  )}
                </div>
              </div>
              )}

              {activeSection === 'home' && (
                <HomeDashboard onNavigate={setActiveSection} />
              )}

              {activeSection === 'tools' && (
                <TabContainer
                  title={tabTitle}
                  pills={!isMobile}
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
                    layout={isMobile ? 'list' : 'grid'}
                  />
                </TabContainer>
              )}

              {activeSection === 'news' && (
                <TabContainer
                  title={tabTitle}
                  pills={!isMobile}
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

              {activeSection === 'reddit' && (
                <TabContainer
                  title={tabTitle}
                  pills={!isMobile}
                  tabs={[toTabDef('reddit')]}
                  activeType="reddit"
                  onSelect={() => {}}
                  onReorder={() => {}}
                  controls={renderRedditControls()}
                >
                  <RedditPopular
                    id={redditWidget.id}
                    config={redditWidget.config}
                    onUpdateConfig={(config: any) => updateWidgetConfig('reddit', config)}
                    isEditing={false}
                  />
                </TabContainer>
              )}

              {activeSection === 'sports' && (
                <TabContainer
                  title={tabTitle}
                  pills={!isMobile}
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

              {activeSection === 'flights' && (
                <FlightWall
                  config={widgets.find((w) => w.type === 'flights')!.config}
                  onUpdateConfig={(config: any) => updateWidgetConfig('flights', config)}
                />
              )}

              {activeSection === 'games' && (
                <TabContainer
                  title={tabTitle}
                  pills={!isMobile}
                  tabs={gamesTabs}
                  activeType={activeGame}
                  onSelect={setActiveGame}
                  onReorder={setGamesOrder}
                >
                  <Suspense fallback={<div className="py-16 text-center text-sm text-zinc-400">Loading…</div>}>
                    <GameComponent
                      key={activeGame}
                      id={activeGameWidget.id}
                      config={activeGameWidget.config}
                      onUpdateConfig={(config: any) => updateWidgetConfig(activeGame, config)}
                      isEditing={false}
                    />
                  </Suspense>
                </TabContainer>
              )}

              {activeSection === 'stocks' && (
                <TabContainer
                  title={tabTitle}
                  pills={!isMobile}
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

            {!isMobile && (
              <div className="hidden xl:block sticky top-[64px] self-start max-h-[calc(100vh-80px)] overflow-y-auto no-scrollbar pb-2">
                <RightRail
                  onSearch={() => setPaletteOpen(true)}
                  onOpenWeather={() => { setActiveSection('tools'); setActiveTool('weather'); }}
                  onOpenCalendar={() => { setActiveSection('tools'); setActiveTool('calendar'); }}
                />
              </div>
            )}
          </div>
        </main>

        {isMobile && (
          <>
            {moreOpen && (
              <div className="fixed inset-0 z-[90]" onClick={() => setMoreOpen(false)}>
                <div className="absolute inset-0 bg-black/30" />
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute left-0 right-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 rounded-t-2xl p-2 shadow-lg"
                  style={{ bottom: 'calc(56px + env(safe-area-inset-bottom))' }}
                >
                  {MOBILE_MORE.map((id) => {
                    const section = SECTIONS.find((s) => s.id === id)!;
                    const Icon = section.icon;
                    const isActive = activeSection === id;
                    return (
                      <button
                        key={id}
                        onClick={() => { setActiveSection(id); setMoreOpen(false); window.scrollTo(0, 0); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium text-left ${
                          isActive ? 'bg-zinc-100 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400' : 'text-zinc-700 dark:text-zinc-200'
                        }`}
                      >
                        <Icon size={18} /> {section.label}
                      </button>
                    );
                  })}
                  <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />
                  <button
                    onClick={() => { setMoreOpen(false); toggleView(); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium text-left text-zinc-500 dark:text-zinc-400"
                  >
                    <Monitor size={18} /> Desktop view
                  </button>
                </div>
              </div>
            )}
            <nav
              className="fixed bottom-0 left-0 right-0 z-[100] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-800"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="h-14 grid grid-cols-5">
                {[...MOBILE_PRIMARY, 'more'].map((id) => {
                  const isMore = id === 'more';
                  const section = SECTIONS.find((s) => s.id === id);
                  const Icon = isMore ? MoreHorizontal : section!.icon;
                  const label = isMore ? 'More' : section!.label;
                  const isActive = isMore ? moreOpen || MOBILE_MORE.includes(activeSection) : !moreOpen && activeSection === id;
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        if (isMore) { setMoreOpen(!moreOpen); return; }
                        setMoreOpen(false);
                        setActiveSection(id);
                        window.scrollTo(0, 0);
                      }}
                      aria-current={isActive}
                      className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                        isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      <Icon size={20} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </nav>
          </>
        )}

        {goArmed && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-3 py-2 rounded-xl bg-zinc-900/90 dark:bg-zinc-100/90 text-white dark:text-zinc-900 text-xs shadow-lg backdrop-blur-sm flex items-center gap-3">
            <span className="font-semibold">Go to…</span>
            {[['H', 'Home'], ['T', 'Tools'], ['N', 'News'], ['R', 'Reddit'], ['S', 'Sports'], ['M', 'Markets'], ['F', 'Flights'], ['G', 'Games']].map(([k, label]) => (
              <span key={k} className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white/15 dark:bg-zinc-900/15 font-mono text-[11px]">{k}</kbd>
                {label}
              </span>
            ))}
          </div>
        )}

        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onNavigate={setActiveSection}
          onAddLink={() => {
            // "Add a Quick Link" used to only switch to Tools, leaving you on
            // whatever tab was last open with no add form showing.
            setActiveSection('tools');
            setActiveTool('links');
            const linksWidget = widgets.find((w) => w.type === 'links');
            updateWidgetConfig('links', { ...(linksWidget?.config || {}), showAdd: true });
          }}
        />
      </div>
    </div>
  );
}
