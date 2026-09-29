import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface TabDef {
  type: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;                  // hex from the Okabe-Ito colorblind-safe palette
  activeText: 'black' | 'white';  // pre-verified WCAG AA (>=4.5:1) text color for `color`
}

interface TabContainerProps {
  sectionLabel?: string;        // used only for the tablist's aria-label now — the visible heading moved to the page header
  tabs: TabDef[];              // rendered in current order
  activeType: string;
  onSelect: (type: string) => void;
  onReorder: (newOrderTypes: string[]) => void;
  controls?: React.ReactNode;
  children: React.ReactNode;
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
  // Drag-to-reorder state. Horizontal-only, constrained to this row — dragging
  // never crosses into the other container, and the insertion point is always
  // shown explicitly before drop so nothing jumps around unexpectedly.
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  // The tab row stays on ONE line and scrolls sideways when there are more
  // tabs than fit (News has 11), instead of wrapping a tab onto a second
  // row. Arrow buttons appear on whichever side has hidden tabs.
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const updateArrows = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateArrows) : null;
    ro?.observe(el);
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      ro?.disconnect();
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows, tabs.length]);
  // Keep the selected tab visible, e.g. after jumping to it with a shortcut.
  useEffect(() => {
    const el = rowRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [activeType]);
  const scrollBy = (dir: number) => rowRef.current?.scrollBy({ left: dir * 240, behavior: 'smooth' });

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
    <section className="flex-1 min-w-0 flex flex-col">
      <div className="relative mb-2">
      {canLeft && (
        <button
          onClick={() => scrollBy(-1)}
          aria-label="Scroll tabs left"
          className="absolute left-0 top-0 bottom-0 z-10 flex items-center pl-0.5 pr-3 bg-gradient-to-r from-zinc-50 via-zinc-50/90 to-transparent dark:from-zinc-950 dark:via-zinc-950/90 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          <ChevronLeft size={16} />
        </button>
      )}
      {canRight && (
        <button
          onClick={() => scrollBy(1)}
          aria-label="Scroll tabs right"
          className="absolute right-0 top-0 bottom-0 z-10 flex items-center pr-0.5 pl-3 bg-gradient-to-l from-zinc-50 via-zinc-50/90 to-transparent dark:from-zinc-950 dark:via-zinc-950/90 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          <ChevronRight size={16} />
        </button>
      )}
      <div
        ref={rowRef}
        className="flex flex-nowrap gap-0.5 overflow-x-auto no-scrollbar scroll-smooth"
        role="tablist"
        aria-label={sectionLabel}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {tabs.map((tab, index) => {
          const isActive = tab.type === activeType;
          const Icon = tab.icon;
          const isDragging = draggedIndex === index;

          return (
            <React.Fragment key={tab.type}>
              {dropIndex === index && (
                <div className="w-0.5 self-stretch bg-indigo-500 rounded-full flex-shrink-0" aria-hidden="true" />
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
                // weight, a background surface + shadow, and the category dot. That way
                // the active tab is still identifiable if color can't be perceived at all.
                className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[13px] whitespace-nowrap transition-all duration-150 cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-950 ${
                  isDragging ? 'opacity-40' : ''
                } ${
                  isActive
                    ? 'font-medium bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200/80 dark:ring-zinc-800'
                    : 'font-medium text-zinc-500 dark:text-zinc-500 hover:bg-zinc-100/70 dark:hover:bg-zinc-900/50 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tab.color, opacity: isActive ? 1 : 0.55 }}
                  aria-hidden="true"
                />
                <Icon size={14} className="flex-shrink-0" />
                <span>{tab.label}</span>
              </button>
            </React.Fragment>
          );
        })}
        {dropIndex === tabs.length && (
          <div className="w-0.5 self-stretch bg-indigo-500 rounded-full flex-shrink-0" aria-hidden="true" />
        )}
      </div>
      </div>

      <div
        role="tabpanel"
        className="panel-fade-in surface-card bg-white dark:bg-zinc-900 rounded-2xl relative z-0 overflow-hidden flex-1 flex flex-col"
      >
        {controls && (
          <div className="px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/30 flex items-center justify-end gap-2">
            {controls}
          </div>
        )}
        <div className="p-4 flex-1 overflow-y-auto no-scrollbar">{children}</div>
      </div>
    </section>
  );
}
