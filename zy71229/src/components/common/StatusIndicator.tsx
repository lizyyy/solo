import React from 'react';

interface StatusIndicatorProps {
  status: 'online' | 'warning' | 'danger' | 'offline';
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  text?: string;
}

const sizeClasses = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-3 h-3',
};

const statusClasses = {
  online: 'status-online',
  warning: 'status-warning',
  danger: 'status-danger',
  offline: 'bg-gray-500',
};

const statusTexts = {
  online: '正常',
  warning: '警告',
  danger: '异常',
  offline: '离线',
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'md',
  showText = false,
  text,
}) => {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`status-dot ${sizeClasses[size]} ${statusClasses[status]}`} />
      {showText && (
        <span className="text-xs text-gray-400">{text || statusTexts[status]}</span>
      )}
    </div>
  );
};
