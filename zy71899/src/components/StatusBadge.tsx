import React from 'react';
import type { ThresholdLevel, MaintenanceStatus, AnalysisStatus } from '@/types';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Loader2,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  type: 'threshold' | 'maintenance' | 'analysis' | 'custom';
  level?: ThresholdLevel;
  status?: MaintenanceStatus | AnalysisStatus;
  label?: string;
  color?: 'green' | 'orange' | 'red' | 'blue' | 'purple';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  type,
  level,
  status,
  label,
  color,
  className,
}) => {
  let icon: React.ReactNode = null;
  let bgColor = '';
  let textColor = '';
  let displayLabel = label || '';
  let pulse = false;

  if (type === 'threshold' && level) {
    const config = {
      normal: { icon: CheckCircle2, color: 'green', label: '正常' },
      warning: { icon: AlertTriangle, color: 'orange', label: '警戒' },
      danger: { icon: XCircle, color: 'red', label: '危险' },
    }[level];
    icon = <config.icon className="w-3 h-3" />;
    color = config.color as StatusBadgeProps['color'];
    displayLabel = config.label;
    if (level !== 'normal') pulse = true;
  }

  if (type === 'maintenance' && status) {
    const config = {
      pending: { icon: Clock, color: 'orange', label: '待处理' },
      in_progress: { icon: Wrench, color: 'blue', label: '处理中', pulse: true },
      completed: { icon: CheckCircle2, color: 'green', label: '已完成' },
    }[status as MaintenanceStatus];
    icon = <config.icon className="w-3 h-3" />;
    color = config.color as StatusBadgeProps['color'];
    displayLabel = config.label;
    pulse = (config as { pulse?: boolean }).pulse || false;
  }

  if (type === 'analysis' && status) {
    const config = {
      pending: { icon: Clock, color: 'orange', label: '待分析' },
      running: { icon: Loader2, color: 'blue', label: '分析中', pulse: true },
      completed: { icon: CheckCircle2, color: 'green', label: '已完成' },
      failed: { icon: XCircle, color: 'red', label: '失败' },
    }[status as AnalysisStatus];
    icon = <config.icon className={`w-3 h-3 ${(config as { pulse?: boolean }).pulse ? 'animate-spin' : ''}`} />;
    color = config.color as StatusBadgeProps['color'];
    displayLabel = config.label;
    pulse = (config as { pulse?: boolean }).pulse || false;
  }

  const colorClasses = {
    green: { bg: 'bg-signal-green/20', text: 'text-signal-green' },
    orange: { bg: 'bg-alert-orange/20', text: 'text-alert-orange' },
    red: { bg: 'bg-danger-red/20', text: 'text-danger-red' },
    blue: { bg: 'bg-tech-blue/20', text: 'text-tech-blue' },
    purple: { bg: 'bg-data-purple/20', text: 'text-data-purple' },
  }[color || 'green'];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium',
        colorClasses.bg,
        colorClasses.text,
        pulse && 'animate-pulse-slow',
        className
      )}
    >
      {icon}
      <span>{displayLabel}</span>
    </span>
  );
};

interface StatusIndicatorProps {
  active?: boolean;
  color: 'green' | 'orange' | 'red' | 'blue';
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  active = false,
  color,
  className,
}) => {
  const colorClass = {
    green: 'bg-signal-green',
    orange: 'bg-alert-orange',
    red: 'bg-danger-red',
    blue: 'bg-tech-blue',
  }[color];

  const glowClass = {
    green: 'shadow-glow-green',
    orange: 'shadow-glow-orange',
    red: 'shadow-glow-red',
    blue: 'shadow-glow-blue',
  }[color];

  return (
    <span
      className={cn(
        'status-indicator',
        colorClass,
        active && `active ${glowClass}`,
        className
      )}
    />
  );
};
