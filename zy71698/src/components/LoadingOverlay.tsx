import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message = '处理中...' }) => {
  return (
    <div className="fixed inset-0 bg-bg-primary/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-bg-secondary rounded-lg p-8 flex flex-col items-center gap-4 shadow-2xl">
        <Loader2 className="animate-spin text-accent-success" size={40} />
        <p className="text-text-primary font-medium">{message}</p>
      </div>
    </div>
  );
};
