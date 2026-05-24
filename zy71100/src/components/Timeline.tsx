import { useRef, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useStore } from '../store/useStore';

export function Timeline() {
  const {
    currentTime,
    setCurrentTime,
    isPlaying,
    togglePlay,
    playbackSpeed,
    timeRange,
    setTimeRange,
    pickingOrders,
  } = useStore();

  const progressRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const dataTimeRange = useMemo(() => {
    if (pickingOrders.length === 0) {
      return { start: Date.now(), end: Date.now() + 3600000 };
    }
    const startTimes = pickingOrders.map((o) => o.startTime);
    const endTimes = pickingOrders.map((o) => o.endTime);
    return {
      start: Math.min(...startTimes),
      end: Math.max(...endTimes),
    };
  }, [pickingOrders]);

  const totalDuration = dataTimeRange.end - dataTimeRange.start;
  const progress = totalDuration > 0
    ? ((currentTime - dataTimeRange.start) / totalDuration) * 100
    : 0;

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const updateTimeFromMouse = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!progressRef.current || totalDuration <= 0) return;
      const rect = progressRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const newTime = dataTimeRange.start + percentage * totalDuration;
      setCurrentTime(newTime);
    },
    [setCurrentTime, totalDuration, dataTimeRange]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      updateTimeFromMouse(e);
    },
    [updateTimeFromMouse]
  );

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
    if (!isPlaying || totalDuration <= 0) return;

    const increment = playbackSpeed * 1000;
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + increment;
        if (next >= dataTimeRange.end) {
          return dataTimeRange.start;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, setCurrentTime, dataTimeRange, totalDuration]);

  const orderMarkers = useMemo(
    () =>
      pickingOrders.map((order) => ({
        id: order.id,
        color: order.color,
        start: totalDuration > 0
          ? ((order.startTime - dataTimeRange.start) / totalDuration) * 100
          : 0,
        end: totalDuration > 0
          ? ((order.endTime - dataTimeRange.start) / totalDuration) * 100
          : 0,
      })),
    [pickingOrders, dataTimeRange, totalDuration]
  );

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
              onClick={() => setCurrentTime(dataTimeRange.start)}
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
              onClick={() => setCurrentTime(dataTimeRange.end)}
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
                      width: `${Math.max(marker.end - marker.start, 0.5)}%`,
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
              <span>{formatTime(dataTimeRange.start)}</span>
              <span>{formatTime((dataTimeRange.start + dataTimeRange.end) / 2)}</span>
              <span>{formatTime(dataTimeRange.end)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
