import React, { useRef, useEffect } from 'react';
import { GameEvent } from '../game/types';
import { formatTime } from '../utils/export';
import { ScrollText } from 'lucide-react';

interface EventLogProps {
  events: GameEvent[];
}

const EventLog: React.FC<EventLogProps> = ({ events }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const getEventStyle = (event: GameEvent) => {
    if (event.scoreChange < 0) {
      return 'border-l-warning bg-warning/10';
    }
    if (event.scoreChange > 0) {
      return 'border-l-success bg-success/10';
    }
    switch (event.type) {
      case 'warning': return 'border-l-vip bg-vip/10';
      case 'block': return 'border-l-warning bg-warning/10';
      case 'pass': return 'border-l-success bg-success/10';
      default: return 'border-l-navy-500 bg-navy-800/50';
    }
  };

  return (
    <div className="h-full flex flex-col bg-navy-800/50 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-navy-700">
        <ScrollText className="w-4 h-4 text-gray-400" />
        <span className="font-medium">事件日志</span>
        <span className="ml-auto text-xs text-gray-500">{events.length}条</span>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2"
      >
        {events.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            暂无事件记录
          </div>
        ) : (
          events.map(event => (
            <div
              key={event.id}
              className={`p-3 rounded-lg border-l-4 transition-all ${getEventStyle(event)} 
                ${event.needReview && !event.reviewed ? 'ring-1 ring-vip/50' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm">{event.description}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span className="mono-font">{formatTime(event.timestamp)}</span>
                    <span>•</span>
                    <span>{event.channel === 'vip' ? 'VIP通道' : '普通通道'}</span>
                    {event.needReview && (
                      <>
                        <span>•</span>
                        <span className="text-vip">待核对</span>
                      </>
                    )}
                  </div>
                </div>
                {event.scoreChange !== 0 && (
                  <span className={`text-sm font-bold mono-font ${
                    event.scoreChange > 0 ? 'text-success' : 'text-warning'
                  }`}>
                    {event.scoreChange > 0 ? '+' : ''}{event.scoreChange}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EventLog;
