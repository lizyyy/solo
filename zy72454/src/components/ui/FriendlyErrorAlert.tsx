import React from 'react';
import { AlertTriangle, X, Lightbulb } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

export const FriendlyErrorAlert: React.FC = () => {
  const { error, clearError } = useAppStore();

  if (!error) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <div className="bg-orange-50 border border-orange-200 rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-orange-900 text-base">
              {error.message}
            </div>
            {error.suggestion && (
              <div className="mt-2 flex items-start gap-2 text-sm text-orange-800">
                <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error.suggestion}</span>
              </div>
            )}
            {error.details && (
              <div className="mt-2 text-xs text-orange-600 font-mono bg-orange-100 px-2 py-1 rounded">
                {error.details}
              </div>
            )}
          </div>
          <button
            onClick={clearError}
            className="text-orange-400 hover:text-orange-600 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FriendlyErrorAlert;
