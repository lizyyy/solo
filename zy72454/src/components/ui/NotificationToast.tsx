import React from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

export const NotificationToast: React.FC = () => {
  const { notifications, removeNotification } = useAppStore();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border min-w-[320px] animate-slide-in ${
            n.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : n.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {n.type === 'success' && (
            <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-green-600" />
          )}
          {n.type === 'error' && (
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-600" />
          )}
          {n.type === 'info' && (
            <Info className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-600" />
          )}
          <div className="flex-1 text-sm font-medium">{n.message}</div>
          <button
            onClick={() => removeNotification(n.id)}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default NotificationToast;
