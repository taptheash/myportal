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

// Map gradient colors to light inactive variants
const COLOR_TO_LIGHT: Record<string, { bg: string; text: string }> = {
  'from-yellow-400 to-orange-500': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' },
  'from-amber-300 to-yellow-400': { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  'from-purple-500 to-pink-500': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
  'from-teal-500 to-cyan-400': { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300' },
  'from-blue-800 to-red-700': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  'from-blue-700 to-cyan-600': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  'from-red-500 to-orange-400': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
  'from-indigo-500 to-blue-600': { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300' },
  'from-green-500 to-emerald-400': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  'from-amber-500 to-yellow-600': { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  'from-pink-500 to-rose-400': { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300' },
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

  return (
    <section className="flex-1 min-w-0">
      <h2 className="text-xs font-bold tracking-widest text-gray-400 dark:text-slate-500 uppercase mb-2 px-1">
        {sectionLabel}
      </h2>

      <div className="flex gap-1 overflow-x-auto no-scrollbar" role="tablist" aria-label={sectionLabel}>
        {tabs.map((tab) => {
          const isActive = tab.type === activeType;
          const Icon = tab.icon;
          const lightColor = COLOR_TO_LIGHT[tab.color] || { bg: 'bg-gray-100 dark:bg-slate-800', text: 'text-gray-700 dark:text-gray-300' };
          
          return (
            <button
              key={tab.type}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(tab.type)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-t-xl text-sm font-semibold whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                isActive
                  ? `bg-gradient-to-r ${tab.color} text-white shadow-md relative z-10 -mb-px`
                  : `${lightColor.bg} ${lightColor.text} hover:opacity-80 relative`
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
        className="panel-fade-in bg-white dark:bg-slate-800 rounded-b-2xl rounded-tr-2xl shadow-lg border border-gray-200 dark:border-slate-700 relative z-0 overflow-hidden"
      >
        {controls && (
          <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-900/30 flex items-center justify-end gap-2">
            {controls}
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </section>
  );
}
