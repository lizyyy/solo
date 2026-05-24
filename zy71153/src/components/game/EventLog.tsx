import { useGameStore } from '../../store/useGameStore';
import { useEffect, useRef } from 'react';

export const EventLog = () => {
  const { eventLog } = useGameStore();
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [eventLog]);

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 h-full flex flex-col">
      <h3 className="text-lg font-bold text-white mb-3">📋 事件日志</h3>
      
      <div 
        ref={logRef}
        className="flex-1 overflow-y-auto space-y-2 pr-2"
        style={{ maxHeight: '300px' }}
      >
        {eventLog.map((log, index) => (
          <div 
            key={index}
            className={`text-sm p-2 rounded ${
              log.includes('错误') || log.includes('警告') 
                ? 'bg-red-500/10 text-red-400' 
                : log.includes('完成') || log.includes('恭喜')
                  ? 'bg-green-500/10 text-green-400'
                  : log.includes('【') && log.includes('】')
                    ? 'bg-yellow-500/10 text-yellow-400'
                    : 'bg-slate-700/50 text-slate-300'
            }`}
          >
            {log}
          </div>
        ))}
      </div>
    </div>
  );
};
