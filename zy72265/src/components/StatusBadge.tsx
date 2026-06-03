import type { ProcessingStatus, CoordinateType, RadiusSource } from '../../shared/types';
import { STATUS_LABELS, STATUS_COLORS, COORDINATE_TYPE_LABELS, COORDINATE_TYPE_COLORS, RADIUS_SOURCE_LABELS, RADIUS_SOURCE_COLORS } from '../../shared/utils/formatters';
import { cn } from '../lib/utils';

interface StatusBadgeProps {
  status: ProcessingStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  return (
    <span className={cn('inline-flex items-center rounded-sm font-medium', STATUS_COLORS[status], sizeClasses)}>
      {STATUS_LABELS[status]}
    </span>
  );
}

interface CoordinateTypeBadgeProps {
  type: CoordinateType;
  showIcon?: boolean;
}

export function CoordinateTypeBadge({ type, showIcon = false }: CoordinateTypeBadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium', COORDINATE_TYPE_COLORS[type])}>
      {showIcon && type === 'MIXED' && (
        <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      )}
      {COORDINATE_TYPE_LABELS[type]}
    </span>
  );
}

interface RadiusSourceBadgeProps {
  source: NonNullable<RadiusSource>;
}

export function RadiusSourceBadge({ source }: RadiusSourceBadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium', RADIUS_SOURCE_COLORS[source])}>
      {RADIUS_SOURCE_LABELS[source]}
    </span>
  );
}
