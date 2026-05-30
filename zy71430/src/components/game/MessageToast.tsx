
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { GameMessage } from '../../types';

const MessageIcon: React.FC<{ type: GameMessage['type'] }> = ({ type }) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-400" />;
    case 'error':
      return <XCircle className="w-5 h-5 text-red-400" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
    case 'info':
    default:
      return <Info className="w-5 h-5 text-blue-400" />;
  }
};

const getMessageBg = (type: GameMessage['type']) => {
  switch (type) {
    case 'success':
      return 'bg-green-900/90 border-green-700';
    case 'error':
      return 'bg-red-900/90 border-red-700';
    case 'warning':
      return 'bg-yellow-900/90 border-yellow-700';
    case 'info':
    default:
      return 'bg-blue-900/90 border-blue-700';
  }
};

export const MessageToast: React.FC = () => {
  const { messages, clearMessages } = useGameStore();

  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        clearMessages();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [messages, clearMessages]);

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 pointer-events-none">
      <AnimatePresence>
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ duration: 0.3 }}
            className={`px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg max-w-sm ${getMessageBg(
              message.type
            )}`}
          >
            <div className="flex items-center gap-3">
              <MessageIcon type={message.type} />
              <span className="text-slate-200 text-sm">{message.text}</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
