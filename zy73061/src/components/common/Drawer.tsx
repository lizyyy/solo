import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  widthClass?: string;
}

export default function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  widthClass = 'max-w-lg w-full',
}: DrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-industrial-900/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            className={`fixed top-0 right-0 z-50 h-full ${widthClass} bg-surface-card shadow-2xl border-l border-surface-border flex flex-col`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <header className="flex items-start justify-between gap-3 px-6 py-4 border-b border-surface-border">
              <div className="min-w-0">
                <h2 className="title-font text-lg font-semibold text-industrial-800 leading-tight">{title}</h2>
                {subtitle && <p className="text-xs text-industrial-500 mt-1">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-industrial-400 hover:text-industrial-700 hover:bg-industrial-50 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
