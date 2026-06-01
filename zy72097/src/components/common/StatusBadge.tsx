import React from 'react';
import { formatStatus, getStatusColor } from '../../utils/format';
import { AlertCircle, CheckCircle, Clock, History } from 'lucide-react';

interface StatusBadgeProps {
  status: 'normal' | 'pending' | 'confirmed' | 'historical';
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, showIcon = true, size = 'md' }) => {
  const color = getStatusColor(status);
  const label = formatStatus(status);
  
  const bgColors: Record<string, string> = {
    normal: 'bg-success-50',
    pending: 'bg-warning-50',
    confirmed: 'bg-blue-50',
    historical: 'bg-historical-50',
  };
  
  const textColors: Record<string, string> = {
    normal: 'text-success-700',
    pending: 'text-warning-700',
    confirmed: 'text-blue-700',
    historical: 'text-historical-700',
  };
  
  const IconComponent = {
    normal: CheckCircle,
    pending: AlertCircle,
    confirmed: CheckCircle,
    historical: History,
  }[status];

  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs';

  return (
    <span 
      className={`status-badge ${bgColors[status]} ${textColors[status]} ${sizeClasses}`}
      style={{ borderColor: color, borderWidth: '1px' }}
    >
      {showIcon && <IconComponent className="w-3 h-3 mr-1" />}
      {label}
    </span>
  );
};

export default StatusBadge;
