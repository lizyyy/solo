import React from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Gauge } from 'lucide-react';
import { useSimulationStore } from '../store/useSimulationStore';
import { cn } from '../utils/cn';

export const Timeline: React.FC = () => {
  const {
    isPlaying,
    currentStep,
    maxSteps,
    speed,
    togglePlay,
    setCurrentStep,
    setSpeed,
    resetSimulation
  } = useSimulationStore();

  const progress = (currentStep / maxSteps) * 100;

  const speeds = [0.5, 1, 2, 4];
  const speedLabels = ['0.5x', '1x', '2x', '4x'];

  return (
    <div className="h-20 bg-gray-800 border-t border-gray-700 flex flex-col px-4 py-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={resetSimulation}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
            title="重置"
          >
            <RotateCcw size={18} />
          </button>
          
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 10))}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
            title="后退10步"
          >
            <SkipBack size={18} />
          </button>
          
          <button
            onClick={togglePlay}
            className={cn(
              "p-3 rounded-lg transition-all",
              isPlaying
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                : "bg-gray-700 text-white hover:bg-gray-600"
            )}
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          
          <button
            onClick={() => setCurrentStep(Math.min(maxSteps, currentStep + 10))}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
            title="前进10步"
          >
            <SkipForward size={18} />
          </button>
        </div>

        <div className="flex-1 flex items-center gap-3">
          <span className="text-gray-400 text-xs font-mono w-16">
            {String(currentStep).padStart(3, '0')}
          </span>
          
          <div className="flex-1 relative h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
            <input
              type="range"
              min="0"
              max={maxSteps}
              value={currentStep}
              onChange={(e) => setCurrentStep(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          
          <span className="text-gray-400 text-xs font-mono w-16 text-right">
            {String(maxSteps).padStart(3, '0')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Gauge size={16} className="text-gray-400" />
          <div className="flex gap-1">
            {speeds.map((s, index) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn(
                  "px-2 py-1 text-xs rounded transition-colors",
                  speed === s
                    ? "bg-orange-500 text-white"
                    : "bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white"
                )}
              >
                {speedLabels[index]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 mt-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-gray-400 text-xs">入口区</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-gray-400 text-xs">中段区</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-gray-400 text-xs">出口区</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-gray-400 text-xs">火源</span>
        </div>
      </div>
    </div>
  );
};
