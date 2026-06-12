import { useEffect } from 'react';
import { useStore } from '../store/useStore';

export default function Notification() {
  const { notification, clearNotification } = useStore();

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(clearNotification, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification, clearNotification]);

  if (!notification) return null;

  const bgColor = {
    success: 'bg-emerald-600',
    error: 'bg-studio-red',
    warning: 'bg-status-conflict',
  }[notification.type];

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-up">
      <div className={`${bgColor} text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 min-w-[320px]`}>
        <div className="text-2xl">
          {notification.type === 'success' && '✓'}
          {notification.type === 'error' && '✕'}
          {notification.type === 'warning' && '!'}
        </div>
        <p className="font-mono text-sm">{notification.message}</p>
        <button onClick={clearNotification} className="ml-auto opacity-70 hover:opacity-100">
          ✕
        </button>
      </div>
    </div>
  );
}
