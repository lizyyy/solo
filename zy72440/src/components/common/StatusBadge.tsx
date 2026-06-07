import { CheckCircle, AlertTriangle, RefreshCw, Circle } from 'lucide-react';
import type { RecordStatus } from '@/types';

interface StatusBadgeProps {
  status: RecordStatus;
}

const statusConfig = {
  normal: {
    label: '正常',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    icon: CheckCircle
  },
  pending_review: {
    label: '待店长复核',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    icon: AlertTriangle
  },
  supplementary: {
    label: '补录返工',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
    icon: RefreshCw
  },
  completed: {
    label: '已完成',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-600',
    borderColor: 'border-slate-200',
    icon: Circle
  }
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}
