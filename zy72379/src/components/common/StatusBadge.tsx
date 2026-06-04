import React from 'react';
import { CheckCircle, AlertTriangle, FileText, Clock, XCircle } from 'lucide-react';
import type { RecordStatus, ConflictResolutionStatus, ThresholdReviewStatus } from '@/types';
import { getRecordStatusDescription } from '@/utils/dataCleaner';
import { getResolutionStatusDescription } from '@/utils/conflictDetector';

interface StatusBadgeProps {
  status: RecordStatus | ConflictResolutionStatus | ThresholdReviewStatus;
  type?: 'record' | 'conflict' | 'review';
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { bg: string; text: string; border: string; icon: React.ElementType; pulse?: boolean }> = {
  normal: { bg: 'bg-success-50', text: 'text-success-700', border: 'border-success-200', icon: CheckCircle },
  over_threshold: { bg: 'bg-danger-50', text: 'text-danger-700', border: 'border-danger-200', icon: AlertTriangle },
  supplemented: { bg: 'bg-primary-50', text: 'text-primary-700', border: 'border-primary-200', icon: FileText },
  pending_review: { bg: 'bg-warning-50', text: 'text-warning-700', border: 'border-warning-300', icon: Clock, pulse: true },
  conflict: { bg: 'bg-danger-50', text: 'text-danger-700', border: 'border-danger-300', icon: XCircle, pulse: true },
  pending: { bg: 'bg-warning-50', text: 'text-warning-700', border: 'border-warning-300', icon: Clock, pulse: true },
  accept_photo: { bg: 'bg-success-50', text: 'text-success-700', border: 'border-success-200', icon: CheckCircle },
  accept_note: { bg: 'bg-success-50', text: 'text-success-700', border: 'border-success-200', icon: CheckCircle },
  rejected: { bg: 'bg-danger-50', text: 'text-danger-700', border: 'border-danger-200', icon: XCircle },
  equipment_fixed: { bg: 'bg-success-50', text: 'text-success-700', border: 'border-success-200', icon: CheckCircle },
  data_abnormal: { bg: 'bg-danger-50', text: 'text-danger-700', border: 'border-danger-200', icon: AlertTriangle },
  further_check: { bg: 'bg-primary-50', text: 'text-primary-700', border: 'border-primary-200', icon: FileText },
};

const getStatusLabel = (status: string, type?: string): string => {
  if (type === 'record') return getRecordStatusDescription(status);
  if (type === 'conflict' || type === 'review') return getResolutionStatusDescription(status as ConflictResolutionStatus);
  return getRecordStatusDescription(status);
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'record', size = 'md' }) => {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;
  const label = getStatusLabel(status, type);

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border font-medium ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${config.pulse ? 'animate-breathing' : ''}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      <span>{label}</span>
    </span>
  );
};
