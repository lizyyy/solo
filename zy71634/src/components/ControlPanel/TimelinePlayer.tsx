
import { useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Gauge } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const TimelinePlayer = () => {
  const timeRange = useAppStore((state) => state.timeRange);
  const currentTime = useAppStore((state) => state.currentTime);
  const isPlaying = useAppStore((state) => state.isPlaying);
  const playSpeed = useAppStore((state) => state.playSpeed);
  const togglePlaying = useAppStore((state) => state.togglePlaying);
  const setCurrentTime = useAppStore((state) => state.setCurrentTime);
  const setPlaySpeed = useAppStore((state) => state.setPlaySpeed);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        setCurrentTime((prev) => {
          const next = prev + playSpeed * 3600000;
          if (next > timeRange[1]) {
            return timeRange[0];
          }
          return next;
        });
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, playSpeed, timeRange]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };

  const progress = ((currentTime - timeRange[0]) / (timeRange[1] - timeRange[0])) * 100;

  const handleSkipBack = () => {
    setCurrentTime(Math.max(timeRange[0], currentTime - 86400000));
  };

  const handleSkipForward = () => {
    setCurrentTime(Math.min(timeRange[1], currentTime + 86400000));
  };

  return (
    <div className="p-3 border-t border-slate-700/50">
      <div className="flex items-center gap-2 mb-3">
        <Gauge size={16} className="text-indigo-400" />
        <span className="text-white text-sm font-semibold">时间轴</span>
      </div>

      <div className="mb-3">
        <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
          <input
            type="range"
            min={timeRange[0]}
            max={timeRange[1]}
            value={currentTime}
            onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-slate-500 text-xs">{formatDate(timeRange[0])}</span>
          <span className="text-indigo-400 text-xs font-mono">{formatDate(currentTime)}</span>
          <span className="text-slate-500 text-xs">{formatDate(timeRange[1])}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={handleSkipBack}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={togglePlaying}
            className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-500 transition-colors"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            onClick={handleSkipForward}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <SkipForward size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-xs">速度:</span>
          <div className="flex gap-1">
            {[0.5, 1, 2, 4].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaySpeed(speed)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  playSpeed === speed
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
