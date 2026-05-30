import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import type { FeedbackMessage } from '@/types/music';
import { cn } from '@/lib/utils';

interface FeedbackToastProps {
  feedback: FeedbackMessage | null;
  onClose: () => void;
}

export const FeedbackToast: React.FC<FeedbackToastProps> = ({ feedback, onClose }) => {
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => {
        onClose();
      }, feedback.duration || 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback, onClose]);

  if (!feedback) return null;

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-jazz-green" />,
    error: <XCircle className="w-5 h-5 text-jazz-burgundy" />,
    warning: <AlertTriangle className="w-5 h-5 text-jazz-orange" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
  };

  const bgColors = {
    success: 'bg-jazz-green/10 border-jazz-green/50',
    error: 'bg-jazz-burgundy/10 border-jazz-burgundy/50 animate-shake',
    warning: 'bg-jazz-orange/10 border-jazz-orange/50',
    info: 'bg-blue-500/10 border-blue-500/50',
  };

  const textColors = {
    success: 'text-jazz-greenLight',
    error: 'text-jazz-burgundyLight',
    warning: 'text-jazz-orangeLight',
    info: 'text-blue-400',
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-up">
      <div
        className={cn(
          'flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm shadow-xl max-w-sm',
          bgColors[feedback.type]
        )}
      >
        <div className="flex-shrink-0 mt-0.5">{icons[feedback.type]}</div>
        <div className="flex-1 min-w-0">
          <h4 className={cn('font-semibold text-sm mb-1', textColors[feedback.type])}>
            {feedback.title}
          </h4>
          <p className="text-jazz-text text-sm opacity-90">{feedback.message}</p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-jazz-textMuted hover:text-jazz-text transition-colors"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
