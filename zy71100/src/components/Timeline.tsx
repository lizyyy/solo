import { useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useStore } from '../store/useStore';
import { pickingOrders, defaultTimeRange } from '../data/mockData';

export function Timeline() {
  const {
    currentTime,
    setCurrentTime,
    isPlaying,
    togglePlay,
    playbackSpeed,
    timeRange,
    setTimeRange,
  } = useStore();

  const progressRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const totalDuration = defaultTimeRange.end - defaultTimeRange.start;
  const progress = ((currentTime - defaultTimeRange.start) / totalDuration) * 100;

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    updateTimeFromMouse(e);
  }, []);

  const updateTimeFromMouse = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = defaultTimeRange.start + percentage * totalDuration;
    setCurrentTime(newTime);
  }, [setCurrentTime, totalDuration]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        updateTimeFromMouse(e);
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [updateTimeFromMouse]);

  useEffect(() => {
    if (!isPlaying) return;

    const increment = playbackSpeed * 1000;
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + increment;
        if (next >= defaultTimeRange.end) {
          return defaultTimeRange.start;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, setCurrentTime]);

  const orderMarkers = pickingOrders.map((order) => ({
    id: order.id,
    color: order.color,
    start: ((order.startTime - defaultTimeRange.start) / totalDuration) * 100,
    end: ((order.endTime - defaultTimeRange.start) / totalDuration) * 100,
  }));

  return (
    <div className="absolute bottom-0 left-0 right-0 h-24 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 z-20">
      <div className="h-full flex flex-col px-4 py-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">时间范围:</span>
            <input
              type="time"
              value={new Date(timeRange.start).toISOString().slice(11, 16)}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number);
                const newStart = new Date(timeRange.start);
                newStart.setHours(h, m, 0, 0);
                setTimeRange(newStart.getTime(), timeRange.end);
              }}
              className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-300"
            />
            <span className="text-slate-500">—</span>
            <input
              type="time"
              value={new Date(timeRange.end).toISOString().slice(11, 16)}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number);
                const newEnd = new Date(timeRange.end);
                newEnd.setHours(h, m, 0, 0);
                setTimeRange(timeRange.start, newEnd.getTime());
              }}
              className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-300"
            />
          </div>
          <div className="text-sm font-mono text-blue-400">
            {formatTime(currentTime)}
          </div>
        </div>

        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentTime(defaultTimeRange.start)}
              className="p-1.5 rounded hover:bg-slate-700 transition-colors"
              title="回到开始"
            >
              <SkipBack className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={togglePlay}
              className={`p-2 rounded transition-colors ${isPlaying ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-700 hover:bg-slate-600'}`}
            >
              {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white" />}
            </button>
            <button
              onClick={() => setCurrentTime(defaultTimeRange.end)}
              className="p-1.5 rounded hover:bg-slate-700 transition-colors"
              title="跳到结束"
            >
              <SkipForward className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="flex-1 relative">
            <div className="h-16 bg-slate-800 rounded-lg relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-8 flex items-center px-2 gap-1 overflow-hidden">
                {orderMarkers.map((marker) => (
                  <div
                    key={marker.id}
                    className="h-3 rounded-full"
                    style={{
                      width: `${Math.max(marker.end - marker.start, 1)}%`,
                      marginLeft: `${marker.start}%`,
                      backgroundColor: marker.color,
                      opacity: 0.6,
                    }}
                    title={marker.id}
                  />
                ))}
              </div>

              <div
                ref={progressRef}
                className="absolute bottom-0 left-0 right-0 h-8 bg-slate-700/50 cursor-pointer"
                onMouseDown={handleMouseDown}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/30 via-green-600/30 to-amber-600/30 opacity-50" />

                <div
                  className="absolute top-0 bottom-0 left-0 bg-blue-500/30 transition-all"
                  style={{ width: `${progress}%` }}
                />

                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-blue-400 shadow-lg shadow-blue-400/50"
                  style={{ left: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex justify-between mt-1 text-xs text-slate-500">
              <span>{formatTime(defaultTimeRange.start)}</span>
              <span>{formatTime((defaultTimeRange.start + defaultTimeRange.end) / 2)}</span>
              <span>{formatTime(defaultTimeRange.end)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
