import { X, AlertTriangle, CheckCircle, Info, AlertCircle, ArrowRight } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { NotificationItem } from '@/types';

const toastIcons = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
};

const toastColors = {
  error: 'border-danger-600 bg-danger-900/90 text-danger-200',
  warning: 'border-warning-600 bg-warning-900/90 text-warning-200',
  info: 'border-primary-600 bg-primary-900/90 text-primary-200',
  success: 'border-success-600 bg-success-900/90 text-success-200',
};

const iconColors = {
  error: 'text-danger-400',
  warning: 'text-warning-400',
  info: 'text-primary-400',
  success: 'text-success-400',
};

interface ToastProps {
  notification: NotificationItem;
}

function Toast({ notification }: ToastProps) {
  const removeNotification = useStore((state) => state.removeNotification);
  const Icon = toastIcons[notification.type];

  return (
    <div
      className={`w-full max-w-sm border rounded-lg shadow-xl backdrop-blur-sm p-4 animate-slide-in-right ${toastColors[notification.type]}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColors[notification.type]}`} />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm mb-1">{notification.title}</h4>
          <p className="text-xs opacity-90 mb-2">{notification.message}</p>
          {notification.nextStep && (
            <div className="bg-black/20 rounded p-2 mb-2">
              <p className="text-xs flex items-start gap-1.5">
                <ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{notification.nextStep}</span>
              </p>
            </div>
          )}
          {notification.actions && notification.actions.length > 0 && (
            <div className="flex gap-2">
              {notification.actions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    action.onClick();
                    removeNotification(notification.id);
                  }}
                  className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => removeNotification(notification.id)}
          className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4 opacity-70" />
        </button>
      </div>
    </div>
  );
}

export function NotificationToast() {
  const notifications = useStore((state) => state.notifications);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3">
      {notifications.map((notification) => (
        <Toast key={notification.id} notification={notification} />
      ))}
    </div>
  );
}
