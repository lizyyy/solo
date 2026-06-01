import React from 'react';
import { AlertTriangle, CheckCircle, XCircle, Info, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface AlertBoxProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
  className?: string;
}

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: 'bg-green-50 border-green-500 text-green-800',
  error: 'bg-red-50 border-red-500 text-red-800',
  warning: 'bg-yellow-50 border-yellow-500 text-yellow-800',
  info: 'bg-blue-50 border-blue-500 text-blue-800',
};

export const AlertBox: React.FC<AlertBoxProps> = ({
  type,
  message,
  onClose,
  className,
}) => {
  const Icon = iconMap[type];

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 border-l-4 rounded-r shadow-sm',
        colorMap[type],
        className
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 text-sm font-medium">{message}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 hover:bg-black/5 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
