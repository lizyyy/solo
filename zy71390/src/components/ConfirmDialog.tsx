import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { cn } from '../lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="flex items-start gap-4 mb-6">
        <div
          className={cn(
            'p-3 rounded-full flex-shrink-0',
            danger ? 'bg-red-500/10' : 'bg-blue-500/10'
          )}
        >
          <AlertTriangle
            className={cn('w-6 h-6', danger ? 'text-red-400' : 'text-blue-400')}
          />
        </div>
        <p className="text-gray-300 text-sm leading-relaxed">{message}</p>
      </div>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          className={cn(
            'px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors',
            danger
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-blue-600 hover:bg-blue-700'
          )}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}

export { ConfirmDialog };
