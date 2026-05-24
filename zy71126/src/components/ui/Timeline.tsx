import { Play, Pause, SkipBack, SkipForward, Clock, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/appStore';

export function Timeline() {
  const { timelineStates, currentTimelineIndex, setTimelineIndex } = useAppStore();
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;
    if (timelineStates.length === 0) {
      setIsPlaying(false);
      return;
    }

    const interval = setInterval(() => {
      setTimelineIndex(
        currentTimelineIndex >= timelineStates.length - 1 ? 0 : currentTimelineIndex + 1
      );
    }, 1500);

    return () => clearInterval(interval);
  }, [isPlaying, currentTimelineIndex, timelineStates.length, setTimelineIndex]);

  const handlePrev = () => {
    if (currentTimelineIndex > 0) {
      setTimelineIndex(currentTimelineIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentTimelineIndex < timelineStates.length - 1) {
      setTimelineIndex(currentTimelineIndex + 1);
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 h-20 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 flex items-center px-4 z-10">
      <div className="flex items-center gap-4 w-full">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-slate-400" />
          <span className="text-slate-300 text-sm font-medium">时间轴</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            disabled={timelineStates.length === 0 || currentTimelineIndex <= 0}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={timelineStates.length === 0}
            className={`p-2 rounded-lg transition-colors ${
              isPlaying
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            onClick={handleNext}
            disabled={timelineStates.length === 0 || currentTimelineIndex >= timelineStates.length - 1}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <SkipForward size={16} />
          </button>
        </div>

        <div className="flex-1 flex items-center gap-2 overflow-x-auto py-2">
          {timelineStates.length === 0 ? (
            <div className="text-slate-500 text-sm flex items-center gap-2">
              <span>暂无保存的状态</span>
              <span className="text-slate-600">|</span>
              <span>点击"保存状态"按钮记录当前布局</span>
            </div>
          ) : (
            timelineStates.map((state, index) => (
              <button
                key={state.id}
                onClick={() => setTimelineIndex(index)}
                className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs transition-all ${
                  index === currentTimelineIndex
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <div className="font-medium">{state.name}</div>
                <div className="opacity-70 text-[10px]">
                  {new Date(state.timestamp).toLocaleTimeString()}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="text-slate-500 text-xs min-w-24 text-right">
          {timelineStates.length > 0
            ? `${currentTimelineIndex + 1} / ${timelineStates.length}`
            : '0 状态'}
        </div>
      </div>
    </div>
  );
}
