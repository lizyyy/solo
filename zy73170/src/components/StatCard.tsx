import { CircleHelp, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { StatusFilter } from '../types';
import { useSampleStore } from '../store/useSampleStore';

interface Props {
  label: string;
  value: number;
  icon: LucideIcon;
  accent: 'ink' | 'coral' | 'amber' | 'emerald';
  filterKey: StatusFilter;
  tooltip?: string;
  index: number;
}

const accentMap = {
  ink:     { ring: 'ring-ink-500/20',   text: 'text-ink-900',     bg: 'bg-ink-50',     fill: 'text-ink-600' },
  coral:   { ring: 'ring-coral-500/20',  text: 'text-coral-700',  bg: 'bg-coral-50',    fill: 'text-coral-500' },
  amber:   { ring: 'ring-amber2-500/30', text: 'text-amber2-700', bg: 'bg-amber2-50',   fill: 'text-amber2-500' },
  emerald: { ring: 'ring-emerald2-500/25', text: 'text-emerald2-700', bg: 'bg-emerald2-50', fill: 'text-emerald2-500' },
};

export default function StatCard({ label, value, icon: Icon, accent, filterKey, tooltip, index }: Props) {
  const activeFilter = useSampleStore((s) => s.ui.activeFilter);
  const setActiveFilter = useSampleStore((s) => s.setActiveFilter);
  const [tip, setTip] = useState(false);
  const a = accentMap[accent];
  const active = activeFilter === filterKey;

  return (
    <button
      onClick={() => setActiveFilter(active ? '全部' : filterKey)}
      style={{ animationDelay: `${index * 80}ms` }}
      className={`card p-4 text-left animate-fadeUp transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop relative overflow-hidden group ${
        active ? `ring-2 ${a.ring} ${a.bg}` : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1 label" onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}>
            {label}
            {tooltip && <CircleHelp className="w-3 h-3 opacity-60" />}
            {tip && tooltip && (
              <span className="absolute left-4 top-10 z-30 w-64 text-xs font-normal bg-ink-900 text-white rounded-md px-3 py-2 shadow-pop leading-relaxed pointer-events-none animate-fadeUp">
                {tooltip}
              </span>
            )}
          </div>
          <div className={`mt-1 font-display text-3xl font-semibold ${a.text}`}>
            {value}
          </div>
          <div className="mt-1 text-xs text-ink-500">
            点击{active ? '取消' : '按此筛选'}
          </div>
        </div>
        <div className={`${a.bg} ${a.fill} rounded-lg p-2 ring-1 ring-black/5`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 h-0.5 ${active ? a.bg.replace('bg-', 'bg-') : 'bg-transparent'} group-hover:opacity-80 transition-opacity`}
           style={{ background: active ? 'currentColor' : 'transparent', width: active ? '100%' : '0%' }} />
    </button>
  );
}
