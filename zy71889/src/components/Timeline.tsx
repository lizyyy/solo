import type { TimelineEvent } from '@shared/types';
import { TimelineEventCard } from './TimelineEventCard';
import { formatDate } from '@/lib/api';

interface TimelineProps {
  events: TimelineEvent[];
  onEventClick?: (event: TimelineEvent) => void;
  highlightedEventId?: string;
}

export function Timeline({ events, onEventClick, highlightedEventId }: TimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-ink-400">
        <p className="font-serif text-lg mb-2">暂无时间线数据</p>
        <p className="text-sm">导入实验数据或添加批改意见后将显示在这里</p>
      </div>
    );
  }

  const groupedByDate = events.reduce((groups, event) => {
    const date = formatDate(event.timestamp);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(event);
    return groups;
  }, {} as Record<string, TimelineEvent[]>);

  return (
    <div className="relative">
      {Object.entries(groupedByDate).map(([date, dateEvents], dateIndex) => (
        <div key={date} className="mb-8 last:mb-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-ink-200" />
            <h3 className="font-serif text-sm text-ink-500 font-medium px-3 py-1 bg-ink-50 border border-ink-200">
              {date}
            </h3>
            <div className="h-px flex-1 bg-ink-200" />
          </div>
          <div className="relative pl-8">
            <div className="timeline-line" />
            {dateEvents.map((event, index) => (
              <div
                key={event.id}
                className="relative mb-6 last:mb-0"
                style={{
                  animation: `fade-in-up 0.4s ease-out ${(dateIndex * dateEvents.length + index) * 0.05}s both`,
                }}
              >
                <TimelineEventCard
                  event={event}
                  onClick={() => onEventClick?.(event)}
                  isHighlighted={highlightedEventId === event.id}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
