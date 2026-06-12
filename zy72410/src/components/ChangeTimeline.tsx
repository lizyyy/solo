import type { RehearsalChange, HistoryRecord } from '../types';

interface ChangeTimelineProps {
  changes: RehearsalChange[];
  history: HistoryRecord[];
}

export default function ChangeTimeline({ changes, history }: ChangeTimelineProps) {
  const allEvents = [
    ...changes.map(c => ({
      id: c.id,
      type: 'change' as const,
      time: c.created_at,
      operator: c.operator,
      fieldName: c.field_name,
      oldValue: c.old_value,
      newValue: c.new_value,
      reason: c.change_reason,
      trackId: c.track_id,
    })),
    ...history.map(h => ({
      id: h.id,
      type: 'history' as const,
      time: h.created_at,
      operator: h.operator,
      fieldName: h.field_name,
      oldValue: h.old_value,
      newValue: h.new_value,
      reason: h.change_reason,
      trackId: h.track_id,
      snapshot: h.record_snapshot,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const fieldLabels: Record<string, string> = {
    track_remarks: '轨道备注',
    license_end_date: '授权截止日期',
    episode_count: '集数',
    license_fee: '授权费用',
    revenue_ratio: '分成比例',
    error_tolerance: '误差说明',
    status: '状态',
  };

  return (
    <div className="space-y-4">
      {allEvents.length === 0 ? (
        <p className="text-center text-studio-silver py-8 font-mono text-sm">
          暂无变更记录
        </p>
      ) : (
        allEvents.map((event, index) => (
          <div key={event.id} className="relative pl-8 pb-6">
            {index < allEvents.length - 1 && (
              <div className="absolute left-[7px] top-4 bottom-0 w-0.5 bg-studio-gray" />
            )}
            
            <div className={`absolute left-0 top-1 timeline-dot ${
              event.type === 'change' ? 'active' : ''
            }`} />

            <div className="card-studio p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    event.type === 'change' 
                      ? 'bg-studio-gold/20 text-studio-gold' 
                      : 'bg-studio-gray/50 text-studio-silver'
                  }`}>
                    {event.type === 'change' ? '排练变更' : '历史快照'}
                  </span>
                  <span className="text-studio-gold font-mono text-sm">
                    {fieldLabels[event.fieldName] || event.fieldName}
                  </span>
                </div>
                <span className="text-xs text-studio-silver font-mono">
                  {event.time}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="bg-studio-darker rounded p-2">
                  <p className="text-xs text-status-reused mb-1">原值</p>
                  <p className="text-sm font-mono text-white">{event.oldValue || '—'}</p>
                </div>
                <div className="bg-studio-darker rounded p-2 border-l-2 border-studio-gold">
                  <p className="text-xs text-studio-gold mb-1">新值</p>
                  <p className="text-sm font-mono text-white">{event.newValue || '—'}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-studio-silver">
                  操作人: <span className="text-white">{event.operator}</span>
                </span>
                {event.reason && (
                  <span className="text-studio-silver">
                    原因: <span className="text-white">{event.reason}</span>
                  </span>
                )}
              </div>

              {event.trackId && (
                <div className="mt-2 text-xs text-studio-silver font-mono">
                  轨道ID: {event.trackId}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
