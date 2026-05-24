import { useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Gauge } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../lib/utils';

export function Timeline() {
  const {
    timeSeriesData,
    currentTimeIndex,
    isPlaying,
    playSpeed,
    setCurrentTimeIndex,
    setIsPlaying,
    setPlaySpeed,
  } = useAppStore();

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying && timeSeriesData.length > 0) {
      intervalRef.current = window.setInterval(() => {
        setCurrentTimeIndex(currentTimeIndex + 1);
        if (currentTimeIndex >= timeSeriesData.length - 1) {
          setCurrentTimeIndex(0);
        }
      }, 500 / playSpeed);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, currentTimeIndex, playSpeed, timeSeriesData.length, setCurrentTimeIndex]);

  const formatTime = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTimeIndex(parseInt(e.target.value));
  };

  const speeds = [0.5, 1, 2, 4];

  if (timeSeriesData.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-72 right-72 bg-slate-900/90 backdrop-blur-md rounded-lg border border-cyan-500/20 shadow-2xl p-4">
      <div className="flex items-center gap-4 mb-3">
        <button
          onClick={() => setCurrentTimeIndex(0)}
          className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-400 transition-colors"
          title="回到开始"
        >
          <SkipBack size={18} />
        </button>

        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={cn(
            'p-3 rounded-lg transition-all',
            isPlaying
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
          )}
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>

        <button
          onClick={() => setCurrentTimeIndex(timeSeriesData.length - 1)}
          className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-400 transition-colors"
          title="跳转到最后"
        >
          <SkipForward size={18} />
        </button>

        <div className="flex items-center gap-1 ml-2">
          <Gauge size={16} className="text-gray-400" />
          {speeds.map((speed) => (
            <button
              key={speed}
              onClick={() => setPlaySpeed(speed)}
              className={cn(
                'px-2 py-1 text-xs rounded transition-colors',
                playSpeed === speed
                  ? 'bg-cyan-500/30 text-cyan-400'
                  : 'text-gray-400 hover:text-gray-300'
              )}
            >
              {speed}x
            </button>
          ))}
        </div>

        <div className="flex-1 text-right">
          <span className="text-sm font-mono text-cyan-400">
            {formatTime(timeSeriesData[currentTimeIndex]?.timestamp || '')}
          </span>
        </div>
      </div>

      <div className="relative">
        <input
          type="range"
          min="0"
          max={timeSeriesData.length - 1}
          value={currentTimeIndex}
          onChange={handleSliderChange}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, #00d2d3 0%, #00d2d3 ${(currentTimeIndex / (timeSeriesData.length - 1)) * 100}%, #1e293b ${(currentTimeIndex / (timeSeriesData.length - 1)) * 100}%, #1e293b 100%)`,
          }}
        />
        
        <div className="flex justify-between mt-1 px-1">
          {timeSeriesData.filter((_, i) => i % Math.ceil(timeSeriesData.length / 8) === 0).map((data, i) => (
            <span
              key={i}
              className="text-xs text-gray-500 font-mono"
            >
              {new Date(data.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
