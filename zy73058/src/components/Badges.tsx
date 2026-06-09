import type { ReviewStatus, ChangeType } from '@/types';
import { CheckCircle, Clock, XCircle, Tag, AlertTriangle, Edit3 } from 'lucide-react';

const statusConfig: Record<ReviewStatus, { label: string; cls: string; Icon: typeof CheckCircle }> = {
  confirmed: {
    label: '已确认',
    cls: 'bg-emerald-50 text-emerald-800 border-emerald-600',
    Icon: CheckCircle,
  },
  pending: {
    label: '待补件',
    cls: 'bg-amber-50 text-amber-800 border-amber-600',
    Icon: Clock,
  },
  rejected: {
    label: '退回',
    cls: 'bg-red-50 text-red-800 border-red-600',
    Icon: XCircle,
  },
};

export function StatusBadge({ status }: { status: ReviewStatus }) {
  const { label, cls, Icon } = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded text-xs font-semibold ${cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

const changeConfig: Record<ChangeType, { label: string; cls: string; Icon: typeof Tag }> = {
  rename: { label: '备件改名', cls: 'bg-sky-50 text-sky-800 border-sky-500', Icon: Tag },
  threshold: { label: '阈值调整', cls: 'bg-orange-50 text-orange-800 border-orange-500', Icon: AlertTriangle },
  supplement: { label: '补录字段', cls: 'bg-violet-50 text-violet-800 border-violet-500', Icon: Edit3 },
  none: { label: '无变更', cls: 'bg-zinc-50 text-zinc-700 border-zinc-400', Icon: Tag },
};

export function ChangeTypeBadge({ type }: { type: ChangeType }) {
  const { label, cls, Icon } = changeConfig[type];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded text-[11px] font-medium ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
