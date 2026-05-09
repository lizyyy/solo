import React, { useState, useRef, useEffect } from 'react';
import { Event } from '../types';

interface EventTimelineProps {
  events: Event[];
}

const getSeverityColor = (severity: Event['severity']) => {
  switch (severity) {
    case 'info': return 'border-l-blue-400 bg-blue-400/10';
    case 'warning': return 'border-l-yellow-400 bg-yellow-400/10';
    case 'error': return 'border-l-red-400 bg-red-400/10';
    case 'critical': return 'border-l-red-600 bg-red-600/20';
    default: return 'border-l-gray-400 bg-gray-400/10';
  }
};

const getSeverityBadge = (severity: Event['severity']) => {
  switch (severity) {
    case 'info': return 'bg-blue-500';
    case 'warning': return 'bg-yellow-500';
    case 'error': return 'bg-red-500';
    case 'critical': return 'bg-red-700';
    default: return 'bg-gray-500';
  }
};

export const EventTimeline: React.FC<EventTimelineProps> = ({ events }) => {
  const [filter, setFilter] = useState<string>('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const filteredEvents = events.filter((event) => {
    if (filter === 'all') return true;
    if (filter === 'warnings') return event.severity === 'warning' || event.severity === 'error' || event.severity === 'critical';
    if (filter === 'errors') return event.severity === 'error' || event.severity === 'critical';
    return event.type.includes(filter);
  });

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-300">事件时间线</h3>
        <div className="flex gap-2 items-center">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-gray-700 text-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="all">全部事件</option>
            <option value="warnings">警告及以上</option>
            <option value="errors">错误及以上</option>
          </select>
          <label className="flex items-center gap-1 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            自动滚动
          </label>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2 pr-2"
        style={{ maxHeight: '500px' }}
      >
        {filteredEvents.length === 0 ? (
          <p className="text-gray-500 text-center py-8">暂无事件</p>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className={`border-l-4 rounded-r p-3 ${getSeverityColor(event.severity)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${getSeverityBadge(event.severity)}`} />
                  <span className="text-xs text-gray-400">{formatTime(event.timestamp)}</span>
                  <span className="text-xs font-mono text-gray-500">{event.source}</span>
                </div>
                <span className="text-xs text-gray-500 font-mono">{event.type}</span>
              </div>
              <p className="text-sm text-gray-300 mt-1">{event.message}</p>
              {event.data && Object.keys(event.data).length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-500 cursor-pointer">详细数据</summary>
                  <pre className="text-xs text-gray-400 mt-1 bg-gray-900/50 p-2 rounded overflow-x-auto">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
