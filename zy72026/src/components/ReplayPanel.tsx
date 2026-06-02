import React, { useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, X } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { formatSessionTime } from '../utils/diffCalculator';

export const ReplayPanel: React.FC = () => {
  const {
    session,
    replayMode,
    replayEventIndex,
    isReplayPlaying,
    replayAutoPlay,
    replayPause,
    replayNext,
    replayPrev,
    replayGoTo,
    exitReplay,
  } = useGameStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isReplayPlaying) {
      intervalRef.current = setInterval(() => {
        const state = useGameStore.getState();
        if (state.replayEventIndex >= (state.session?.events.length ?? 0) - 1) {
          useGameStore.getState().replayPause();
          return;
        }
        state.replayNext();
      }, 1200);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isReplayPlaying]);

  if (!replayMode || !session || session.events.length === 0) return null;

  const total = session.events.length;
  const current = replayEventIndex;
  const progress = total > 1 ? (current / (total - 1)) * 100 : 100;
  const currentEvent = session.events[current];

  const eventLabel = (() => {
    if (!currentEvent) return '';
    switch (currentEvent.type) {
      case 'session_start': return '演练开始';
      case 'problem_start': return `开始：${currentEvent.data.problemTitle || ''}`;
      case 'player_choice': return `选择：${currentEvent.data.optionLabel || currentEvent.data.optionId}`;
      case 'judgment': {
        const j = currentEvent.data as { isCorrect?: boolean; failureType?: string };
        return j.isCorrect ? '判断：正确' : `判断：${j.failureType === 'operation_timeout' ? '操作超时' : '规则误解'}`;
      }
      case 'timeout': return '超时';
      case 'note_added': return '添加备注';
      case 'control_action': return `控制：${currentEvent.data.action}`;
      case 'session_end': return '演练结束';
      default: return currentEvent.type;
    }
  })();

  return (
    <div className="industrial-panel p-4 border-t-2 border-amber-500/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-amber-600/30 text-amber-400 text-xs font-semibold rounded animate-pulse">
            回放模式
          </span>
          <span className="text-xs text-industrial-muted">
            {current + 1} / {total}
          </span>
        </div>
        <button
          onClick={exitReplay}
          className="text-industrial-muted hover:text-red-400 p-1 transition-colors"
          title="退出回放"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mb-3">
        <div className="text-sm text-industrial-text truncate mb-1">{eventLabel}</div>
        {currentEvent && (
          <div className="text-[10px] text-industrial-muted font-mono">
            {formatSessionTime(currentEvent.sessionTime)}
          </div>
        )}
      </div>

      <div className="relative mb-3 group cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const ratio = Math.max(0, Math.min(1, x / rect.width));
          const idx = Math.round(ratio * (total - 1));
          replayGoTo(idx);
        }}
      >
        <div className="h-2 bg-industrial-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-amber-400 border-2 border-industrial-bg rounded-full shadow-lg shadow-amber-500/30 transition-all duration-200"
          style={{ left: `calc(${progress}% - 8px)` }}
        />
      </div>

      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => replayGoTo(0)}
          className="industrial-button-secondary p-2"
          title="回到开头"
        >
          <SkipBack size={16} />
        </button>
        <button
          onClick={replayPrev}
          disabled={current === 0}
          className="industrial-button-secondary p-2 disabled:opacity-30"
          title="上一步"
        >
          ‹
        </button>
        <button
          onClick={isReplayPlaying ? replayPause : replayAutoPlay}
          className="industrial-button-primary p-2 w-10 h-10 flex items-center justify-center"
          title={isReplayPlaying ? '暂停回放' : '自动播放'}
        >
          {isReplayPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          onClick={replayNext}
          disabled={current >= total - 1}
          className="industrial-button-secondary p-2 disabled:opacity-30"
          title="下一步"
        >
          ›
        </button>
        <button
          onClick={() => replayGoTo(total - 1)}
          className="industrial-button-secondary p-2"
          title="跳到结尾"
        >
          <SkipForward size={16} />
        </button>
      </div>
    </div>
  );
};
