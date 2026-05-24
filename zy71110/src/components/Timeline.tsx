import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

export function Timeline() {
  const isPlaying = useStore((state) => state.isPlaying);
  const timeProgress = useStore((state) => state.timeProgress);
  const setIsPlaying = useStore((state) => state.setIsPlaying);
  const setTimeProgress = useStore((state) => state.setTimeProgress);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!isPlaying) return;

    const animate = () => {
      setTimeProgress((prev) => {
        const next = prev + 0.005;
        if (next >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return next;
      });
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, setIsPlaying, setTimeProgress]);

  const handleReset = () => {
    setIsPlaying(false);
    setTimeProgress(0);
  };

  const handleEnd = () => {
    setIsPlaying(false);
    setTimeProgress(1);
  };

  return (
    <div className="h-16 bg-gray-900 bg-opacity-90 flex items-center px-6 gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={handleReset}
          className="p-2 text-white hover:bg-white hover:bg-opacity-10 rounded-lg transition-colors"
          title="重置"
        >
          <SkipBack size={20} />
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button
          onClick={handleEnd}
          className="p-2 text-white hover:bg-white hover:bg-opacity-10 rounded-lg transition-colors"
          title="结束"
        >
          <SkipForward size={20} />
        </button>
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-3">
          <span className="text-white text-sm w-16">
            {Math.round(timeProgress * 100)}%
          </span>
          <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden relative">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all"
              style={{ width: `${timeProgress * 100}%` }}
            ></div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={timeProgress}
              onChange={(e) => {
                setIsPlaying(false);
                setTimeProgress(parseFloat(e.target.value));
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <span className="text-gray-400 text-xs">喷灌进度</span>
        </div>
      </div>

      <div className="text-white text-sm">
        <span className="text-gray-400">时间: </span>
        {Math.floor(timeProgress * 60)}s
      </div>
    </div>
  );
}
