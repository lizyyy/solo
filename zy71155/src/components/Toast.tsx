import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import type { ToastMessage } from '../types/game';

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

const iconMap = {
  success: <CheckCircle size={20} />,
  error: <XCircle size={20} />,
  warning: <AlertTriangle size={20} />,
  info: <Info size={20} />,
};

const colorMap = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-orange-500',
  info: 'bg-blue-500',
};

export const Toast = ({ toasts, onRemove }: ToastProps) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white
            ${colorMap[toast.type]}
            animate-slide-in
          `}
          style={{
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          {iconMap[toast.type]}
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => onRemove(toast.id)}
            className="ml-2 hover:bg-white hover:bg-opacity-20 rounded p-1"
          >
            ×
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
