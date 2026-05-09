import { Event } from '@/types';
import { Calendar, Users, Clock, Edit, Trash2, Eye } from 'lucide-react';
import dayjs from 'dayjs';

interface EventCardProps {
  event: Event;
  onView: (id: string) => void;
  onEdit: (event: Event) => void;
  onCancel: (event: Event) => void;
}

export function EventCard({ event, onView, onEdit, onCancel }: EventCardProps) {
  const statusBadgeClass = {
    draft: 'badge-draft',
    active: 'badge-active',
    cancelled: 'badge-cancelled',
    completed: 'badge-completed',
  }[event.status];

  return (
    <div className="event-card">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-semibold text-gray-900 flex-1">{event.title}</h3>
        <span className={`badge ${statusBadgeClass}`}>
          {event.status.toUpperCase()}
        </span>
      </div>

      {event.description && (
        <p className="text-gray-600 mb-4 line-clamp-2">{event.description}</p>
      )}

      <div className="space-y-2 mb-4">
        <div className="flex items-center text-sm text-gray-600">
          <Calendar className="w-4 h-4 mr-2" />
          {dayjs(event.startTime).format('YYYY-MM-DD HH:mm')}
          <span className="mx-2">-</span>
          {dayjs(event.endTime).format('HH:mm')}
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <Users className="w-4 h-4 mr-2" />
          {event.currentParticipants} / {event.maxParticipants} 人
        </div>
        <div className="flex items-center text-sm text-gray-500">
          <Clock className="w-4 h-4 mr-2" />
          版本: {event.version}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onView(event.id)}
          className="btn-secondary flex items-center text-sm"
        >
          <Eye className="w-4 h-4 mr-1" />
          查看
        </button>
        {event.status !== 'cancelled' && event.status !== 'completed' && (
          <>
            <button
              onClick={() => onEdit(event)}
              className="btn-primary flex items-center text-sm"
            >
              <Edit className="w-4 h-4 mr-1" />
              编辑
            </button>
            <button
              onClick={() => onCancel(event)}
              className="btn-danger flex items-center text-sm"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              取消
            </button>
          </>
        )}
      </div>
    </div>
  );
}
