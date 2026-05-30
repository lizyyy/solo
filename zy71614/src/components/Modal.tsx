import { X } from 'lucide-react';
import { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function Modal({ open, onClose, title, children, footer }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 animate-fadeInUp">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-200">{footer}</div>}
      </div>
    </div>
  );
}
