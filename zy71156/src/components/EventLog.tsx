import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { ScrollText, AlertTriangle, CheckCircle, Clock, Users, XCircle, Info } from 'lucide-react';
import type { GameEvent } from '@/types/game';

interface EventLogProps {
  events: GameEvent[];
}

export default function EventLog({ events }: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gameTime = useGameStore((state) => state.gameTime);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length, gameTime]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'fault':
        return <AlertTriangle size={14} className="text-[#ff4d4d]" />;
      case 'rescue_start':
        return <Clock size={14} className="text-[#ff8a00]" />;
      case 'rescue_complete':
        return <CheckCircle size={14} className="text-[#4caf50]" />;
      case 'timeout':
        return <XCircle size={14} className="text-[#ff4d4d]" />;
      case 'conflict':
        return <AlertTriangle size={14} className="text-[#ffc107]" />;
      case 'mood_change':
        return <Users size={14} className="text-[#ffc107]" />;
      case 'info':
      default:
        return <Info size={14} className="text-[#2196f3]" />;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getEventBg = (type: string) => {
    switch (type) {
      case 'fault':
        return 'bg-[#ff4d4d]/10 border-l-[#ff4d4d]';
      case 'rescue_complete':
        return 'bg-[#4caf50]/10 border-l-[#4caf50]';
      case 'conflict':
        return 'bg-[#ffc107]/10 border-l-[#ffc107]';
      case 'timeout':
        return 'bg-[#ff4d4d]/10 border-l-[#ff4d4d]';
      case 'mood_change':
        return 'bg-[#ffc107]/10 border-l-[#ffc107]';
      default:
        return 'bg-[#1a2a4a] border-l-[#2196f3]';
    }
  };

  return (
    <div className="bg-[#0a1628] rounded-xl p-4 border border-[#ff8a00]/20">
      <h3 className="text-lg font-bold mb-4 text-[#ff8a00] flex items-center gap-2">
        <ScrollText size={20} />
        事件日志
      </h3>

      <div
        ref={scrollRef}
        className="space-y-2 overflow-y-auto"
        style={{ maxHeight: '300px' }}
      >
        {events.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            暂无事件
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className={`p-2 rounded border-l-4 text-sm ${getEventBg(event.type)}`}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5">{getEventIcon(event.type)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-0.5">
                    <span>[{formatTime(event.time)}]</span>
                  </div>
                  <p className="text-gray-200 text-sm">{event.message}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
