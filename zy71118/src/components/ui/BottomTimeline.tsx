import { useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Download, Save, Camera } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { cn } from '../../lib/utils';

const PLAYBACK_INTERVAL = 2000;

export function BottomTimeline() {
  const history = useAppStore((state) => state.history);
  const historyIndex = useAppStore((state) => state.historyIndex);
  const isPlaying = useAppStore((state) => state.isPlaying);
  const goToSnapshot = useAppStore((state) => state.goToSnapshot);
  const saveSnapshot = useAppStore((state) => state.saveSnapshot);
  const resetState = useAppStore((state) => state.resetState);
  const exportReport = useAppStore((state) => state.exportReport);
  const setIsPlaying = useAppStore((state) => state.setIsPlaying);
  const store = useAppStore((state) => state.store);
  const playbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isPlaying && history.length > 1) {
      playbackTimerRef.current = setInterval(() => {
        const currentIndex = useAppStore.getState().historyIndex;
        if (currentIndex < history.length - 1) {
          goToSnapshot(currentIndex + 1);
        } else {
          setIsPlaying(false);
        }
      }, PLAYBACK_INTERVAL);
    } else {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    }

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, [isPlaying, history.length, goToSnapshot, setIsPlaying]);

  if (!store) {
    return (
      <div className="h-20 bg-slate-900 border-t border-slate-700 flex items-center justify-center">
        <p className="text-slate-500 text-sm">导入数据后显示时间轴</p>
      </div>
    );
  }

  const handlePlayPause = () => {
    if (!isPlaying && historyIndex >= history.length - 1) {
      goToSnapshot(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handlePrev = () => {
    if (historyIndex > 0) {
      goToSnapshot(historyIndex - 1);
    }
  };

  const handleNext = () => {
    if (historyIndex < history.length - 1) {
      goToSnapshot(historyIndex + 1);
    }
  };

  const handleSaveSnapshot = () => {
    const label = prompt('输入快照名称:', `快照 ${history.length}`);
    if (label) {
      saveSnapshot(label);
    }
  };

  return (
    <div className="h-20 bg-slate-900 border-t border-slate-700 flex items-center px-4 gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={resetState}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          title="重置状态"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={handlePrev}
          disabled={historyIndex <= 0}
          className={cn(
            'p-2 rounded-lg transition-colors',
            historyIndex <= 0
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          )}
          title="上一快照"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={handlePlayPause}
          className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={handleNext}
          disabled={historyIndex >= history.length - 1}
          className={cn(
            'p-2 rounded-lg transition-colors',
            historyIndex >= history.length - 1
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          )}
          title="下一快照"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex items-center gap-2">
        <div className="flex items-center gap-1 overflow-x-auto py-2">
          {history.map((snapshot, index) => (
            <button
              key={snapshot.id}
              onClick={() => goToSnapshot(index)}
              className={cn(
                'flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all min-w-[80px]',
                index === historyIndex
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              )}
            >
              <div className="flex items-center gap-1">
                <Camera className="w-3 h-3" />
                <span className="truncate">{snapshot.label}</span>
              </div>
              <div className="text-[10px] opacity-70 mt-0.5">
                {new Date(snapshot.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleSaveSnapshot}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-sm"
        >
          <Save className="w-4 h-4" />
          保存快照
        </button>
        <button
          onClick={exportReport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors text-sm"
        >
          <Download className="w-4 h-4" />
          导出报告
        </button>
      </div>
    </div>
  );
}
