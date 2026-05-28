import React from 'react';
import { Play, Pause, RotateCcw, FastForward } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { GAME_CONFIG } from '../../game/config';
import { formatGameTime, formatVirtualTime } from '../../game/engine';

export const TimeDisplay: React.FC = () => {
  const { state, startGame, pauseGame, resumeGame, setTimeScale, resetGame } = useGameStore();

  const remainingTime = state.totalTime - state.gameTime;
  const progress = (state.gameTime / state.totalTime) * 100;
  const isUrgent = remainingTime < 60;

  const handleStartPause = () => {
    if (state.isGameOver) return;
    if (state.isPaused && state.gameTime === 0) {
      startGame();
    } else if (state.isPaused) {
      resumeGame();
    } else {
      pauseGame();
    }
  };

  const handleReset = () => {
    if (confirm('确定要重新开始吗？当前进度将丢失。')) {
      resetGame();
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">时间系统</span>
        <span className={`font-mono text-sm ${isUrgent ? 'text-alert-red animate-blink' : 'text-gray-300'}`}>
          {formatGameTime(remainingTime)}
        </span>
      </div>
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">虚拟时间</span>
          <span className="font-mono text-alert-yellow">
            {formatVirtualTime(state.gameTime)}
          </span>
        </div>

        <div className="w-full h-2 bg-night-700 rounded-sm overflow-hidden">
          <div
            className={`h-full transition-all duration-200 ${isUrgent ? 'bg-alert-red' : 'bg-alert-green'}`}
            style={{ width: `${100 - progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <button
              onClick={handleStartPause}
              className="glow-btn-primary px-3 py-1.5 text-xs flex items-center gap-1"
              disabled={state.isGameOver}
            >
              {state.isPaused ? <Play size={14} /> : <Pause size={14} />}
              {state.isPaused ? (state.gameTime === 0 ? '开始' : '继续') : '暂停'}
            </button>
            <button
              onClick={handleReset}
              className="glow-btn px-3 py-1.5 text-xs flex items-center gap-1"
            >
              <RotateCcw size={14} />
              重置
            </button>
          </div>

          <div className="flex items-center gap-1">
            <FastForward size={14} className="text-gray-500" />
            {GAME_CONFIG.TIME_SCALES.map(scale => (
              <button
                key={scale}
                onClick={() => setTimeScale(scale)}
                className={`px-2 py-1 text-xs font-mono border transition-colors ${
                  state.timeScale === scale
                    ? 'border-alert-blue text-alert-blue bg-alert-blue/10'
                    : 'border-gray-600 text-gray-400 hover:border-gray-400'
                }`}
              >
                {scale}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
