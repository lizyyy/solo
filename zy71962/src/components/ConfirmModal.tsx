import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "确认",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700">
          <h2 className="font-mono-display text-lg font-semibold text-zinc-100">
            {title}
          </h2>
          <button
            onClick={onCancel}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-zinc-300 text-sm leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-700">
          <button onClick={onCancel} className="btn-ghost text-sm">
            取消
          </button>
          <button onClick={onConfirm} className="btn-danger text-sm">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
