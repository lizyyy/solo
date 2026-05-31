import React from 'react';
import clsx from 'clsx';

interface StatusBadgeProps {
  status: 'normal' | 'pending_confirmation' | 'replaced' | 'warning' | 'danger' | 'info' | 'needs_confirmation' | 'material_only' | 'conclusion_changed' | 'draft' | 'pending_review' | 'approved' | 'rejected';
  children: React.ReactNode;
}

const statusMap: Record<string, string> = {
  normal: 'status-normal',
  pending_confirmation: 'status-pending',
  replaced: 'status-warning',
  warning: 'status-warning',
  danger: 'status-danger',
  info: 'status-info',
  needs_confirmation: 'status-danger',
  material_only: 'status-normal',
  conclusion_changed: 'status-warning',
  draft: 'status-info',
  pending_review: 'status-pending',
  approved: 'status-normal',
  rejected: 'status-danger',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, children }) => {
  return (
    <span className={clsx('status-badge', statusMap[status] || 'status-info')}>
      {children}
    </span>
  );
};
