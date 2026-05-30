import React from 'react';
import { GameEvent, ActionLog } from '@/types';
import { formatTime, getEventTypeLabel, getActionTypeLabel } from '@/engine/evidenceRecorder';
import { Mic, Headphones, Volume2, AlertTriangle, Sliders, VolumeX, Zap } from 'lucide-react';

interface TimelineProps {
  events: GameEvent[];
  actions: ActionLog[];
}

interface TimelineItem {
  id: string;
  timestamp: number;
  type: 'event' | 'action';
  data: GameEvent | ActionLog;
}

export const Timeline: React.FC<TimelineProps> = ({ events, actions }) => {
  const items: TimelineItem[] = [
    ...events.map(e => ({ id: e.id, timestamp: e.timestamp, type: 'event' as const, data: e })),
    ...actions.map(a => ({ id: a.id, timestamp: a.timestamp, type: 'action' as const, data: a })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'feedback': return <Mic className="text-red-400" size={16} />;
      case 'monitor_request': return <Headphones className="text-blue-400" size={16} />;
      case 'imbalance': return <Volume2 className="text-yellow-400" size={16} />;
      case 'clipping': return <AlertTriangle className="text-orange-400" size={16} />;
      default: return <AlertTriangle size={16} />;
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'fader_move': return <Sliders className="text-green-400" size={16} />;
      case 'mute': return <VolumeX className="text-purple-400" size={16} />;
      case 'solo': return <Zap className="text-yellow-400" size={16} />;
      case 'master_adjust': return <Volume2 className="text-cyan-400" size={16} />;
      default: return <Sliders size={16} />;
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12">
        暂无时间线记录
        <p className="text-sm mt-2">完成一局游戏后可查看完整操作时间线</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700" />
      
      <div className="space-y-4">
        {items.map((item, index) => {
          const isEvent = item.type === 'event';
          const event = isEvent ? (item.data as GameEvent) : null;
          const action = !isEvent ? (item.data as ActionLog) : null;

          return (
            <div key={item.id} className="relative pl-10">
              <div className={`absolute left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                isEvent 
                  ? event?.resolved 
                    ? 'bg-green-500 border-green-400' 
                    : 'bg-red-500 border-red-400'
                  : 'bg-blue-500 border-blue-400'
              }`}>
                {isEvent ? getEventIcon(event!.type) : getActionIcon(action!.type)}
              </div>
              
              <div className={`p-3 rounded-lg ${
                isEvent 
                  ? event?.severity === 'critical'
                    ? 'bg-red-900/30 border border-red-500/30'
                    : 'bg-yellow-900/30 border border-yellow-500/30'
                  : 'bg-blue-900/20 border border-blue-500/20'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-500 font-mono">
                    {formatTime(item.timestamp)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    isEvent
                      ? 'bg-purple-900/50 text-purple-300'
                      : 'bg-cyan-900/50 text-cyan-300'
                  }`}>
                    {isEvent ? getEventTypeLabel(event!.type) : getActionTypeLabel(action!.type)}
                  </span>
                  {isEvent && (
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      event!.resolved
                        ? 'bg-green-900/50 text-green-400'
                        : 'bg-red-900/50 text-red-400'
                    }`}>
                      {event!.resolved ? '已解决' : '未解决'}
                    </span>
                  )}
                </div>
                
                {isEvent ? (
                  <p className="text-sm text-gray-300">{event!.description}</p>
                ) : (
                  <p className="text-sm text-gray-300">
                    {action!.channelId ? `CH${action!.channelId}: ` : ''}
                    {action!.type === 'fader_move' && `推子 ${action!.fromValue} → ${action!.toValue}`}
                    {action!.type === 'master_adjust' && `主输出 ${action!.fromValue} → ${action!.toValue}`}
                    {action!.type === 'mute' && `静音 ${action!.toValue === 1 ? '开启' : '关闭'}`}
                    {action!.type === 'solo' && `独奏 ${action!.toValue === 1 ? '开启' : '关闭'}`}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
