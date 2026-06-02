import React, { useEffect, useRef } from 'react';
import { History, Play } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { TimelineEventItem } from './TimelineEvent';

export const Timeline: React.FC = () => {
  const { session, selectedEventId, setSelectedEventId, replayMode, replayEventIndex, startReplay } = useGameStore();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && session?.events.length) {
      if (replayMode) {
        const activeEl = containerRef.current.querySelector('[data-replay-active="true"]');
        if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }
  }, [session?.events.length, replayMode, replayEventIndex]);

  if (!session) {
    return (
      <div className="industrial-panel p-4 h-full flex flex-col">
        <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
          <History size={18} />
          时间线
        </h3>
        <div className="flex-1 flex items-center justify-center text-industrial-muted text-sm">
          开始演练后显示操作记录
        </div>
      </div>
    );
  }

  const visibleEvents = replayMode
    ? session.events.slice(0, replayEventIndex + 1)
    : session.events;

  const latestProblemId = session.events
    .filter((e) => e.type === 'problem_start')
    .pop()?.problemId;

  return (
    <div className="industrial-panel p-4 h-full flex flex-col">
      <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
        <History size={18} />
        时间线
        <span className="ml-auto text-sm font-normal text-industrial-muted">
          {session.events.length} 条记录
        </span>
      </h3>

      {session.notes.length > 0 && (
        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg">
          <div className="text-xs text-blue-400 font-semibold mb-1">📝 备注 ({session.notes.length})</div>
          <div className="space-y-2">
            {session.notes.map((note, idx) => (
              <div key={idx} className="text-xs">
                <span className="text-industrial-muted">{note.author}：</span>
                <span className="text-industrial-text">{note.content}</span>
                {note.isSupplementary && (
                  <span className="text-amber-400 ml-1">*补录</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto scrollbar-thin pr-2 space-y-1"
      >
        {session.events.length === 0 ? (
          <div className="text-center text-industrial-muted text-sm py-8">
            暂无操作记录
          </div>
        ) : (
          visibleEvents.map((event, idx) => (
            <div
              key={event.id}
              data-replay-active={replayMode && idx === replayEventIndex ? 'true' : undefined}
            >
              <TimelineEventItem
                event={event}
                isSelected={selectedEventId === event.id}
                isActive={replayMode ? idx === replayEventIndex : event.problemId === latestProblemId}
                onClick={() => setSelectedEventId(selectedEventId === event.id ? null : event.id)}
              />
            </div>
          ))
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-industrial-border">
        {session.status === 'completed' && !replayMode && session.events.length > 0 && (
          <button
            onClick={startReplay}
            className="w-full industrial-button-secondary flex items-center justify-center gap-2 mb-3"
          >
            <Play size={16} />
            回放演练
          </button>
        )}
        <div className="text-xs text-industrial-muted space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>正确</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span>规则误解</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <span>操作超时</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            <span>备注</span>
          </div>
        </div>
      </div>
    </div>
  );
};
