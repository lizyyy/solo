import { ReactNode } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  children?: ReactNode;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'danger',
  children,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: <AlertTriangle className="w-6 h-6 text-risk-high" />,
      button: 'btn-danger',
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6 text-risk-medium" />,
      button: 'bg-risk-medium text-white hover:bg-orange-600 btn',
    },
    info: {
      icon: <AlertTriangle className="w-6 h-6 text-primary-600" />,
      button: 'btn-primary',
    },
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            {variantStyles[variant].icon}
            <p className="text-gray-600 leading-relaxed">{message}</p>
          </div>
          {children}
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary">
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={variantStyles[variant].button}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
