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
          return (
            <button
              key={tab.type}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(tab.type)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-t-xl text-sm font-semibold whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                isActive
                  ? `bg-gradient-to-r ${tab.color} text-white shadow-md relative z-10 -mb-px`
                  : 'bg-gray-100 dark:bg-slate-800/70 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'
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
