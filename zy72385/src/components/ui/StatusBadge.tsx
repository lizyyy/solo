import React from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-slate-700/60', text: 'text-slate-300', label: '草稿' },
  pending_review: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: '待复核' },
  reviewing: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: '复核中' },
  completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: '已完成' },
  pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: '待处理' },
  processing: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: '处理中' },
  processed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: '已处理' },
  duplicate: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: '重复' },
  resolved: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: '已解决' },
  rejected: { bg: 'bg-red-500/20', text: 'text-red-400', label: '已驳回' },
  error: { bg: 'bg-red-500/20', text: 'text-red-400', label: '错误' },
  low: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: '低风险' },
  medium: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: '中风险' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: '高风险' },
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', label: '严重' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const config = statusConfig[status] || { bg: 'bg-slate-700', text: 'text-slate-400', label: status };
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span className={cn('inline-flex items-center rounded-md font-medium', config.bg, config.text, sizeClass)}>
      <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', config.text.replace('text-', 'bg-'))} />
      {config.label}
    </span>
  );
};
