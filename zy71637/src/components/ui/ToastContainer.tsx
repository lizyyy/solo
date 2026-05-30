import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useUIStore, Toast } from '../../store/useUIStore';

const ToastItem: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle size={18} className="text-emerald-400" />;
      case 'error':
        return <XCircle size={18} className="text-rose-400" />;
      case 'warning':
        return <AlertTriangle size={18} className="text-amber-400" />;
      case 'info':
      default:
        return <Info size={18} className="text-blue-400" />;
    }
  };

  const getBgColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-emerald-500/10 border-emerald-500/30';
      case 'error':
        return 'bg-rose-500/10 border-rose-500/30';
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/30';
      case 'info':
      default:
        return 'bg-blue-500/10 border-blue-500/30';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-xl min-w-[300px] max-w-sm ${getBgColor()}`}
    >
      {getIcon()}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="font-medium text-white text-sm">{toast.title}</p>
        )}
        <p className={`text-sm ${toast.title ? 'text-slate-300' : 'text-slate-200'}`}>
          {toast.message}
        </p>
      </div>
      <button
        onClick={onClose}
        className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-all flex-shrink-0"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useUIStore();

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onClose={() => removeToast(toast.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};
