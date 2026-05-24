import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const ErrorToast: React.FC = () => {
  const { sceneData, setCurrentTime, setPlayState, selectedElementId, setSelectedElement } =
    useAppStore();
  const [visibleErrors, setVisibleErrors] = useState<string[]>([]);

  useEffect(() => {
    const newErrors = sceneData.errors.map((e) => e.id);
    setVisibleErrors(newErrors.slice(0, 3));
  }, [sceneData.errors]);

  const dismissError = (errorId: string) => {
    setVisibleErrors((prev) => prev.filter((id) => id !== errorId));
  };

  const handleErrorClick = (error: any) => {
    if (error.timestamp !== undefined) {
      setCurrentTime(error.timestamp);
      setPlayState(false);
    }
    if (error.elementIds && error.elementIds.length > 0) {
      setSelectedElement(error.elementIds[0]);
    }
  };

  if (visibleErrors.length === 0) return null;

  return (
    <div className="absolute top-20 right-4 z-30 space-y-2 w-80">
      {sceneData.errors
        .filter((e) => visibleErrors.includes(e.id))
        .map((error) => (
          <div
            key={error.id}
            className={`rounded-lg shadow-lg overflow-hidden ${
              error.severity === 'error' ? 'bg-red-50' : 'bg-yellow-50'
            }`}
          >
            <div
              className="p-3 cursor-pointer hover:bg-opacity-80 transition-colors"
              onClick={() => handleErrorClick(error)}
            >
              <div className="flex items-start gap-2">
                {error.severity === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      error.severity === 'error' ? 'text-red-800' : 'text-yellow-800'
                    }`}
                  >
                    {error.severity === 'error' ? '严重错误' : '警告'}
                  </p>
                  <p
                    className={`text-xs mt-0.5 ${
                      error.severity === 'error' ? 'text-red-600' : 'text-yellow-600'
                    }`}
                  >
                    {error.message}
                  </p>
                  {error.timestamp !== undefined && (
                    <p
                      className={`text-xs mt-1 ${
                        error.severity === 'error' ? 'text-red-500' : 'text-yellow-500'
                      }`}
                    >
                      发生时间: {error.timestamp.toFixed(1)}s
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissError(error.id);
                  }}
                  className="p-1 hover:bg-white hover:bg-opacity-50 rounded"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
          </div>
        ))}
    </div>
  );
};
