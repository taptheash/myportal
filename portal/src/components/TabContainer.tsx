import React from 'react';

export interface TabDef {
  type: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;                  // hex from the Okabe-Ito colorblind-safe palette
  activeText: 'black' | 'white';  // pre-verified WCAG AA (>=4.5:1) text color for `color`
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
    <section className="flex-1 min-w-0 h-full flex flex-col">
      <h2 className="text-lg font-bold tracking-wide text-gray-900 dark:text-white uppercase mb-3 px-1">
        {sectionLabel}
      </h2>

      <div className="flex gap-1 overflow-x-auto no-scrollbar" role="tablist" aria-label={sectionLabel}>
        {tabs.map((tab) => {
          const isActive = tab.type === activeType;
          const Icon = tab.icon;
          const textColor = tab.activeText === 'white' ? '#FFFFFF' : '#111111';

          return (
            <button
              key={tab.type}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(tab.type)}
              // Active state is signaled by THREE independent cues, not color alone:
              // bold weight, elevation/shadow, and the solid fill. That way the
              // active tab is still identifiable if color can't be perceived.
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-t-xl text-sm whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 border-t-4 ${
                isActive
                  ? 'font-bold shadow-md relative z-10 -mb-px'
                  : 'font-semibold hover:opacity-80 relative text-gray-700 dark:text-gray-300'
              }`}
              style={
                isActive
                  ? { backgroundColor: tab.color, color: textColor, borderTopColor: tab.color, borderTopStyle: 'solid' }
                  : { backgroundColor: `${tab.color}26`, borderTopColor: 'transparent', borderTopStyle: 'solid' } // ~15% tint wash
              }
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
        className="panel-fade-in bg-white dark:bg-slate-800 rounded-b-2xl rounded-tr-2xl shadow-lg border border-gray-200 dark:border-slate-700 relative z-0 overflow-hidden flex-1 flex flex-col"
        style={{ borderTopColor: active.color, borderTopWidth: '4px', borderTopStyle: 'solid' }}
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
