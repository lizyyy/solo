import { CheckCircle2, AlertTriangle, XCircle, FileText } from 'lucide-react';
import type { ScheduleStatus } from '@/types/schedule';

interface StatusBadgeProps {
  status: ScheduleStatus;
  size?: 'sm' | 'md';
}

const statusConfig = {
  confirmed: {
    icon: CheckCircle2,
    bg: 'bg-green-50',
    text: 'text-success',
    label: '已确认',
  },
  pending: {
    icon: AlertTriangle,
    bg: 'bg-orange-50',
    text: 'text-warning',
    label: '待审核',
  },
  withdrawn: {
    icon: XCircle,
    bg: 'bg-gray-100',
    text: 'text-gray-500',
    label: '已撤回',
  },
  draft: {
    icon: FileText,
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    label: '草稿',
  },
};

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-0.5';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ${config.bg} ${config.text} ${textSize} ${padding} font-medium`}>
      <Icon size={14} strokeWidth={2} />
      {config.label}
    </span>
  );
}
