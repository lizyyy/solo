import React from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertType = 'error' | 'success' | 'warning' | 'info';

interface AlertMessageProps {
  type: AlertType;
  title?: string;
  message: string;
  onClose?: () => void;
  className?: string;
}

const alertStyles: Record<AlertType, { bg: string; border: string; icon: string; text: string }> = {
  error: {
    bg: 'bg-danger-50',
    border: 'border-danger-400',
    icon: 'text-danger-500',
    text: 'text-danger-800',
  },
  success: {
    bg: 'bg-success-50',
    border: 'border-success-400',
    icon: 'text-success-500',
    text: 'text-success-800',
  },
  warning: {
    bg: 'bg-warning-50',
    border: 'border-warning-400',
    icon: 'text-warning-500',
    text: 'text-warning-800',
  },
  info: {
    bg: 'bg-subway-50',
    border: 'border-subway-400',
    icon: 'text-subway-500',
    text: 'text-subway-800',
  },
};

const IconComponent: Record<AlertType, React.FC<{ className?: string }>> = {
  error: AlertCircle,
  success: CheckCircle,
  warning: AlertTriangle,
  info: Info,
};

export const AlertMessage: React.FC<AlertMessageProps> = ({
  type,
  title,
  message,
  onClose,
  className = '',
}) => {
  const styles = alertStyles[type];
  const Icon = IconComponent[type];

  return (
    <div
      className={cn(
        'relative border rounded-lg p-4 animate-fade-in',
        styles.bg,
        styles.border,
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', styles.icon)} />
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={cn('font-semibold mb-1', styles.text)}>{title}</h4>
          )}
          <p className={cn('text-sm', styles.text)}>{message}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={cn(
              'flex-shrink-0 p-1 rounded-full hover:bg-black/10 transition-colors',
              styles.text
            )}
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default AlertMessage;
