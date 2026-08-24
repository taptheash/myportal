import React, { useState, useRef } from 'react';

export interface TabDef {
  type: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;                  // hex from the Okabe-Ito colorblind-safe palette
  activeText: 'black' | 'white';  // pre-verified WCAG AA (>=4.5:1) text color for `color`
}

interface TabContainerProps {
  sectionLabel: string;
  tabs: TabDef[];              // rendered in current order
  activeType: string;
  onSelect: (type: string) => void;
  onReorder: (newOrderTypes: string[]) => void;
  controls?: React.ReactNode;
  children: React.ReactNode;
}

// Precomputed & WCAG-verified per-color 3-stop gradient endpoints (light tint
// -> vivid base -> rich dark shade). Baked in rather than computed from a
// shared formula because safe darken/lighten headroom differs a lot by hue —
// vermillion is already dark and has almost no safe room to darken further,
// while yellow starts bright and has plenty. Each triple's worst-case
// contrast against its assigned text color was verified >= 4.5:1 (WCAG AA).
const GRADIENT_STOPS: Record<string, { light: string; dark: string }> = {
  '#E69F00': { light: '#EDBB4C', dark: '#AE7800' }, // orange
  '#56B4E9': { light: '#88CAEF', dark: '#428AB3' }, // sky blue
  '#009E73': { light: '#4CBB9D', dark: '#00946C' }, // bluish green
  '#F0E442': { light: '#F4EC7A', dark: '#908827' }, // yellow
  '#0072B2': { light: '#0C79B5', dark: '#003E61' }, // blue (white text)
  '#D55E00': { light: '#E18E4C', dark: '#D55E00' }, // vermillion — negligible safe darken room
  '#CC79A7': { light: '#DBA1C1', dark: '#B56B94' }, // reddish purple
};

function activeGradient(color: string): string {
  const stops = GRADIENT_STOPS[color];
  if (!stops) return color; // safety net if an unlisted color ever shows up
  return `linear-gradient(135deg, ${stops.light}, ${color}, ${stops.dark})`;
}

export default function TabContainer({
  sectionLabel,
  tabs,
  activeType,
  onSelect,
  onReorder,
  controls,
  children,
}: TabContainerProps) {
  const active = tabs.find((t) => t.type === activeType) ?? tabs[0];

  // Drag-to-reorder state. Horizontal-only, constrained to this row — dragging
  // never crosses into the other container, and the insertion point is always
  // shown explicitly before drop so nothing jumps around unexpectedly.
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const commitReorder = (from: number, to: number) => {
    if (from === to) return;
    const order = tabs.map((t) => t.type);
    const [moved] = order.splice(from, 1);
    const insertAt = from < to ? to - 1 : to;
    order.splice(insertAt, 0, moved);
    onReorder(order);
  };

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires data to be set for drag to initiate at all.
    e.dataTransfer.setData('text/plain', tabs[index].type);
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const overLeftHalf = e.clientX < rect.left + rect.width / 2;
    const target = overLeftHalf ? index : index + 1;
    if (target !== draggedIndex && target !== draggedIndex + 1) {
      setDropIndex(target);
    } else {
      setDropIndex(null); // dropping right where it already is — no-op, no indicator
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex !== null && dropIndex !== null) {
      commitReorder(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropIndex(null);
  };

  // Keyboard fallback: with a tab focused, Alt+ArrowLeft/Right moves it one
  // position. Drag alone would leave keyboard users with no way to reorder.
  const handleKeyDown = (index: number) => (e: React.KeyboardEvent) => {
    if (!e.altKey) return;
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      commitReorder(index, index - 1);
    } else if (e.key === 'ArrowRight' && index < tabs.length - 1) {
      e.preventDefault();
      commitReorder(index, index + 2);
    }
  };

  return (
    <section className="flex-1 min-w-0 h-full flex flex-col">
      <h2 className="text-lg font-bold tracking-wide text-gray-900 dark:text-white uppercase mb-3 px-1">
        {sectionLabel}
      </h2>

      <div
        ref={rowRef}
        className="flex gap-1 overflow-x-auto no-scrollbar"
        role="tablist"
        aria-label={sectionLabel}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {tabs.map((tab, index) => {
          const isActive = tab.type === activeType;
          const Icon = tab.icon;
          const textColor = tab.activeText === 'white' ? '#FFFFFF' : '#111111';
          const isDragging = draggedIndex === index;

          return (
            <React.Fragment key={tab.type}>
              {dropIndex === index && (
                <div className="w-0.5 self-stretch bg-blue-500 rounded-full flex-shrink-0" aria-hidden="true" />
              )}
              <button
                role="tab"
                aria-selected={isActive}
                draggable
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver(index)}
                onDragEnd={handleDragEnd}
                onKeyDown={handleKeyDown(index)}
                onClick={() => onSelect(tab.type)}
                title={`${tab.label} — drag to reorder, or focus and use Alt+Left/Right`}
                // Active state is signaled by THREE independent cues, not color alone:
                // bold weight, elevation/shadow, and the fill. That way the active tab
                // is still identifiable if color can't be perceived at all.
                className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-t-xl text-sm whitespace-nowrap transition-all cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 border-t-4 ${
                  isDragging ? 'opacity-40' : ''
                } ${
                  isActive
                    ? 'font-bold shadow-md relative z-10 -mb-px'
                    : 'font-semibold hover:opacity-80 relative text-gray-700 dark:text-gray-300'
                }`}
                style={
                  isActive
                    ? { backgroundImage: activeGradient(tab.color), color: textColor, borderTopColor: tab.color, borderTopStyle: 'solid', boxShadow: `0 4px 14px ${tab.color}4D` }
                    : { backgroundColor: `${tab.color}26`, borderTopColor: 'transparent', borderTopStyle: 'solid' } // ~15% tint wash
                }
              >
                <Icon size={15} className="flex-shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            </React.Fragment>
          );
        })}
        {dropIndex === tabs.length && (
          <div className="w-0.5 self-stretch bg-blue-500 rounded-full flex-shrink-0" aria-hidden="true" />
        )}
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
