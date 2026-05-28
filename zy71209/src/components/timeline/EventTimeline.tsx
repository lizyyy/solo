import type { TimelineEvent } from '../../types';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface EventTimelineProps {
  events: TimelineEvent[];
}

const typeIcons: Record<TimelineEvent['type'], string> = {
  supplement: '💰',
  marginCall: '📢',
  extension: '📅',
  disposal: '📋',
  status: '🔄',
};

const statusLabels: Record<string, string> = {
  pending: '待处理',
  received: '已到账',
  cancelled: '已取消',
  approved: '已通过',
  rejected: '已拒绝',
  sent: '已发送',
  duplicate: '重复',
  draft: '草稿',
  submitted: '已提交',
  completed: '已完成',
};

export function EventTimeline({ events }: EventTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">操作时间线</h3>
        <p className="text-gray-500 text-sm text-center py-8">暂无操作记录</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">操作时间线</h3>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
        <div className="space-y-6">
          {events.map((event) => (
            <div key={event.id} className="relative pl-10">
              <div
                className="absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 border-white shadow"
                style={{ backgroundColor: event.color + '20' }}
              >
                <span>{typeIcons[event.type]}</span>
              </div>
              <div
                className={`p-4 rounded-lg border-l-4 bg-gray-50`}
                style={{ borderLeftColor: event.color }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{event.title}</span>
                    {event.status && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: event.color + '20',
                          color: event.color,
                        }}
                      >
                        {statusLabels[event.status] || event.status}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {format(new Date(event.date), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{event.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
