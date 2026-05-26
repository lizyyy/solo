import { useEffect, useRef } from 'react';
import { useGameStore } from '../game/state';
import { startReplay, replayStep, stopReplay } from '../game/engine';
import { Play, Pause, SkipBack, SkipForward, X, RotateCcw } from 'lucide-react';

export function ReplayPlayer() {
  const status = useGameStore((state) => state.status);
  const history = useGameStore((state) => state.history);
  const replayIndex = useGameStore((state) => state.replayIndex);
  const intervalRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    if (status !== 'replay') {
      isPlayingRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status]);

  const handleStart = () => {
    if (history.length === 0) return;

    if (replayIndex === 0) {
      startReplay();
    }

    isPlayingRef.current = true;
    intervalRef.current = window.setInterval(() => {
      const state = useGameStore.getState();
      if (state.replayIndex >= state.history.length - 1) {
        isPlayingRef.current = false;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }
      replayStep(1);
    }, 500);
  };

  const handlePause = () => {
    isPlayingRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleStepBack = () => {
    handlePause();
    replayStep(-1);
  };

  const handleStepForward = () => {
    handlePause();
    replayStep(1);
  };

  const handleReset = () => {
    handlePause();
    useGameStore.getState().setReplayIndex(0);
    if (history.length > 0) {
      useGameStore.getState().loadSnapshot(history[0].snapshot);
    }
  };

  const handleStop = () => {
    handlePause();
    stopReplay();
  };

  const progress = history.length > 1
    ? Math.round((replayIndex / (history.length - 1)) * 100)
    : 0;

  return (
    <div className="bg-gray-800/90 rounded-xl p-4 border border-purple-500/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span className="text-2xl">🎬</span> 历史回放
        </h3>
        <button
          onClick={handleStop}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>进度</span>
          <span>{replayIndex} / {history.length - 1}</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handleReset}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          title="重置"
        >
          <RotateCcw className="w-5 h-5 text-white" />
        </button>

        <button
          onClick={handleStepBack}
          disabled={replayIndex <= 0}
          className="p-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          title="后退一步"
        >
          <SkipBack className="w-5 h-5 text-white" />
        </button>

        {isPlayingRef.current ? (
          <button
            onClick={handlePause}
            className="p-3 bg-yellow-600 hover:bg-yellow-500 rounded-lg transition-colors"
            title="暂停"
          >
            <Pause className="w-6 h-6 text-white" />
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={replayIndex >= history.length - 1}
            className="p-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            title="播放"
          >
            <Play className="w-6 h-6 text-white" />
          </button>
        )}

        <button
          onClick={handleStepForward}
          disabled={replayIndex >= history.length - 1}
          className="p-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          title="前进一步"
        >
          <SkipForward className="w-5 h-5 text-white" />
        </button>
      </div>

      <p className="mt-4 text-xs text-gray-400 text-center">
        回放模式：查看本局游戏的所有操作和事件
      </p>
    </div>
  );
}
