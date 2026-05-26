import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';

export default function EventLog() {
  const state = useGameStore();
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [state.events.length]);

  const getEventColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-emerald-400 bg-emerald-900/30';
      case 'warning':
        return 'text-amber-400 bg-amber-900/30';
      case 'error':
        return 'text-red-400 bg-red-900/30';
      default:
        return 'text-sky-400 bg-sky-900/30';
    }
  };

  return (
    <div className="h-40 bg-slate-900 border-t border-slate-700 flex flex-col">
      <div className="px-3 py-2 bg-slate-800 border-b border-slate-700">
        <span className="text-xs font-semibold text-slate-400">事件日志</span>
      </div>
      <div
        ref={logRef}
        className="flex-1 overflow-y-auto p-2 space-y-1"
      >
        {state.events.map((event) => (
          <div
            key={event.id}
            className={`text-xs px-2 py-1.5 rounded ${getEventColor(event.type)}`}
          >
            <span className="font-mono text-slate-500 mr-2">T{event.turn}</span>
            {event.message}
          </div>
        ))}
      </div>
    </div>
  );
}
