import React from 'react';
import { RecordStatus, RecordSource } from '../types';
import { getStatusLabel, getStatusColor, getSourceLabel, getSourceBadgeColor } from '../utils';

interface StatusBadgeProps {
  status: RecordStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border ${getStatusColor(status)}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'normal' ? 'bg-emerald-500' :
        status === 'pending' ? 'bg-amber-500' : 'bg-rose-500'
      }`}></span>
      {getStatusLabel(status)}
    </span>
  );
};

interface SourceBadgeProps {
  source: RecordSource;
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({ source }) => {
  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md ${getSourceBadgeColor(source)}`}>
      {getSourceLabel(source)}
    </span>
  );
};
