import React from 'react';

export interface TabDef {
  type: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string; // Tailwind gradient classes, e.g. 'from-yellow-400 to-orange-500'
}

interface TabContainerProps {
  sectionLabel: string;
  tabs: TabDef[];
  activeType: string;
  onSelect: (type: string) => void;
  controls?: React.ReactNode;
  children: React.ReactNode;
}

// Map gradient colors to colorblind-accessible light inactive variants
// Using distinct saturation levels + patterns for colorblind accessibility
const COLOR_TO_LIGHT: Record<string, { bg: string; text: string; border: string; activeText: string }> = {
  'from-yellow-400 to-orange-500': { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-900 dark:text-yellow-200', border: 'border-t-4 border-yellow-500', activeText: 'text-white' },
  'from-amber-300 to-yellow-400': { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-900 dark:text-amber-200', border: 'border-t-4 border-amber-500', activeText: 'text-white' },
  'from-purple-500 to-pink-500': { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-900 dark:text-purple-200', border: 'border-t-4 border-purple-500', activeText: 'text-white' },
  'from-teal-500 to-cyan-400': { bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-900 dark:text-teal-200', border: 'border-t-4 border-teal-500', activeText: 'text-white' },
  'from-blue-800 to-red-700': { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-900 dark:text-blue-200', border: 'border-t-4 border-blue-700', activeText: 'text-white' },
  'from-blue-700 to-cyan-600': { bg: 'bg-sky-50 dark:bg-sky-900/20', text: 'text-sky-900 dark:text-sky-200', border: 'border-t-4 border-sky-600', activeText: 'text-white' },
  'from-red-500 to-orange-400': { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-900 dark:text-red-200', border: 'border-t-4 border-red-500', activeText: 'text-white' },
  'from-indigo-500 to-blue-600': { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-900 dark:text-indigo-200', border: 'border-t-4 border-indigo-600', activeText: 'text-white' },
  'from-green-500 to-emerald-400': { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-900 dark:text-green-200', border: 'border-t-4 border-green-600', activeText: 'text-white' },
  'from-amber-500 to-yellow-600': { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-900 dark:text-amber-200', border: 'border-t-4 border-amber-600', activeText: 'text-white' },
  'from-pink-500 to-rose-400': { bg: 'bg-pink-50 dark:bg-pink-900/20', text: 'text-pink-900 dark:text-pink-200', border: 'border-t-4 border-pink-500', activeText: 'text-white' },
};

export default function TabContainer({
  sectionLabel,
  tabs,
  activeType,
  onSelect,
  controls,
  children,
}: TabContainerProps) {
  const active = tabs.find((t) => t.type === activeType) ?? tabs[0];
  const activeDef = COLOR_TO_LIGHT[active.color] || { bg: 'bg-gray-100 dark:bg-slate-800', text: 'text-gray-700 dark:text-gray-300', border: 'border-t-4 border-gray-500', activeText: 'text-white' };

  return (
    <section className="flex-1 min-w-0 h-full flex flex-col">
      <h2 className="text-lg font-bold tracking-wide text-gray-900 dark:text-white uppercase mb-3 px-1">
        {sectionLabel}
      </h2>

      <div className="flex gap-1 overflow-x-auto no-scrollbar" role="tablist" aria-label={sectionLabel}>
        {tabs.map((tab) => {
          const isActive = tab.type === activeType;
          const Icon = tab.icon;
          const lightColor = COLOR_TO_LIGHT[tab.color] || { bg: 'bg-gray-100 dark:bg-slate-800', text: 'text-gray-700 dark:text-gray-300', border: 'border-t-4 border-gray-500', activeText: 'text-white' };
          
          return (
            <button
              key={tab.type}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(tab.type)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-t-xl text-sm font-semibold whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                isActive
                  ? `bg-gradient-to-r ${tab.color} ${lightColor.activeText} shadow-md relative z-10 -mb-px`
                  : `${lightColor.bg} ${lightColor.text} hover:opacity-85 relative border-t-4 border-transparent`
              }`}
            >
              <Icon size={15} className="flex-shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div
        key={active.type}
        role="tabpanel"
        className={`panel-fade-in bg-white dark:bg-slate-800 rounded-b-2xl rounded-tr-2xl shadow-lg border border-gray-200 dark:border-slate-700 ${activeDef.border} relative z-0 overflow-hidden flex-1 flex flex-col`}
      >
        {controls && (
          <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-900/30 flex items-center justify-end gap-2">
            {controls}
          </div>
        )}
        <div className="p-4 flex-1 overflow-y-auto">{children}</div>
      </div>
    </section>
  );
}
