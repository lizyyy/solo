import React from 'react';
import { cn } from '@/lib/utils';
import type { ErrorType, Grade } from '@/types/music';
import { getGradeBg, getGradeColor } from '@/engine/gameEngine';
import { getErrorTypeBg, getErrorTypeColor } from '@/utils/playback';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'gold';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'default',
  ...props
}) => {
  const variants = {
    default: 'bg-jazz-bgLight text-jazz-text border border-jazz-border',
    success: 'bg-jazz-green/20 text-jazz-greenLight border border-jazz-green/50',
    warning: 'bg-jazz-orange/20 text-jazz-orangeLight border border-jazz-orange/50',
    error: 'bg-jazz-burgundy/20 text-jazz-burgundyLight border border-jazz-burgundy/50',
    info: 'bg-blue-500/20 text-blue-400 border border-blue-500/50',
    gold: 'bg-jazz-gold/20 text-jazz-gold border border-jazz-gold/50',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

interface GradeBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  grade: Grade;
  showLabel?: boolean;
  large?: boolean;
}

export const GradeBadge: React.FC<GradeBadgeProps> = ({ grade, showLabel = false, large = false, className, ...props }) => {
  const labels: Record<Grade, string> = {
    S: '卓越',
    A: '优秀',
    B: '良好',
    C: '及格',
    D: '需努力',
    F: '不及格',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-bold',
        large ? 'w-16 h-16 text-3xl' : 'w-12 h-12 text-xl',
        getGradeBg(grade),
        'text-white shadow-lg',
        className
      )}
      {...props}
    >
      {grade}
      {showLabel && (
        <span className={cn('ml-2 text-sm font-normal', getGradeColor(grade))}>
          {labels[grade]}
        </span>
      )}
    </span>
  );
};

interface ErrorTypeBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  type: ErrorType;
  showIcon?: boolean;
  count?: number;
}

export const ErrorTypeBadge: React.FC<ErrorTypeBadgeProps> = ({ type, showIcon = true, count, className, ...props }) => {
  const labels: Record<ErrorType, string> = {
    data: '数据问题',
    rule: '规则问题',
    material: '材料问题',
  };

  const icons: Record<ErrorType, string> = {
    data: '⚠️',
    rule: '🚫',
    material: '📦',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium border',
        getErrorTypeBg(type),
        getErrorTypeColor(type),
        className
      )}
      {...props}
    >
      {showIcon && <span className="mr-1">{icons[type]}</span>}
      {labels[type]}
      {count !== undefined && (
        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-black/20 text-xs">
          {count}
        </span>
      )}
    </span>
  );
};
