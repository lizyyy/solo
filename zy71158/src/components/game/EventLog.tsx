import React, { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getEventColor } from '@/utils/events';

export default function EventLog() {
  const { events } = useGameStore();
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = 0;
    }
  }, [events]);

  return (
    <div className="bg-night-panel rounded-xl p-3 border border-night-border h-32">
      <h4 className="text-sm font-bold text-neon-yellow mb-2">📋 事件日志</h4>
      <div ref={logRef} className="h-20 overflow-y-auto space-y-1 custom-scrollbar">
        {events.slice(0, 20).map((event) => (
          <div
            key={event.id}
            className="text-xs px-2 py-1 rounded"
            style={{
              backgroundColor: `${getEventColor(event.type)}15`,
              color: getEventColor(event.type),
              borderLeft: `2px solid ${getEventColor(event.type)}`,
            }}
          >
            <span className="opacity-60 mr-1">R{event.round}</span>
            {event.message}
          </div>
        ))}
        {events.length === 0 && (
          <div className="text-xs text-gray-500 text-center py-2">暂无事件</div>
        )}
      </div>
    </div>
  );
}