import { useCallback, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Gauge,
  Eye,
  RotateCcw,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { useAppStore } from '@/store';

export const TimelineController = () => {
  const {
    isPlaying,
    currentTime,
    totalDuration,
    playbackSpeed,
    cameraView,
    setIsPlaying,
    setCurrentTime,
    setPlaybackSpeed,
    setCameraView
  } = useAppStore();

  const progressRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        setCurrentTime(currentTime + 0.05 * playbackSpeed);
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, currentTime, setCurrentTime]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    setCurrentTime(percentage * totalDuration);
  }, [totalDuration, setCurrentTime]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const speedOptions = [0.5, 1, 2, 4];
  const viewOptions = [
    { value: 'orbit', label: '环绕' },
    { value: 'firstPerson', label: '第一人称' },
    { value: 'topDown', label: '俯视' }
  ];

  return (
    <div className="h-20 bg-slate-900 border-t border-slate-700 flex items-center px-4 gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrentTime(0)}
          className="p-2 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          title="回到开始"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-3 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        
        <button
          onClick={() => setCurrentTime(totalDuration)}
          className="p-2 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          title="跳到结束"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 w-12 text-right font-mono">
            {formatTime(currentTime)}
          </span>
          
          <div
            ref={progressRef}
            onClick={handleProgressClick}
            className="flex-1 h-2 bg-slate-700 rounded-full cursor-pointer relative group"
          >
            <div
              className="absolute inset-y-0 left-0 bg-cyan-500 rounded-full transition-all"
              style={{ width: `${(currentTime / totalDuration) * 100}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${(currentTime / totalDuration) * 100}% - 8px)` }}
            />
            <div 
              className="absolute inset-0 flex items-center"
              style={{ pointerEvents: 'none' }}
            >
              <div 
                className="h-4 w-0.5 bg-cyan-400/50"
                style={{ left: `${(currentTime / totalDuration) * 100}%` }}
              />
            </div>
          </div>
          
          <span className="text-xs text-slate-400 w-12 font-mono">
            {formatTime(totalDuration)}
          </span>
        </div>
        
        <div className="h-6 mt-1">
          <div className="h-full flex items-center">
            <div className="h-1.5 w-full bg-slate-800 rounded-full relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 opacity-30"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-slate-400" />
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            {speedOptions.map(speed => (
              <option key={speed} value={speed}>{speed}x</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-slate-400" />
          <select
            value={cameraView}
            onChange={(e) => setCameraView(e.target.value as any)}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            {viewOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setCurrentTime(0)}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs text-white transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          重置
        </button>
      </div>
    </div>
  );
};
