import React from 'react';
import type { RouteStatus, VersionStatus } from '../../shared/types';

interface StatusBadgeProps {
  status: RouteStatus | VersionStatus;
  label?: string;
}

const statusStyles: Record<string, string> = {
  normal: 'bg-green-100 text-green-800 border-green-300',
  gap_pending_review: 'bg-warning-100 text-warning-800 border-warning-400 animate-pulse',
  deleted: 'bg-gray-100 text-gray-600 border-gray-300 line-through',
  supplement_pending_recalc: 'bg-blue-100 text-blue-800 border-blue-300',
  draft: 'bg-gray-100 text-gray-600 border-gray-300',
  pending_review: 'bg-warning-100 text-warning-800 border-warning-400',
  published: 'bg-green-100 text-green-800 border-green-300',
};

const statusLabels: Record<string, string> = {
  normal: '正常',
  gap_pending_review: '编号断档-待复核',
  deleted: '已删除',
  supplement_pending_recalc: '补录待重算',
  draft: '草稿',
  pending_review: '待复核',
  published: '已发布',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border-2 ${statusStyles[status] || 'bg-gray-100 text-gray-800 border-gray-300'}`}
    >
      {label || statusLabels[status] || status}
    </span>
  );
};
