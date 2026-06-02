import { CheckCircle, XCircle, AlertCircle, HelpCircle } from 'lucide-react';
import type { JudgmentType } from '../types';
import { cn } from '../lib/utils';

interface JudgmentBadgeProps {
  judgment: JudgmentType;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

export function JudgmentBadge({ judgment, size = 'md', showIcon = true }: JudgmentBadgeProps) {
  const configs: Record<JudgmentType, {
    label: string;
    icon: React.ElementType;
    className: string;
  }> = {
    correct: {
      label: '正确',
      icon: CheckCircle,
      className: 'bg-accent-emerald-50 text-accent-emerald-700 border-accent-emerald-200',
    },
    incorrect: {
      label: '错误',
      icon: XCircle,
      className: 'bg-accent-rose-50 text-accent-rose-700 border-accent-rose-200',
    },
    partial: {
      label: '部分正确',
      icon: AlertCircle,
      className: 'bg-accent-amber-50 text-accent-amber-700 border-accent-amber-200',
    },
    unverified: {
      label: '未验证',
      icon: HelpCircle,
      className: 'bg-slate-50 text-slate-600 border-slate-200',
    },
  };

  const config = configs[judgment];
  const Icon = config.icon;

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs gap-1'
    : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <span className={cn(
      'inline-flex items-center font-medium rounded-md border',
      sizeClasses,
      config.className
    )}>
      {showIcon && <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      {config.label}
    </span>
  );
}
