import { useGameStore } from '@/store/useGameStore';
import { getEventTypeLabel, getEventTypeColor, formatTimestamp } from '@/utils/formatUtils';
import { ChevronDown, ChevronRight, Link } from 'lucide-react';
import { useState } from 'react';

export default function EventLog() {
  const { engineState } = useGameStore();
  const { eventLog, anomalies } = engineState;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-slate-800/80 rounded-xl border border-slate-700/50 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">事件日志</h3>
        <span className="text-xs text-slate-500">{eventLog.length} 条事件</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 min-h-0" style={{ maxHeight: 'calc(100vh - 500px)' }}>
        {eventLog.length === 0 && (
          <div className="text-center text-slate-500 text-sm py-8">
            还没有事件，开始比赛后这里会实时更新
          </div>
        )}

        {eventLog.map((event, idx) => {
          const isExpanded = expandedIds.has(event.id + idx);
          const hasNegChange = Object.values(event.resourceChanges).some(v => typeof v === 'number' && v < 0);
          const typeColor = getEventTypeColor(event.type);

          return (
            <div
              key={`${event.id}-${idx}`}
              className={`rounded-lg border ${
                hasNegChange ? 'bg-red-950/20 border-red-500/20' : 'bg-slate-900/40 border-slate-700/30'
              }`}
            >
              <button
                className="w-full flex items-center gap-2 p-2.5 text-left"
                onClick={() => toggleExpand(event.id + idx)}
              >
                <span className="text-slate-500">
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                <span className="text-xs text-slate-500 font-mono">#{idx + 1}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded border ${typeColor}`}>
                  {getEventTypeLabel(event.type)}
                </span>
                <span className="text-sm text-slate-200 flex-1">{event.name}</span>
                {hasNegChange && (
                  <span className="text-xs text-red-400">负值</span>
                )}
                {event.timestamp && (
                  <span className="text-[10px] text-slate-500">
                    {formatTimestamp(event.timestamp)}
                  </span>
                )}
              </button>

              {isExpanded && (
                <div className="px-2.5 pb-2.5 pt-0 space-y-2">
                  <p className="text-xs text-slate-400">{event.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(event.resourceChanges).map(([key, val]) => (
                      <span
                        key={key}
                        className={`text-xs font-mono px-2 py-0.5 rounded ${
                          typeof val === 'number' && val < 0
                            ? 'bg-red-500/15 text-red-300'
                            : 'bg-slate-700/50 text-slate-300'
                        }`}
                      >
                        {key}: {typeof val === 'number' ? (val > 0 ? '+' : '') + val : val}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Link size={10} />
                    来源：{event.source}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {anomalies.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-red-300">异常记录</h4>
          {anomalies.map((anomaly, i) => (
            <div key={i} className="text-xs text-red-400/80 bg-red-950/20 px-2.5 py-1.5 rounded">
              {anomaly}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
