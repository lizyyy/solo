import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useAppStore } from '@/store';

export const ErrorDisplay: React.FC = () => {
  const { error, clearError } = useAppStore();

  if (!error) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md animate-slide-in">
      <div className="bg-accent-error/10 border border-accent-error/30 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="text-accent-error flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <h4 className="font-medium text-accent-error mb-1">操作失败</h4>
          <p className="text-sm text-text-primary">{error}</p>
        </div>
        <button
          onClick={clearError}
          className="text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};
