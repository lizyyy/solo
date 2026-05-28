import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: ModalSize;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  showCloseButton?: boolean;
  className?: string;
}

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-6xl w-full mx-4',
};

export default function Modal({
  isOpen,
  onClose,
  children,
  title,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEsc = true,
  showCloseButton = true,
  className,
}: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === 'Escape') {
        onClose();
      }
    },
    [closeOnEsc, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  const handleOverlayClick = () => {
    if (closeOnOverlayClick) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)' }}
            onClick={handleOverlayClick}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 35,
              mass: 0.8,
            }}
            className={cn(
              'relative w-full',
              sizeStyles[size],
              'rounded-2xl overflow-hidden',
              'border border-white/10',
              'shadow-2xl',
              className
            )}
            style={{
              backgroundColor: 'rgba(10, 22, 40, 0.95)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 60px rgba(0, 255, 157, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(0, 255, 157, 0.05) 0%, transparent 50%, rgba(0, 212, 255, 0.05) 100%)',
              }}
            />

            {title && (
              <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/10">
                <h2 className="text-lg font-semibold font-orbitron tracking-wider text-white">
                  {title}
                </h2>
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {!title && showCloseButton && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-20 p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <div className="relative z-10">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
