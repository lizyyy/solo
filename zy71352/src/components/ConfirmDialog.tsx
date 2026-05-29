import { AlertTriangle, CheckCircle } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { cn } from '../lib/utils';

const variantStyles = {
  default: {
    icon: CheckCircle,
    iconBg: 'bg-blue-100 text-blue-600',
    confirmBtn: 'bg-slate-800 hover:bg-slate-900 text-white',
  },
  danger: {
    icon: AlertTriangle,
    iconBg: 'bg-red-100 text-red-600',
    confirmBtn: 'bg-red-600 hover:bg-red-700 text-white',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100 text-amber-600',
    confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
};

export function ConfirmDialog() {
  const { confirmDialog, closeConfirmDialog } = useUIStore();
  const { open, title, message, onConfirm, confirmText, cancelText, variant } = confirmDialog;

  if (!open) return null;

  const styles = variantStyles[variant];
  const Icon = styles.icon;

  const handleConfirm = () => {
    onConfirm?.();
    closeConfirmDialog();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeConfirmDialog}
      />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scaleIn"
      >
        <div className="flex items-start gap-4">
          <div className={cn('p-3 rounded-full flex-shrink-0', styles.iconBg)}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-stone-900 mb-1">{title}</h3>
            <p className="text-sm text-stone-600 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <button
            onClick={closeConfirmDialog}
            className="px-4 py-2 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm',
            styles.confirmBtn
          )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
