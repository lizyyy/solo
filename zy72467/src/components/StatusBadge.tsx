import React from 'react';
import type { RecordStatus } from '../../shared/types';

interface StatusBadgeProps {
  status: RecordStatus;
}

const statusConfig: Record<RecordStatus, { label: string; className: string }> = {
  normal: {
    label: '正常',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  pending_review: {
    label: '待复核',
    className: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  conflict: {
    label: '冲突',
    className: 'bg-red-100 text-red-700 border-red-200',
  },
  archived: {
    label: '已归档',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status] || statusConfig.normal;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
      {config.label}
    </span>
  );
};

export const SourceBadge: React.FC<{ source: string }> = ({ source }) => {
  const config: Record<string, { label: string; className: string }> = {
    ramp: { label: '坡道', className: 'bg-blue-100 text-blue-700' },
    sampling: { label: '采样点', className: 'bg-purple-100 text-purple-700' },
    merged: { label: '合并', className: 'bg-cyan-100 text-cyan-700' },
  };
  const cfg = config[source] || config.ramp;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
};
