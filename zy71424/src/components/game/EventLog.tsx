import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Mic, Volume2, Headphones, CheckCircle, XCircle } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { GameEvent } from '@/types';
import { formatTime, getEventTypeLabel } from '@/engine/evidenceRecorder';

const EventItem: React.FC<{ event: GameEvent; onResolve: () => void }> = ({ event, onResolve }) => {
  const getIcon = () => {
    switch (event.type) {
      case 'feedback': return <Mic className="text-red-400" size={16} />;
      case 'monitor_request': return <Headphones className="text-blue-400" size={16} />;
      case 'imbalance': return <Volume2 className="text-yellow-400" size={16} />;
      case 'clipping': return <AlertTriangle className="text-red-500" size={16} />;
      default: return <AlertTriangle size={16} />;
    }
  };

  const getBgColor = () => {
    if (event.resolved) return 'bg-gray-800/50 border-gray-700';
    if (event.severity === 'critical') return 'bg-red-900/30 border-red-500/50';
    return 'bg-yellow-900/30 border-yellow-500/50';
  };

  return (
    <div className={`p-3 rounded-lg border transition-all ${getBgColor()} ${!event.resolved ? 'animate-pulse' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-mono">
              {formatTime(event.timestamp)}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              event.resolved 
                ? 'bg-green-900/50 text-green-400' 
                : event.severity === 'critical' 
                  ? 'bg-red-900/50 text-red-400' 
                  : 'bg-yellow-900/50 text-yellow-400'
            }`}>
              {getEventTypeLabel(event.type)}
            </span>
            {event.resolved ? (
              <CheckCircle size={14} className="text-green-400" />
            ) : (
              <XCircle size={14} className="text-red-400" />
            )}
          </div>
          <p className="text-sm text-gray-300 mt-1">{event.description}</p>
          {event.channelId && (
            <p className="text-xs text-gray-500 mt-1">
              关联声道: CH{event.channelId}
            </p>
          )}
        </div>
        {!event.resolved && (
          <button
            onClick={onResolve}
            className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-all flex-shrink-0"
          >
            已处理
          </button>
        )}
      </div>
    </div>
  );
};

export const EventLog: React.FC = () => {
  const events = useGameStore(state => state.events);
  const resolveEvent = useGameStore(state => state.resolveEvent);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="bg-gray-800/80 backdrop-blur rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-white">事件日志</h3>
        <span className="text-xs text-gray-500">
          共 {events.length} 条
        </span>
      </div>
      <div 
        ref={logRef}
        className="h-64 overflow-y-auto p-3 space-y-2"
      >
        {sortedEvents.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            暂无事件
            <p className="text-xs mt-1">开始演出后会显示调音问题</p>
          </div>
        ) : (
          sortedEvents.map(event => (
            <EventItem
              key={event.id}
              event={event}
              onResolve={() => resolveEvent(event.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};
