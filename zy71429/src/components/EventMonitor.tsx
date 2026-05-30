import { useState, useMemo } from 'react';
import { AlertTriangle, AlertOctagon, Fuel, CheckCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { GameEvent, EventType, EVENT_LABELS } from '@/types/game';
import { cn } from '@/lib/utils';

const EVENT_STYLES: Record<EventType, { border: string; bg: string; iconBg: string }> = {
  window_missed: {
    border: 'border-red-500',
    bg: 'bg-red-50',
    iconBg: 'bg-red-500',
  },
  tug_conflict: {
    border: 'border-orange-500',
    bg: 'bg-orange-50',
    iconBg: 'bg-orange-500',
  },
  fuel_insufficient: {
    border: 'border-amber-500',
    bg: 'bg-amber-50',
    iconBg: 'bg-amber-500',
  },
  berthing_success: {
    border: 'border-green-500',
    bg: 'bg-green-50',
    iconBg: 'bg-green-500',
  },
  resource_locked: {
    border: 'border-blue-500',
    bg: 'bg-blue-50',
    iconBg: 'bg-blue-500',
  },
  weather_changed: {
    border: 'border-purple-500',
    bg: 'bg-purple-50',
    iconBg: 'bg-purple-500',
  },
  schedule_created: {
    border: 'border-slate-500',
    bg: 'bg-slate-50',
    iconBg: 'bg-slate-500',
  },
  schedule_cancelled: {
    border: 'border-slate-500',
    bg: 'bg-slate-50',
    iconBg: 'bg-slate-500',
  },
  game_start: {
    border: 'border-slate-500',
    bg: 'bg-slate-50',
    iconBg: 'bg-slate-500',
  },
  game_end: {
    border: 'border-slate-500',
    bg: 'bg-slate-50',
    iconBg: 'bg-slate-500',
  },
};

const getEventIcon = (type: EventType) => {
  switch (type) {
    case 'window_missed':
      return <AlertOctagon className="w-4 h-4 text-white" />;
    case 'tug_conflict':
      return <AlertTriangle className="w-4 h-4 text-white" />;
    case 'fuel_insufficient':
      return <Fuel className="w-4 h-4 text-white" />;
    case 'berthing_success':
      return <CheckCircle className="w-4 h-4 text-white" />;
    default:
      return <Info className="w-4 h-4 text-white" />;
  }
};

const getEventCategory = (type: EventType): 'missed' | 'conflict' | 'fuel' | 'success' | 'info' => {
  switch (type) {
    case 'window_missed':
      return 'missed';
    case 'tug_conflict':
      return 'conflict';
    case 'fuel_insufficient':
      return 'fuel';
    case 'berthing_success':
      return 'success';
    default:
      return 'info';
  }
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

interface EventItemProps {
  event: GameEvent;
  isPinned: boolean;
  ships: Array<{ id: string; name: string }>;
  berths: Array<{ id: string; name: string }>;
  tugs: Array<{ id: string; name: string }>;
}

function EventItem({ event, isPinned, ships, berths, tugs }: EventItemProps) {
  const [expanded, setExpanded] = useState(false);
  const style = EVENT_STYLES[event.type];
  const category = getEventCategory(event.type);

  const shipName = ships.find((s) => s.id === event.shipId)?.name;
  const berthName = berths.find((b) => b.id === (event.rawData.berthId as string))?.name;
  const tugName = tugs.find((t) => t.id === event.tugId)?.name;

  return (
    <div
      className={cn(
        'event-item rounded-lg border-l-4 p-3 mb-2 transition-all duration-200',
        style.border,
        style.bg,
        `event-${category}`,
        isPinned && 'ring-2 ring-red-300 ring-offset-1'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2 flex-1">
          <div className={cn('w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5', style.iconBg)}>
            {getEventIcon(event.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-white/80 text-gray-700">
                {EVENT_LABELS[event.type]}
              </span>
              <span className="text-xs text-gray-500">{formatTime(event.timestamp)}</span>
              {isPinned && (
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-100 text-red-700">
                  置顶
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 mt-1 line-clamp-2">{event.description}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {shipName && (
                <span className="text-xs px-2 py-0.5 rounded bg-white/80 text-gray-600">
                  船舶: {shipName}
                </span>
              )}
              {berthName && (
                <span className="text-xs px-2 py-0.5 rounded bg-white/80 text-gray-600">
                  泊位: {berthName}
                </span>
              )}
              {tugName && (
                <span className="text-xs px-2 py-0.5 rounded bg-white/80 text-gray-600">
                  拖轮: {tugName}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-2 p-1 hover:bg-white/50 rounded transition-colors flex-shrink-0"
        >
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="mb-2">
            <span className="text-xs font-medium text-gray-500">事件ID:</span>
            <span className="text-xs text-gray-700 ml-2 font-mono">{event.id}</span>
          </div>
          <div className="mb-2">
            <span className="text-xs font-medium text-gray-500">优先级:</span>
            <span className="text-xs text-gray-700 ml-2">{event.priority}</span>
          </div>
          <div className="mb-2">
            <span className="text-xs font-medium text-gray-500">状态:</span>
            <span className={cn(
              'text-xs ml-2 px-2 py-0.5 rounded',
              event.resolved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            )}>
              {event.resolved ? '已处理' : '待处理'}
            </span>
          </div>
          {event.scheduleId && (
            <div className="mb-2">
              <span className="text-xs font-medium text-gray-500">调度ID:</span>
              <span className="text-xs text-gray-700 ml-2 font-mono">{event.scheduleId}</span>
            </div>
          )}
          <div>
            <span className="text-xs font-medium text-gray-500 block mb-1">原始数据:</span>
            <pre className="text-xs bg-white/80 p-2 rounded overflow-x-auto text-gray-700 max-h-32 overflow-y-auto">
              {JSON.stringify(event.rawData, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EventMonitor() {
  const events = useGameStore((state) => state.getEventsSortedByPriority());
  const ships = useGameStore((state) => state.ships);
  const berths = useGameStore((state) => state.berths);
  const tugs = useGameStore((state) => state.tugs);

  const { pinnedEvents, otherEvents } = useMemo(() => {
    const pinned = events.filter((e) => e.type === 'window_missed');
    const others = events.filter((e) => e.type !== 'window_missed');
    return { pinnedEvents: pinned, otherEvents: others };
  }, [events]);

  const stats = useMemo(() => {
    return events.reduce(
      (acc, event) => {
        acc.total++;
        const category = getEventCategory(event.type);
        acc[category]++;
        return acc;
      },
      { total: 0, missed: 0, conflict: 0, fuel: 0, success: 0, info: 0 }
    );
  }, [events]);

  const shipList = ships.map((s) => ({ id: s.id, name: s.name }));
  const berthList = berths.map((b) => ({ id: b.id, name: b.name }));
  const tugList = tugs.map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">事件监控</h2>
        <div className="grid grid-cols-5 gap-2 text-center">
          <div className="p-2 rounded bg-gray-50">
            <div className="text-lg font-bold text-gray-800">{stats.total}</div>
            <div className="text-xs text-gray-500">总数</div>
          </div>
          <div className="p-2 rounded bg-red-50">
            <div className="text-lg font-bold text-red-600">{stats.missed}</div>
            <div className="text-xs text-gray-500">错过窗口</div>
          </div>
          <div className="p-2 rounded bg-orange-50">
            <div className="text-lg font-bold text-orange-600">{stats.conflict}</div>
            <div className="text-xs text-gray-500">资源冲突</div>
          </div>
          <div className="p-2 rounded bg-amber-50">
            <div className="text-lg font-bold text-amber-600">{stats.fuel}</div>
            <div className="text-xs text-gray-500">燃油不足</div>
          </div>
          <div className="p-2 rounded bg-green-50">
            <div className="text-lg font-bold text-green-600">{stats.success}</div>
            <div className="text-xs text-gray-500">成功靠泊</div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {pinnedEvents.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
              <AlertOctagon className="w-4 h-4 text-red-500" />
              紧急事件 ({pinnedEvents.length})
            </h3>
            {pinnedEvents.map((event) => (
              <EventItem
                key={event.id}
                event={event}
                isPinned={true}
                ships={shipList}
                berths={berthList}
                tugs={tugList}
              />
            ))}
          </div>
        )}
        {otherEvents.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">其他事件 ({otherEvents.length})</h3>
            {otherEvents.map((event) => (
              <EventItem
                key={event.id}
                event={event}
                isPinned={false}
                ships={shipList}
                berths={berthList}
                tugs={tugList}
              />
            ))}
          </div>
        )}
        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Info className="w-12 h-12 mb-2" />
            <p>暂无事件</p>
          </div>
        )}
      </div>
    </div>
  );
}
