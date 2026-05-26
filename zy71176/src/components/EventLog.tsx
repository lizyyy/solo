import { useRef, useEffect } from 'react';
import { useGameStore } from '../game/state';
import { formatTime } from '../game/rules';

const eventTypeColors: Record<string, string> = {
  guest_arrive: 'text-green-400',
  guest_depart: 'text-blue-400',
  clean_complete: 'text-cyan-400',
  extend_request: 'text-purple-400',
  complaint: 'text-red-400',
  maintenance_complete: 'text-orange-400',
  guest_left: 'text-gray-400',
};

const eventTypeIcons: Record<string, string> = {
  guest_arrive: '🚪',
  guest_depart: '👋',
  clean_complete: '🧹',
  extend_request: '🔄',
  complaint: '😠',
  maintenance_complete: '🔧',
  guest_left: '🚶',
};

export function EventLog() {
  const events = useGameStore((state) => state.events);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="bg-gray-800/50 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <span className="text-2xl">📋</span> 事件日志
      </h3>

      <div
        ref={scrollRef}
        className="h-48 overflow-y-auto space-y-2 pr-2"
      >
        {events.length === 0 ? (
          <div className="text-gray-500 text-sm py-8 text-center">暂无事件</div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="p-2 bg-gray-700/30 rounded-lg text-sm"
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">{eventTypeIcons[event.type] || '📌'}</span>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium ${eventTypeColors[event.type] || 'text-white'}`}>
                    {event.message}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatTime(event.time)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
