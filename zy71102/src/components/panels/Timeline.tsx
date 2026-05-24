import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useSimulationStore } from '../../store/useSimulationStore';

export const Timeline: React.FC = () => {
  const {
    selectedScene,
    isPlaying,
    setPlaying,
    currentTime,
    setCurrentTime,
    statistics
  } = useSimulationStore();

  const maxTime = 120;
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!selectedScene) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-11/12 max-w-3xl">
      <div className="bg-slate-800/95 backdrop-blur-sm rounded-lg shadow-xl border border-slate-700 px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentTime(Math.max(0, currentTime - 5))}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="后退5秒"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPlaying(!isPlaying)}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setCurrentTime(Math.min(maxTime, currentTime + 5))}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="前进5秒"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1">
            <div className="relative">
              <input
                type="range"
                min="0"
                max={maxTime}
                step="0.1"
                value={currentTime}
                onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>{formatTime(0)}</span>
                <span className="text-blue-400 font-mono font-bold">
                  {formatTime(currentTime)}
                </span>
                <span>{formatTime(maxTime)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <div className="text-green-400 font-bold">{statistics.exitedCount}</div>
              <div className="text-slate-500 text-xs">已疏散</div>
            </div>
            <div className="h-8 w-px bg-slate-600" />
            <div className="text-center">
              <div className="text-yellow-400 font-bold">{statistics.waitingCount}</div>
              <div className="text-slate-500 text-xs">等待中</div>
            </div>
            <div className="h-8 w-px bg-slate-600" />
            <div className="text-center">
              <div className="text-red-400 font-bold">{statistics.stuckCount}</div>
              <div className="text-slate-500 text-xs">滞留</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
