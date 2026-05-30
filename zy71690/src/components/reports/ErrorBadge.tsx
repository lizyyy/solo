import React from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowDownToLine, Zap } from 'lucide-react';
import type { ErrorType } from '@/types';
import { ERROR_TYPE_LABELS, ERROR_TYPE_COLORS } from '@/types';

interface ErrorBadgeProps {
  type: ErrorType;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const ERROR_ICONS: Record<ErrorType, React.ReactNode> = {
  gravity_direction: <ArrowDownToLine size={12} />,
  velocity_overflow: <Zap size={12} />,
  collision_miss: <AlertTriangle size={12} />,
};

export const ErrorBadge: React.FC<ErrorBadgeProps> = ({
  type,
  showLabel = true,
  size = 'md',
  className,
}) => {
  const color = ERROR_TYPE_COLORS[type];
  const label = ERROR_TYPE_LABELS[type];
  const icon = ERROR_ICONS[type];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono',
        size === 'sm' ? 'text-[10px]' : 'text-xs',
        className
      )}
      style={{
        backgroundColor: `${color}20`,
        color: color,
        border: `1px solid ${color}40`,
      }}
    >
      {icon}
      {showLabel && <span>{label}</span>}
    </span>
  );
};
