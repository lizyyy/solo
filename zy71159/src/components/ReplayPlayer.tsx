import { Play, Pause, SkipBack, SkipForward, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useGame } from '../hooks/useGameState';
import { WEATHER_INFO } from '../game/types';

interface ReplayPlayerProps {
  onClose: () => void;
}

export function ReplayPlayer({ onClose }: ReplayPlayerProps) {
  const { state, dispatch } = useGame();
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isAutoPlaying && state.replayIndex < state.history.length - 1) {
      interval = setInterval(() => {
        dispatch({ type: 'REPLAY_STEP', payload: { direction: 'forward' } });
      }, 1000);
    } else if (state.replayIndex >= state.history.length - 1) {
      setIsAutoPlaying(false);
    }
    return () => clearInterval(interval);
  }, [isAutoPlaying, state.replayIndex, state.history.length, dispatch]);

  const handlePrev = () => {
    dispatch({ type: 'REPLAY_STEP', payload: { direction: 'backward' } });
  };

  const handleNext = () => {
    dispatch({ type: 'REPLAY_STEP', payload: { direction: 'forward' } });
  };

  const handleFirst = () => {
    while (state.replayIndex > 0) {
      dispatch({ type: 'REPLAY_STEP', payload: { direction: 'backward' } });
    }
  };

  const handleLast = () => {
    while (state.replayIndex < state.history.length - 1) {
      dispatch({ type: 'REPLAY_STEP', payload: { direction: 'forward' } });
    }
  };

  const toggleAutoPlay = () => {
    setIsAutoPlaying(!isAutoPlaying);
  };

  const handleExit = () => {
    dispatch({ type: 'EXIT_REPLAY' });
    onClose();
  };

  const currentSnapshot = state.history[state.replayIndex];
  const weatherInfo = currentSnapshot ? WEATHER_INFO[currentSnapshot.weather] : null;

  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-blue-800 flex items-center gap-2">
          <Play className="w-5 h-5" />
          历史回放
        </h3>
        <button
          onClick={handleExit}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {currentSnapshot && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-blue-800">回合 {currentSnapshot.round}</p>
              <p className="text-sm text-blue-600">
                天气: {weatherInfo?.emoji} {weatherInfo?.name}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-amber-600">{currentSnapshot.score} 分</p>
              <p className="text-sm text-gray-600">
                用水: {currentSnapshot.waterUsed}
              </p>
            </div>
          </div>
          {currentSnapshot.valveActions.length > 0 && (
            <div className="mt-2 pt-2 border-t border-blue-200">
              <p className="text-xs text-blue-700">
                本回合操作: {currentSnapshot.valveActions.length} 个阀门
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>回合 1</span>
          <span>
            回合 {state.replayIndex + 1} / {state.history.length}
          </span>
          <span>回合 {state.history.length}</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{
              width: `${((state.replayIndex + 1) / state.history.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        <button
          onClick={handleFirst}
          disabled={state.replayIndex === 0}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="第一帧"
        >
          <SkipBack className="w-5 h-5" />
        </button>
        <button
          onClick={handlePrev}
          disabled={state.replayIndex === 0}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="上一帧"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={toggleAutoPlay}
          className={`p-3 rounded-lg transition-colors ${
            isAutoPlaying
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
          title={isAutoPlaying ? '暂停' : '自动播放'}
        >
          {isAutoPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6" />
          )}
        </button>
        <button
          onClick={handleNext}
          disabled={state.replayIndex >= state.history.length - 1}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="下一帧"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <button
          onClick={handleLast}
          disabled={state.replayIndex >= state.history.length - 1}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="最后一帧"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      <p className="text-center text-xs text-gray-500 mt-4">
        点击棋盘上的阀门可以查看各回合状态
      </p>
    </div>
  );
}
