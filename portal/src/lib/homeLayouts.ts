// Multiple Home layouts (Home / Work / Weekend ...). Each layout has its own
// visible cards and order. The layout list syncs across devices
// ('pw6-home-layouts'); which one is showing is per device
// ('pw6-home-active'), like which tab you're on.

export interface HomeLayout {
  id: string;
  name: string;
  enabled: string[];
  order: string[];
}

export interface LayoutsState {
  layouts: HomeLayout[];
  auto: boolean; // switch by day/time
}

export interface ActiveChoice {
  id: string;
  date: string; // yyyy-mm-dd the manual pick was made; with auto on it holds for that day only
}

export const MAX_LAYOUTS = 5;

export function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// First run: the existing Home setup becomes "Home"; Work and Weekend start
// with sensible card sets that can be customized.
export function initialLayouts(allModules: string[]): LayoutsState {
  const read = (key: string): string[] | null => {
    try {
      const v = JSON.parse(localStorage.getItem(key) || 'null');
      return Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  };
  const order = read('pw6-home-order') || allModules;
  const enabled = read('pw6-home-enabled') || allModules;
  const pick = (ids: string[]) => ({ enabled: ids.filter((i) => allModules.includes(i)), order: [...ids, ...allModules.filter((m) => !ids.includes(m))] });
  return {
    auto: true,
    layouts: [
      { id: 'home', name: 'Home', enabled, order },
      { id: 'work', name: 'Work', ...pick(['attention', 'agenda', 'weather', 'favorites', 'scratchpad', 'news', 'stocks', 'recent']) },
      { id: 'weekend', name: 'Weekend', ...pick(['weather', 'agenda', 'sports', 'onthisday', 'news', 'favorites', 'recent']) },
    ],
  };
}

// The auto schedule: Weekend on Saturday/Sunday, Work on weekdays 8 AM-5 PM,
// Home the rest of the time. Falls back to the first layout if one of those
// has been deleted.
export function autoLayoutId(layouts: HomeLayout[], now = new Date()): string {
  const day = now.getDay();
  const hour = now.getHours();
  const want = day === 0 || day === 6 ? 'weekend' : hour >= 8 && hour < 17 ? 'work' : 'home';
  return (layouts.find((l) => l.id === want) || layouts[0]).id;
}

export function resolveActive(state: LayoutsState, choice: ActiveChoice | null, now = new Date()): string {
  const exists = (id?: string) => !!id && state.layouts.some((l) => l.id === id);
  if (!state.auto) return exists(choice?.id) ? choice!.id : state.layouts[0].id;
  if (choice && choice.date === localDay(now) && exists(choice.id)) return choice.id;
  return autoLayoutId(state.layouts, now);
}
