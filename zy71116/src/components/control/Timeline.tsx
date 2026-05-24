import { useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

export const Timeline = () => {
  const { currentRoute, timelinePosition, isPlaying, setTimelinePosition, setIsPlaying } = useAppStore();
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying && currentRoute) {
      let lastTime = performance.now();
      const animate = (currentTime: number) => {
        const delta = (currentTime - lastTime) / 1000;
        lastTime = currentTime;
        
        setTimelinePosition((prev) => {
          const next = prev + delta * 0.3;
          if (next >= 1) {
            setIsPlaying(false);
            return 1;
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
  }, [isPlaying, currentRoute, setTimelinePosition, setIsPlaying]);

  if (!currentRoute) return null;

  const waypointIndex = Math.floor(timelinePosition * currentRoute.waypoints.length);
  const currentWaypoint = currentRoute.waypoints[waypointIndex];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          当前位置: {waypointIndex + 1} / {currentRoute.waypoints.length}
        </span>
        <span className="text-xs text-gray-400">
          {(timelinePosition * 100).toFixed(0)}%
        </span>
      </div>

      <div className="relative">
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-100"
            style={{ width: `${timelinePosition * 100}%` }}
          />
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={timelinePosition}
          onChange={(e) => setTimelinePosition(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      <div className="flex justify-center gap-2">
        <button
          onClick={() => setTimelinePosition(0)}
          className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-gray-300 transition-colors"
          title="回到起点"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors shadow-lg shadow-blue-500/25"
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={() => setTimelinePosition(1)}
          className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-gray-300 transition-colors"
          title="跳到终点"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {currentWaypoint && (
        <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
          <div className="text-xs text-gray-400 mb-1">当前节点类型</div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                currentWaypoint.type === 'ramp'
                  ? 'bg-orange-500/20 text-orange-400'
                  : currentWaypoint.type === 'elevator'
                  ? 'bg-purple-500/20 text-purple-400'
                  : currentWaypoint.type === 'entrance'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {currentWaypoint.type === 'ramp'
                ? '坡道'
                : currentWaypoint.type === 'elevator'
                ? '电梯'
                : currentWaypoint.type === 'entrance'
                ? '出入口'
                : '途经点'}
            </span>
            {currentWaypoint.slope > 0 && (
              <span className="text-xs text-gray-400">
                坡度: {currentWaypoint.slope.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
