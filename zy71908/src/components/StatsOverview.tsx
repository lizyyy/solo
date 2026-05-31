import React from 'react';
import type { StatsOverview } from '../types';
import { FilePlus, Copy, AlertTriangle, FileText } from 'lucide-react';

interface StatsOverviewProps {
  stats: StatsOverview;
}

const statCards = [
  {
    key: 'todayNew' as const,
    label: '今日新增',
    icon: FilePlus,
    color: 'primary' as const,
    bgClass: 'bg-primary-50',
    iconClass: 'text-primary-500',
    textClass: 'text-primary-700',
  },
  {
    key: 'pendingDuplicates' as const,
    label: '待处理重复',
    icon: Copy,
    color: 'warning' as const,
    bgClass: 'bg-warning-50',
    iconClass: 'text-warning-500',
    textClass: 'text-warning-700',
  },
  {
    key: 'transpositionMismatches' as const,
    label: '转调未同步',
    icon: AlertTriangle,
    color: 'danger' as const,
    bgClass: 'bg-danger-50',
    iconClass: 'text-danger-500',
    textClass: 'text-danger-700',
  },
  {
    key: 'supplementsCount' as const,
    label: '补材料',
    icon: FileText,
    color: 'neutral' as const,
    bgClass: 'bg-neutral-100',
    iconClass: 'text-neutral-500',
    textClass: 'text-neutral-700',
  },
];

export function StatsOverviewBar({ stats }: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {statCards.map(card => {
        const Icon = card.icon;
        const value = stats[card.key];
        return (
          <div
            key={card.key}
            className={`${card.bgClass} rounded-xl p-4 border border-transparent transition-all hover:shadow-sm`}
          >
            <div className="flex items-center gap-3">
              <div className={`${card.iconClass}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className={`text-2xl font-bold ${card.textClass}`}>{value}</div>
                <div className="text-xs text-neutral-500 mt-0.5">{card.label}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
