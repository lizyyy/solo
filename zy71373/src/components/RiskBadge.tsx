import { AlertTriangle, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import type { RiskLevel } from '../types';

interface RiskBadgeProps {
  level: RiskLevel;
  size?: 'sm' | 'md';
}

export function RiskBadge({ level, size = 'md' }: RiskBadgeProps) {
  const configs: Record<RiskLevel, { bg: string; text: string; border: string; icon: typeof AlertTriangle; label: string }> = {
    high: {
      bg: 'bg-[rgba(229,57,53,0.15)]',
      text: 'text-[#E53935]',
      border: 'border border-[#E53935]',
      icon: AlertTriangle,
      label: '高风险'
    },
    medium: {
      bg: 'bg-[rgba(251,140,0,0.15)]',
      text: 'text-[#FB8C00]',
      border: 'border border-[#FB8C00]',
      icon: AlertCircle,
      label: '中风险'
    },
    low: {
      bg: 'bg-[rgba(67,160,71,0.15)]',
      text: 'text-[#43A047]',
      border: 'border border-[#43A047]',
      icon: CheckCircle2,
      label: '低风险'
    },
    pending: {
      bg: 'bg-[rgba(158,158,158,0.1)]',
      text: 'text-[#757575]',
      border: 'border border-dashed border-[#9E9E9E]',
      icon: Clock,
      label: '待确认'
    }
  };

  const config = configs[level];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5'
  };

  return (
    <span
      className={`inline-flex items-center ${sizeClasses[size]} rounded-md font-medium ${config.bg} ${config.text} ${config.border}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      {config.label}
    </span>
  );
}
