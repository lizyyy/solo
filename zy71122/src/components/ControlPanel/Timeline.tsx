import { useEffect, useRef } from 'react';
import { useNetworkStore } from '@/store/useNetworkStore';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';

export function Timeline() {
  const {
    valveActions,
    timelineStep,
    isPlaying,
    setTimelineStep,
    setIsPlaying,
    stepForward,
    stepBackward,
    reset,
  } = useNetworkStore();

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying && timelineStep < valveActions.length) {
      intervalRef.current = window.setInterval(() => {
        stepForward();
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timelineStep >= valveActions.length) {
        setIsPlaying(false);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, timelineStep, valveActions.length, stepForward, setIsPlaying]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimelineStep(parseInt(e.target.value));
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border-t border-slate-700/50 px-6 py-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTimelineStep(0)}
            disabled={timelineStep === 0}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="回到开始"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={stepBackward}
            disabled={timelineStep === 0}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="上一步"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={timelineStep >= valveActions.length && valveActions.length > 0}
            className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={stepForward}
            disabled={timelineStep >= valveActions.length}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="下一步"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 w-20">
              步骤 {timelineStep}/{valveActions.length}
            </span>
            <div className="flex-1 relative">
              <input
                type="range"
                min="0"
                max={Math.max(0, valveActions.length)}
                value={timelineStep}
                onChange={handleSliderChange}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider-thumb"
              />
              <div className="absolute top-0 left-0 right-0 flex justify-between pointer-events-none">
                {valveActions.map((_, index) => (
                  <div
                    key={index}
                    className={`w-1 h-2 rounded-full ${
                      index < timelineStep
                        ? 'bg-cyan-400'
                        : index === timelineStep
                        ? 'bg-white'
                        : 'bg-slate-600'
                    }`}
                    style={{
                      marginLeft:
                        index === 0
                          ? '0'
                          : `calc(${
                              (index / valveActions.length) * 100
                            }% - 2px)`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="w-64">
          {timelineStep > 0 && valveActions[timelineStep - 1] && (
            <div className="text-xs text-slate-300">
              <span className="text-slate-500">当前操作: </span>
              <span className="text-cyan-400">
                {valveActions[timelineStep - 1].valveId}
              </span>
              <span className="text-slate-400">
                {' → '}
                {valveActions[timelineStep - 1].toStatus === 'open'
                  ? '开启'
                  : '关闭'}
              </span>
            </div>
          )}
          {timelineStep === 0 && (
            <div className="text-xs text-slate-500">初始状态 - 未进行任何操作</div>
          )}
        </div>
      </div>
    </div>
  );
}
