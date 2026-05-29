import React from 'react';
import { ContaminationType, ProcessStatus, CONTAMINATION_TYPE_LABELS, PROCESS_STATUS_LABELS } from '../../types';
import { getContaminationTypeColor, getProcessStatusColor } from '../../utils/format';

interface ContaminationBadgeProps {
  type: ContaminationType;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export const ContaminationBadge: React.FC<ContaminationBadgeProps> = ({
  type,
  showLabel = true,
  size = 'md'
}) => {
  const colorClass = getContaminationTypeColor(type);
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';
  
  return (
    <span className={`inline-flex items-center rounded-md font-medium ${colorClass} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${type === ContaminationType.NONE ? 'bg-success-500' : 'bg-current'}`}></span>
      {showLabel && CONTAMINATION_TYPE_LABELS[type]}
    </span>
  );
};

interface ProcessStatusBadgeProps {
  status: ProcessStatus;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export const ProcessStatusBadge: React.FC<ProcessStatusBadgeProps> = ({
  status,
  showLabel = true,
  size = 'md'
}) => {
  const colorClass = getProcessStatusColor(status);
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';
  
  const dotColor = {
    [ProcessStatus.PENDING]: 'bg-gray-400',
    [ProcessStatus.PROCESSING]: 'bg-primary-500 animate-pulse',
    [ProcessStatus.COMPLETED]: 'bg-success-500',
    [ProcessStatus.ERROR]: 'bg-danger-500',
    [ProcessStatus.SKIPPED]: 'bg-warning-500'
  }[status];
  
  return (
    <span className={`inline-flex items-center rounded-md font-medium ${colorClass} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotColor}`}></span>
      {showLabel && PROCESS_STATUS_LABELS[status]}
    </span>
  );
};

interface StatusDotProps {
  active: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'success' | 'warning' | 'danger' | 'primary' | 'gray';
  pulse?: boolean;
}

export const StatusDot: React.FC<StatusDotProps> = ({
  active,
  size = 'md',
  color = 'success',
  pulse = false
}) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }[size];
  
  const colorClasses = {
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    danger: 'bg-danger-500',
    primary: 'bg-primary-500',
    gray: 'bg-gray-400'
  }[color];
  
  const activeColor = active ? colorClasses : 'bg-gray-300';
  const pulseClass = pulse && active ? 'animate-ping' : '';
  
  return (
    <span className="relative inline-flex">
      {pulse && active && (
        <span className={`absolute inline-flex rounded-full ${activeColor} ${sizeClasses} ${pulseClass} opacity-75`}></span>
      )}
      <span className={`relative inline-flex rounded-full ${activeColor} ${sizeClasses}`}></span>
    </span>
  );
};
