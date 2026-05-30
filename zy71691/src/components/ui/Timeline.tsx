import { useRef, useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronUp, ChevronDown } from 'lucide-react';
import { useYardStore } from '@/store/useYardStore';

export function Timeline() {
  const {
    currentTime,
    isPlaying,
    playbackSpeed,
    timelineEvents,
    setCurrentTime,
    setIsPlaying,
    setPlaybackSpeed,
  } = useYardStore();

  const [expanded, setExpanded] = useState(true);
  const animationRef = useRef<number>();

  const startTime = new Date(Date.now() - 4 * 3600 * 1000);
  const endTime = new Date(Date.now() + 8 * 3600 * 1000);

  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        setCurrentTime(
          new Date(currentTime.getTime() + playbackSpeed * 1000)
        );
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
  }, [isPlaying, playbackSpeed]);

  const getProgress = () => {
    const total = endTime.getTime() - startTime.getTime();
    const current = currentTime.getTime() - startTime.getTime();
    return (current / total) * 100;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = new Date(startTime.getTime() + percentage * (endTime.getTime() - startTime.getTime()));
    setCurrentTime(newTime);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const getEventPosition = (eventTime: Date) => {
    const total = endTime.getTime() - startTime.getTime();
    const eventPos = eventTime.getTime() - startTime.getTime();
    return (eventPos / total) * 100;
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'crane_start':
      case 'crane_end':
        return 'bg-green-500';
      case 'truck_arrival':
      case 'truck_departure':
        return 'bg-blue-500';
      case 'conflict':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (!expanded) {
    return (
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-slate-900/95 border-t border-slate-700 flex items-center justify-center z-20">
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 text-slate-400 hover:text-white text-sm"
        >
          <ChevronUp className="w-4 h-4" />
          展开时间轴
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-slate-900/95 border-t border-slate-700 z-20">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setCurrentTime(startTime)}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentTime(endTime)}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1">
            {[0.5, 1, 2].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  playbackSpeed === speed
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        <div className="text-sm text-white font-mono">
          {formatTime(currentTime)}
        </div>

        <button
          onClick={() => setExpanded(false)}
          className="p-1 text-slate-400 hover:text-white"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-3">
        <div className="flex justify-between text-xs text-slate-500 mb-2">
          <span>{formatTime(startTime)}</span>
          <span>现在</span>
          <span>{formatTime(endTime)}</span>
        </div>

        <div
          className="relative h-8 bg-slate-800 rounded cursor-pointer"
          onClick={handleTimelineClick}
        >
          <div
            className="absolute top-0 left-0 h-full bg-blue-600/30 rounded-l"
            style={{ width: `${getProgress()}%` }}
          />

          {timelineEvents.map((event) => {
            const pos = getEventPosition(new Date(event.timestamp));
            if (pos < 0 || pos > 100) return null;
            return (
              <div
                key={event.id}
                className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 ${getEventColor(event.type)} rounded-full cursor-pointer hover:scale-150 transition-transform`}
                style={{ left: `${pos}%` }}
                title={`${event.title}: ${event.description}`}
              />
            );
          })}

          <div
            className="absolute top-0 w-0.5 h-full bg-white"
            style={{ left: `${getProgress()}%` }}
          />
        </div>

        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-xs text-slate-400">吊机作业</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
            <span className="text-xs text-slate-400">卡车</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="text-xs text-slate-400">冲突</span>
          </div>
        </div>
      </div>
    </div>
  );
}
