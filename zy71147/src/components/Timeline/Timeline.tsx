
import React from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

export const Timeline: React.FC = () => {
  const { timelineProgress, isPlaying, setTimelineProgress, setIsPlaying, resetScene } = useAppStore();

  const formatTime = (progress: number): string => {
    const totalSeconds = 20;
    const currentSeconds = Math.floor(progress * totalSeconds);
    const minutes = Math.floor(currentSeconds / 60);
    const seconds = currentSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimelineProgress(parseFloat(e.target.value));
  };

  const handleSkipBack = () => {
    setTimelineProgress(Math.max(0, timelineProgress - 0.1));
  };

  const handleSkipForward = () => {
    setTimelineProgress(Math.min(1, timelineProgress + 0.1));
  };

  return (
    <div className="h-20 bg-gray-900 bg-opacity-95 border-t border-gray-700 flex items-center px-4 gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={resetScene}
          className="p-2 rounded hover:bg-gray-700 text-gray-300 transition-colors"
          title="重置"
        >
          <RotateCcw size={18} />
        </button>

        <button
          onClick={handleSkipBack}
          className="p-2 rounded hover:bg-gray-700 text-gray-300 transition-colors"
          title="后退10%"
        >
          <SkipBack size={18} />
        </button>

        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>

        <button
          onClick={handleSkipForward}
          className="p-2 rounded hover:bg-gray-700 text-gray-300 transition-colors"
          title="前进10%"
        >
          <SkipForward size={18} />
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-12 text-right">
            {formatTime(timelineProgress)}
          </span>
          
          <div className="flex-1 relative">
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={timelineProgress}
              onChange={handleProgressChange}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #165DFF 0%, #165DFF ${timelineProgress * 100}%, #374151 ${timelineProgress * 100}%, #374151 100%)`
              }}
            />
            
            <div className="absolute top-0 left-0 right-0 flex justify-between px-1 mt-4">
              {[0, 0.25, 0.5, 0.75, 1].map((mark) => (
                <div
                  key={mark}
                  className={`w-1 h-2 rounded ${
                    timelineProgress >= mark ? 'bg-blue-500' : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>

          <span className="text-xs text-gray-400 w-12">
            {formatTime(1)}
          </span>
        </div>

        <div className="flex justify-between mt-2 px-14">
          <span className="text-xs text-gray-500">起吊</span>
          <span className="text-xs text-gray-500">提升</span>
          <span className="text-xs text-gray-500">平移</span>
          <span className="text-xs text-gray-500">下降</span>
          <span className="text-xs text-gray-500">就位</span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span>进度:</span>
        <span className="text-blue-400 font-mono">
          {(timelineProgress * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

