import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger' | 'warning';
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  children,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    default: {
      icon: 'text-primary-500',
      button: 'bg-primary-600 hover:bg-primary-700 text-white'
    },
    danger: {
      icon: 'text-danger-500',
      button: 'bg-danger-600 hover:bg-danger-700 text-white'
    },
    warning: {
      icon: 'text-warning-500',
      button: 'bg-warning-500 hover:bg-warning-600 text-white'
    }
  }[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white border border-primary-200 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-primary-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className={`w-5 h-5 ${variantStyles.icon}`} />
            <h3 className="font-mono font-semibold text-primary-800">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-primary-100 text-primary-400 hover:text-primary-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4">
          {message && (
            <p className="text-sm text-primary-600 whitespace-pre-line">{message}</p>
          )}
          {children}
        </div>
        
        <div className="flex justify-end gap-2 p-4 border-t border-primary-200 bg-primary-50">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium border border-primary-300 text-primary-700 hover:bg-primary-100 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium transition-colors ${variantStyles.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
