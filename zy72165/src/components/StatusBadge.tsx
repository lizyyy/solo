import { cn } from '@/lib/utils';
import type { PointStatus, PointSource, SchemeStatus, ConflictType } from '../types';

interface StatusBadgeProps {
  type: 'point' | 'source' | 'scheme' | 'conflict';
  value: string;
}

const statusConfig: Record<PointStatus, { label: string; className: string }> = {
  pending: { label: '待处理', className: 'bg-amber-100 text-amber-700' },
  processing: { label: '处理中', className: 'bg-blue-100 text-blue-700' },
  conflict: { label: '有冲突', className: 'bg-red-100 text-red-700' },
  completed: { label: '已完成', className: 'bg-emerald-100 text-emerald-700' },
};

const sourceConfig: Record<PointSource, { label: string; className: string }> = {
  street: { label: '街道表格', className: 'bg-slate-100 text-slate-700' },
  onsite: { label: '现场巡检', className: 'bg-purple-100 text-purple-700' },
  approval: { label: '审批记录', className: 'bg-indigo-100 text-indigo-700' },
  other: { label: '其他来源', className: 'bg-gray-100 text-gray-700' },
};

const schemeConfig: Record<SchemeStatus, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-slate-100 text-slate-600' },
  submitted: { label: '已提交', className: 'bg-blue-100 text-blue-700' },
  approved: { label: '已批准', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '已驳回', className: 'bg-red-100 text-red-700' },
};

const conflictConfig: Record<ConflictType, { label: string; className: string }> = {
  data_mismatch: { label: '数据不一致', className: 'bg-orange-100 text-orange-700' },
  scheme_override: { label: '方案覆盖', className: 'bg-red-100 text-red-700' },
  note_conflict: { label: '备注冲突', className: 'bg-yellow-100 text-yellow-700' },
};

const StatusBadge = ({ type, value }: StatusBadgeProps) => {
  let config;
  
  switch (type) {
    case 'point':
      config = statusConfig[value as PointStatus];
      break;
    case 'source':
      config = sourceConfig[value as PointSource];
      break;
    case 'scheme':
      config = schemeConfig[value as SchemeStatus];
      break;
    case 'conflict':
      config = conflictConfig[value as ConflictType];
      break;
    default:
      config = { label: value, className: 'bg-gray-100 text-gray-700' };
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className
      )}
    >
      {config.label}
    </span>
  );
};

export default StatusBadge;
