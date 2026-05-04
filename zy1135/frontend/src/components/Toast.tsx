import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

const Toast = () => {
  const { error, clearError } = useGameStore();

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  if (!error) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-red-50 border border-red-200 rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-red-500 text-xl">⚠️</div>
          <div className="flex-1">
            <h4 className="font-semibold text-red-800">操作失败</h4>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-600 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toast;
