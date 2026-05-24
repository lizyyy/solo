import { useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, FastForward, Clock, AlertTriangle } from 'lucide-react';
import { useScheduleStore } from '../../store/useScheduleStore';
import { ConflictDetector } from '../../engine/ConflictDetector';

export default function Timeline() {
  const {
    currentTime,
    totalDuration,
    isPlaying,
    playSpeed,
    buses,
    conflicts,
    togglePlay,
    setCurrentTime,
    setPlaySpeed,
    tick,
  } = useScheduleStore();

  const timelineRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(animationRef.current);
      return;
    }

    const animate = (time: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = time;
      const deltaTime = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      tick(deltaTime);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying, tick]);

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * totalDuration;
    setCurrentTime(newTime);
  }, [totalDuration, setCurrentTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusAtTime = (bus: typeof buses[0], time: number) => {
    if (time < bus.departureTime - 10) return 'parked';
    if (time >= bus.departureTime - 10 && time < bus.departureTime) return 'boarding';
    if (time >= bus.departureTime && time < bus.departureTime + 10) return 'departing';
    return 'departed';
  };

  const getBusBarLeft = (bus: typeof buses[0]) => {
    return ((bus.departureTime - 10) / totalDuration) * 100;
  };

  const getBusBarWidth = () => {
    return (20 / totalDuration) * 100;
  };

  const unresolvedConflicts = conflicts.filter(c => !c.resolved);

  return (
    <div className="bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentTime(0)}
              className="p-2 hover:bg-gray-700 rounded transition-colors"
              title="回到开始"
            >
              <SkipBack className="w-4 h-4 text-gray-300" />
            </button>
            <button
              onClick={togglePlay}
              className="p-2 bg-blue-600 hover:bg-blue-500 rounded transition-colors"
              title={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white" />
              )}
            </button>
            <button
              onClick={() => setCurrentTime(totalDuration)}
              className="p-2 hover:bg-gray-700 rounded transition-colors"
              title="跳到结束"
            >
              <SkipForward className="w-4 h-4 text-gray-300" />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1">
            <FastForward className="w-4 h-4 text-gray-400" />
            <select
              value={playSpeed}
              onChange={(e) => setPlaySpeed(parseFloat(e.target.value))}
              className="bg-transparent text-white text-sm focus:outline-none"
            >
              <option value={0.5} className="bg-gray-800">0.5x</option>
              <option value={1} className="bg-gray-800">1x</option>
              <option value={2} className="bg-gray-800">2x</option>
              <option value={4} className="bg-gray-800">4x</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-gray-300">
            <Clock className="w-4 h-4" />
            <span className="font-mono text-sm">
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {unresolvedConflicts.length > 0 && (
            <div className="flex items-center gap-1 text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{unresolvedConflicts.length} 个冲突</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-gray-500" />
              <span className="text-gray-400">待命</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-500" />
              <span className="text-gray-400">上车</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-orange-500" />
              <span className="text-gray-400">发车</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-500" />
              <span className="text-gray-400">已发</span>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={timelineRef}
        className="relative h-24 bg-gray-800 rounded-lg cursor-pointer overflow-hidden"
        onClick={handleTimelineClick}
      >
        <div className="absolute inset-0">
          {Array.from({ length: Math.ceil(totalDuration / 10) + 1 }).map((_, i) => {
            const time = i * 10;
            const left = (time / totalDuration) * 100;
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l border-gray-700"
                style={{ left: `${left}%` }}
              >
                <span className="absolute -bottom-1 left-1 text-xs text-gray-500 font-mono">
                  {formatTime(time)}
                </span>
              </div>
            );
          })}
        </div>

        {unresolvedConflicts.map((conflict) => (
          <div
            key={conflict.id}
            className="absolute top-0 bottom-0 bg-red-500/20 border-l-2 border-red-500 z-10"
            style={{ left: `${(conflict.time / totalDuration) * 100}%` }}
            title={`${ConflictDetector.getInstance().getConflictTypeLabel(conflict.type)}: ${conflict.description}`}
          >
            <AlertTriangle className="absolute top-1 -left-1 w-3 h-3 text-red-500" />
          </div>
        ))}

        <div className="relative h-full pt-2 pb-6">
          {[...new Set(buses.map(b => b.exitLane))].map((lane) => (
            <div
              key={lane}
              className="relative h-6 mb-1"
            >
              {buses
                .filter(b => b.exitLane === lane)
                .sort((a, b) => a.departureTime - b.departureTime)
                .map((bus) => {
                  const status = getStatusAtTime(bus, currentTime);
                  const left = getBusBarLeft(bus);
                  const width = getBusBarWidth();
                  
                  const statusColors: Record<string, string> = {
                    parked: 'bg-gray-500',
                    boarding: 'bg-blue-500',
                    departing: 'bg-orange-500',
                    departed: 'bg-green-500',
                  };

                  const hasConflict = conflicts.some(
                    c => c.involvedBuses.includes(bus.id) && !c.resolved
                  );

                  return (
                    <div
                      key={bus.id}
                      className={`absolute top-0 h-full rounded ${statusColors[status]} ${hasConflict ? 'ring-2 ring-red-500' : ''}`}
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        minWidth: '40px',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentTime(bus.departureTime);
                      }}
                    >
                      <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium truncate px-1">
                        {bus.number}
                      </span>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>

        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none"
          style={{ left: `${(currentTime / totalDuration) * 100}%` }}
        >
          <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-white rounded-full" />
        </div>
      </div>
    </div>
  );
}
