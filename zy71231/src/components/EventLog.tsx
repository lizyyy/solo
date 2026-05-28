import React from 'react';
import type { GameEvent } from '../types/game';

interface EventLogProps {
  events: GameEvent[];
}

export const EventLog: React.FC<EventLogProps> = ({ events }) => {
  const getEventColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-100 border-green-300 text-green-800';
      case 'warning': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'danger': return 'bg-red-100 border-red-300 text-red-800';
      default: return 'bg-blue-100 border-blue-300 text-blue-800';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'danger': return '🚨';
      default: return 'ℹ️';
    }
  };

  const recentEvents = events.slice(-15).reverse();

  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      <h2 className="text-lg font-bold text-gray-800 mb-4">📋 事件日志</h2>
      
      {recentEvents.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <p className="text-3xl mb-2">📝</p>
          <p className="text-sm">暂无事件记录</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {recentEvents.map((event) => (
            <div
              key={event.id}
              className={`p-3 rounded-lg border ${getEventColor(event.type)}`}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">{getEventIcon(event.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{event.message}</p>
                  <p className="text-xs mt-1 opacity-75">💡 {event.suggestion}</p>
                  <p className="text-xs mt-1 opacity-50">来源: {event.source}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
