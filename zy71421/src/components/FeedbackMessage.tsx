import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info } from 'lucide-react';

interface FeedbackMessageProps {
  type: 'success' | 'error' | 'info';
  message: string;
  onClose?: () => void;
  duration?: number;
}

export const FeedbackMessage: React.FC<FeedbackMessageProps> = ({ 
  type, 
  message, 
  onClose,
  duration = 2500 
}) => {
  useEffect(() => {
    if (onClose && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [onClose, duration]);

  const config = {
    success: {
      bg: 'bg-green-50 border-green-300',
      text: 'text-green-700',
      icon: <CheckCircle className="w-5 h-5 text-green-500" />,
    },
    error: {
      bg: 'bg-red-50 border-red-300',
      text: 'text-red-700',
      icon: <XCircle className="w-5 h-5 text-red-500" />,
    },
    info: {
      bg: 'bg-blue-50 border-blue-300',
      text: 'text-blue-700',
      icon: <Info className="w-5 h-5 text-blue-500" />,
    },
  };

  const currentConfig = config[type];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-xl border-2 ${currentConfig.bg} shadow-lg max-w-md w-full mx-4`}
      >
        <div className="flex items-center gap-3">
          {currentConfig.icon}
          <span className={`font-medium ${currentConfig.text}`}>{message}</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
