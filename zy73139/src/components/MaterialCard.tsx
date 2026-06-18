import { Activity, FlaskConical, Ship } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MaterialInfo } from '@/types';

interface MaterialCardProps {
  material: MaterialInfo;
  onClick?: () => void;
}

const iconMap = {
  sensor: Activity,
  lab: FlaskConical,
  ship: Ship,
};

const statusConfig = {
  normal: {
    label: '正常',
    className: 'bg-emerald-50 text-emerald-700',
    dotClass: 'bg-emerald-500',
  },
  delayed: {
    label: '晚到',
    className: 'bg-amber-50 text-amber-700',
    dotClass: 'bg-amber-500',
  },
  updated: {
    label: '已更新',
    className: 'bg-sky-50 text-sky-700',
    dotClass: 'bg-sky-500',
  },
};

const colorMap = {
  sensor: 'from-teal-500 to-cyan-600',
  lab: 'from-blue-500 to-indigo-600',
  ship: 'from-violet-500 to-purple-600',
};

export default function MaterialCard({ material, onClick }: MaterialCardProps) {
  const Icon = iconMap[material.type];
  const status = statusConfig[material.status];
  const gradient = colorMap[material.type];

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl border border-slate-200 p-5 cursor-pointer',
        'transition-all duration-200 hover:shadow-md hover:border-slate-300',
        'group'
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={cn(
            'w-11 h-11 rounded-lg bg-gradient-to-br flex items-center justify-center',
            gradient
          )}
        >
          <Icon className="w-5.5 h-5.5 text-white" />
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
            status.className
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', status.dotClass)} />
          {status.label}
        </span>
      </div>

      <h3 className="text-base font-semibold text-slate-800 mb-1">
        {material.name}
      </h3>
      <p className="text-sm text-slate-500 mb-4">共 {material.recordCount.toLocaleString()} 条记录</p>

      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">更新时间</span>
        <span className="text-slate-600 font-medium">{material.updateTime}</span>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-400">查看详情</span>
        <span className="text-sky-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
          →
        </span>
      </div>
    </div>
  );
}
