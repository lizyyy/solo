import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../utils/cn';

const notificationStyles = {
  success: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-800 dark:text-green-200',
    icon: CheckCircle,
    iconColor: 'text-green-500',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-800 dark:text-red-200',
    icon: XCircle,
    iconColor: 'text-red-500',
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-800 dark:text-yellow-200',
    icon: AlertCircle,
    iconColor: 'text-yellow-500',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-800 dark:text-blue-200',
    icon: Info,
    iconColor: 'text-blue-500',
  },
};

export const Notification = ({ message, type = 'info', onClose, className }) => {
  const style = notificationStyles[type] || notificationStyles.info;
  const Icon = style.icon;
  
  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg',
      style.bg,
      style.border,
      className
    )}>
      <Icon className={cn('w-5 h-5 flex-shrink-0', style.iconColor)} />
      <p className={cn('text-sm font-medium flex-1', style.text)}>{message}</p>
      {onClose && (
        <button 
          onClick={onClose}
          className={cn('flex-shrink-0 hover:opacity-70', style.text)}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export const NotificationContainer = ({ notifications, onDismiss }) => (
  <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
    {notifications.map((n) => (
      <Notification
        key={n.id}
        message={n.message}
        type={n.type}
        onClose={() => onDismiss(n.id)}
      />
    ))}
  </div>
);
