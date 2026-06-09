import { useEffect, useState } from 'react';
import type { MaterialStatus } from '../../../shared/types';
import { STATUS_LABELS } from '../../../shared/types';
import {
  AlertTriangle,
  CheckCircle2,
  GitCompareArrows,
  RefreshCw,
  Archive,
} from 'lucide-react';
import { clsx } from 'clsx';

const CARD_STYLE: Record<MaterialStatus, { bg: string; border: string; icon: string; text: string }> = {
  pending: {
    bg: 'from-amber-50 to-white',
    border: 'border-amber-200 hover:border-amber-400',
    icon: 'text-amber-600',
    text: 'text-amber-900',
  },
  normal: {
    bg: 'from-teal-50 to-white',
    border: 'border-teal-200 hover:border-teal-400',
    icon: 'text-teal-600',
    text: 'text-teal-900',
  },
  rejudged: {
    bg: 'from-blue-50 to-white',
    border: 'border-blue-200 hover:border-blue-400',
    icon: 'text-blue-600',
    text: 'text-blue-900',
  },
  changing: {
    bg: 'from-purple-50 to-white',
    border: 'border-purple-200 hover:border-purple-400',
    icon: 'text-purple-600',
    text: 'text-purple-900',
  },
  archived: {
    bg: 'from-slate-50 to-white',
    border: 'border-slate-200 hover:border-slate-400',
    icon: 'text-slate-500',
    text: 'text-slate-700',
  },
};

const STATUS_ICON: Record<MaterialStatus, React.ReactNode> = {
  pending: <AlertTriangle className="w-5 h-5" />,
  normal: <CheckCircle2 className="w-5 h-5" />,
  rejudged: <GitCompareArrows className="w-5 h-5" />,
  changing: <RefreshCw className="w-5 h-5" />,
  archived: <Archive className="w-5 h-5" />,
};

interface Props {
  stats: Record<string, number>;
  onSelectStatus?: (status: MaterialStatus | undefined) => void;
  activeStatus?: MaterialStatus | undefined;
}

function CountNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf: number;
    const duration = 600;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(eased * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span>{display}</span>;
}

export function StatsCards({ stats, onSelectStatus, activeStatus }: Props) {
  const statuses: MaterialStatus[] = ['pending', 'normal', 'rejudged', 'changing', 'archived'];
  const total = statuses.reduce((s, k) => s + (stats[k] || 0), 0);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <button
        onClick={() => onSelectStatus?.(undefined)}
        className={clsx(
          'group rounded-xl border bg-gradient-to-br from-slate-50 to-white p-4 text-left transition-all duration-200 hover:shadow-md',
          activeStatus === undefined ? 'border-slate-800 ring-2 ring-slate-300 shadow-md' : 'border-slate-200 hover:border-slate-400',
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-600">全部材料</span>
          <div className="text-slate-700">📋</div>
        </div>
        <div className="text-3xl font-bold text-slate-900" style={{ fontFamily: '"Source Han Serif SC", serif' }}>
          <CountNumber value={total} />
        </div>
      </button>
      {statuses.map((s) => {
        const style = CARD_STYLE[s];
        const count = stats[s] || 0;
        const isActive = activeStatus === s;
        return (
          <button
            key={s}
            onClick={() => onSelectStatus?.(s)}
            className={clsx(
              'group rounded-xl border bg-gradient-to-br p-4 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
              style.bg,
              isActive ? 'ring-2 ring-offset-1 shadow-md' : '',
              style.border,
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={clsx('text-sm font-medium', style.text)}>{STATUS_LABELS[s]}</span>
              <div className={style.icon}>{STATUS_ICON[s]}</div>
            </div>
            <div className={clsx('text-3xl font-bold', style.text)} style={{ fontFamily: '"Source Han Serif SC", serif' }}>
              <CountNumber value={count} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
