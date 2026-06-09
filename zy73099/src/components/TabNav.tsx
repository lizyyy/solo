import * as React from 'react';
import type { StatusFilter, SummaryStats } from '@/types';
import { cn } from '@/lib/utils';

const TABS: { key: StatusFilter; label: string; statKey: keyof SummaryStats | 'total' }[] = [
  { key: 'all', label: '全部', statKey: 'total' },
  { key: 'pending', label: '待确认', statKey: 'pending' },
  { key: 'confirmed', label: '已确认', statKey: 'confirmed' },
  { key: 'awaiting_patch', label: '待补件', statKey: 'awaitingPatch' },
  { key: 'reverted', label: '已退回', statKey: 'reverted' },
];

export function TabNav({
  active,
  onChange,
  summary,
}: {
  active: StatusFilter;
  onChange: (key: StatusFilter) => void;
  summary: SummaryStats;
}) {
  const indicatorRef = React.useRef<HTMLDivElement>(null);
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  React.useEffect(() => {
    const el = tabRefs.current[active];
    const indicator = indicatorRef.current;
    if (el && indicator) {
      indicator.style.width = `${el.offsetWidth}px`;
      indicator.style.transform = `translateX(${el.offsetLeft}px)`;
    }
  }, [active, summary]);

  const getStat = (k: string): number => {
    if (k === 'total') return summary.total;
    return summary[k as keyof SummaryStats] || 0;
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-0.5">
        {TABS.map((t) => {
          const count = getStat(t.statKey);
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              ref={(el) => { tabRefs.current[t.key] = el; }}
              onClick={() => onChange(t.key)}
              className={cn(
                'relative flex-none inline-flex items-center gap-1.5 rounded-t-lg px-4 py-3 text-sm font-medium transition-all',
                isActive
                  ? 'text-orange-700'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              )}
            >
              <span>{t.label}</span>
              <span
                className={cn(
                  'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10.5px] font-semibold tabular-nums transition',
                  isActive
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
      <div
        ref={indicatorRef}
        className="absolute bottom-0 left-0 h-[3px] rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-200 ease-out"
        style={{ width: 0, transform: 'translateX(0)' }}
      />
    </div>
  );
}
