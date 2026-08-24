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

// Same-hue lighten/darken so the active-tab gradient never crosses into a
// different Okabe-Ito hue. Colorblind distinguishability depends on hue, not
// lightness, so this stays exactly as safe as a flat fill while looking far
// less static.
function lighten(hex: string, t: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `#${mix(r).toString(16).padStart(2, '0')}${mix(g).toString(16).padStart(2, '0')}${mix(b).toString(16).padStart(2, '0')}`;
}

function darken(hex: string, factor: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  const scale = (c: number) => Math.round(c * factor);
  return `#${scale(r).toString(16).padStart(2, '0')}${scale(g).toString(16).padStart(2, '0')}${scale(b).toString(16).padStart(2, '0')}`;
}

// Verified via computed contrast ratios: the worst-case stop in either
// direction never drops below the already-passing base color's ratio,
// across all 7 palette colors.
function activeGradient(color: string, activeText: 'black' | 'white'): string {
  const [stopA, stopB] =
    activeText === 'black'
      ? [lighten(color, 0.32), color]   // lighter tint -> base; contrast only improves vs black text
      : [color, darken(color, 0.62)];   // base -> darker shade; contrast only improves vs white text
  return `linear-gradient(135deg, ${stopA}, ${stopB})`;
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
                    ? { backgroundImage: activeGradient(tab.color, tab.activeText), color: textColor, borderTopColor: tab.color, borderTopStyle: 'solid' }
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
