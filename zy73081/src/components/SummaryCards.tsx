import { Activity, CheckCircle2, AlertTriangle, Edit3, MapPinOff } from 'lucide-react';
import type { SummaryData } from '@/types';
import type { LucideIcon } from 'lucide-react';

interface Props {
  data: SummaryData;
  onJump: (key: 'offset' | 'passed' | 'pending' | 'manual') => void;
}

type CardKey = 'total' | 'passed' | 'pending' | 'manual' | 'offset';
type SummaryField = keyof SummaryData;

interface CardConfigItem {
  key: CardKey;
  label: string;
  field: SummaryField;
  icon: LucideIcon;
  accent: string;
  textC: string;
  border: string;
  clickable?: boolean;
  pulse?: boolean;
}

const CARD_CONFIG: CardConfigItem[] = [
  {
    key: 'total', label: '总碰撞数', field: 'total' as const,
    icon: Activity, accent: 'from-brand-500 to-brand-700', textC: 'text-brand-600',
    border: 'border-brand-500/20',
  },
  {
    key: 'passed', label: '已放行', field: 'passed' as const,
    icon: CheckCircle2, accent: 'from-status-passed to-emerald-600', textC: 'text-status-passed',
    border: 'border-status-passed/20', clickable: true,
  },
  {
    key: 'pending', label: '待补证据', field: 'pendingEvidence' as const,
    icon: AlertTriangle, accent: 'from-status-pending to-amber-600', textC: 'text-status-pending',
    border: 'border-status-pending/20', clickable: true,
  },
  {
    key: 'manual', label: '人工改过', field: 'manualRejudged' as const,
    icon: Edit3, accent: 'from-status-manual to-violet-600', textC: 'text-status-manual',
    border: 'border-status-manual/20', clickable: true,
  },
  {
    key: 'offset', label: '坐标偏移异常', field: 'coordinateOffset' as const,
    icon: MapPinOff, accent: 'from-status-rejected to-rose-600', textC: 'text-status-rejected',
    border: 'border-status-rejected/40', pulse: true, clickable: true,
  },
];

export function SummaryCards({ data, onJump }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {CARD_CONFIG.map((c) => {
        const Icon = c.icon;
        const value = data[c.field];
        const isClickable = !!c.clickable;
        return (
          <button
            key={c.key}
            onClick={isClickable ? () => onJump(c.key as Parameters<typeof onJump>[0]) : undefined}
            className={`group relative overflow-hidden bg-white rounded-lg border ${c.border} p-5 text-left transition-all
              ${isClickable ? 'hover:-translate-y-0.5 hover:shadow-lg cursor-pointer' : 'cursor-default'}`}
          >
            <div
              className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${c.accent} opacity-10 group-hover:opacity-20 transition-opacity`}
            />
            <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${c.accent} ${c.pulse ? 'animate-pulse-soft' : ''}`} />
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${c.accent} flex items-center justify-center`}>
                <Icon className="w-5 h-5 text-white" strokeWidth={2.2} />
              </div>
              {c.pulse && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-status-rejected/10 text-status-rejected border border-status-rejected/30">
                  ⚠ 异常
                </span>
              )}
            </div>
            <div className={`text-3xl font-bold tnum ${c.textC} mb-1`}>{value}</div>
            <div className="text-xs text-slate-500 font-medium">{c.label}</div>
            {isClickable && (
              <div className="mt-2 text-[11px] text-slate-400 group-hover:text-brand-500 transition-colors">
                点击筛选 →
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
