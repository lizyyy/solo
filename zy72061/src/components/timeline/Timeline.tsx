import { useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Gauge } from 'lucide-react';
import { useGaitStore } from '../../store/useGaitStore';

export default function Timeline() {
  const {
    frames,
    currentFrameIndex,
    isPlaying,
    playSpeed,
    setCurrentFrameIndex,
    setIsPlaying,
    setPlaySpeed,
  } = useGaitStore();
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      const interval = 1000 / (10 * playSpeed);

      if (delta >= interval) {
        lastTimeRef.current = timestamp;
        setCurrentFrameIndex(
          currentFrameIndex >= frames.length - 1 ? 0 : currentFrameIndex + 1,
        );
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, currentFrameIndex, playSpeed, frames.length, setCurrentFrameIndex]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentFrameIndex(parseInt(e.target.value));
  };

  const handlePrevFrame = () => {
    setCurrentFrameIndex(currentFrameIndex - 1);
  };

  const handleNextFrame = () => {
    setCurrentFrameIndex(currentFrameIndex + 1);
  };

  const formatTime = (frameNumber: number) => {
    const time = frameNumber * 0.1;
    return time.toFixed(1) + 's';
  };

  const anomalyCount = frames[currentFrameIndex]?.points.filter((p) => p.isAnomaly).length || 0;

  return (
    <div className="h-20 bg-gray-900 border-t border-gray-700 flex items-center px-6 gap-6">
      <div className="flex items-center gap-2">
        <button
          onClick={handlePrevFrame}
          disabled={currentFrameIndex === 0}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SkipBack size={20} />
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button
          onClick={handleNextFrame}
          disabled={currentFrameIndex === frames.length - 1}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SkipForward size={20} />
        </button>
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>帧 {currentFrameIndex + 1} / {frames.length}</span>
          <span>{formatTime(currentFrameIndex)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={currentFrameIndex}
          onChange={handleSliderChange}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentFrameIndex / (frames.length - 1)) * 100}%, #374151 ${(currentFrameIndex / (frames.length - 1)) * 100}%, #374151 100%)`,
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Gauge size={16} className="text-gray-400" />
          <select
            value={playSpeed}
            onChange={(e) => setPlaySpeed(parseFloat(e.target.value))}
            className="bg-gray-700 text-white text-sm rounded px-2 py-1 border-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </div>

        {anomalyCount > 0 && (
          <div className="flex items-center gap-1 px-3 py-1 bg-orange-600/20 text-orange-400 rounded-full text-xs">
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
            当前帧 {anomalyCount} 个异常
          </div>
        )}
      </div>
    </div>
  );
}
