import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { AlertTriangle, Info, AlertCircle } from 'lucide-react';

function EventLog() {
  const state = useGameStore();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [state.logs.length]);

  return (
    <div className="card p-3 flex flex-col h-full">
      <div className="text-xs uppercase tracking-wider text-base-400 mb-2">事件日志</div>
      <div ref={ref} className="flex-1 overflow-y-auto scroll-thin space-y-1 pr-1 text-xs">
        {state.logs.map((log, i) => {
          const color =
            log.level === 'error'
              ? 'text-danger'
              : log.level === 'warn'
              ? 'text-accent'
              : 'text-base-100';
          const Icon = log.level === 'error' ? AlertCircle : log.level === 'warn' ? AlertTriangle : Info;
          return (
            <div key={i} className={`flex gap-2 ${color}`}>
              <Icon size={12} className="mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-mono opacity-70">[T+{log.minute.toFixed(1)}]</span>{' '}
                <span>{log.message}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EventLog;
