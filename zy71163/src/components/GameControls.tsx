import React from 'react';
import { useGameStore } from '@/store/gameStore';
import { Play, Pause, RotateCcw, Home, Check, X, AlertCircle } from 'lucide-react';

interface GameControlsProps {
  onHome?: () => void;
}

export const GameControls: React.FC<GameControlsProps> = ({ onHome }) => {
  const {
    status,
    isAllChecked,
    startReading,
    startPlaying,
    pauseGame,
    resumeGame,
    restartGame,
    confirmPrescription,
    rejectPrescription,
  } = useGameStore();

  const handleStart = () => {
    if (status === 'idle') {
      startReading();
    }
  };

  const handleConfirm = () => {
    confirmPrescription();
  };

  const handleReject = () => {
    rejectPrescription();
  };

  if (status === 'idle') {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={handleStart}
          className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
        >
          <Play className="w-5 h-5" />
          开始游戏
        </button>
      </div>
    );
  }

  if (status === 'reading') {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => startPlaying()}
          className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
        >
          <Play className="w-5 h-5" />
          开始配药
        </button>
      </div>
    );
  }

  if (status === 'playing') {
    const allChecked = isAllChecked();
    
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={pauseGame}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Pause className="w-4 h-4" />
          暂停
        </button>
        
        {allChecked ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleConfirm}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <Check className="w-4 h-4" />
              确认配药
            </button>
            <button
              onClick={handleReject}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
              拒绝配药
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed">
            <AlertCircle className="w-4 h-4" />
            请完成所有核对
          </div>
        )}
      </div>
    );
  }

  if (status === 'paused') {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={resumeGame}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          <Play className="w-4 h-4" />
          继续
        </button>
        <button
          onClick={restartGame}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          重新开始
        </button>
      </div>
    );
  }

  if (status === 'finished') {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={restartGame}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          重新开始
        </button>
        <button
          onClick={onHome || (() => window.location.href = '/')}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Home className="w-4 h-4" />
          返回菜单
        </button>
      </div>
    );
  }

  return null;
};