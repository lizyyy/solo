import { useState } from 'react';
import type { TimelineRecord } from '@/types';
import { formatTime, formatTimeShort } from '@/utils/time';
import { Badge } from '@/components/common/Badge';
import { AlertCircle, User, Scissors, Megaphone } from 'lucide-react';

interface TimelineItemProps {
  record: TimelineRecord;
  pixelsPerSecond: number;
  isSelected: boolean;
  hasAnomaly: boolean;
  onClick: () => void;
  animationDelay: number;
}

const trackColors = {
  guest: { bg: 'bg-track-guest/20', border: 'border-track-guest', text: 'text-track-guest' },
  clip: { bg: 'bg-track-clip/20', border: 'border-track-clip', text: 'text-track-clip' },
  ad: { bg: 'bg-track-ad/20', border: 'border-track-ad', text: 'text-track-ad' },
};

const statusColors = {
  confirmed: 'bg-status-confirmed/80',
  pending: 'bg-status-pending/80',
  manual: 'bg-status-manual/80',
};

const trackIcons = {
  guest: User,
  clip: Scissors,
  ad: Megaphone,
};

export function TimelineItem({
  record,
  pixelsPerSecond,
  isSelected,
  hasAnomaly,
  onClick,
  animationDelay,
}: TimelineItemProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const colors = trackColors[record.type];
  const Icon = trackIcons[record.type];

  const left = record.startTime * pixelsPerSecond;
  const width = Math.max(record.duration * pixelsPerSecond, 8);
  const minWidth = 60;
  const displayWidth = Math.max(width, minWidth);

  return (
    <div
      className={`timeline-item ${colors.border} ${colors.bg} ${isSelected ? 'ring-2 ring-text-primary' : ''} ${hasAnomaly ? 'animate-pulse-slow' : ''}`}
      style={{
        left: `${left}px`,
        width: `${displayWidth}px`,
        animationDelay: `${animationDelay}ms`,
      }}
      onClick={onClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={`absolute top-0 left-0 w-1 h-full ${statusColors[record.status]}`} />

      <div className="h-full px-2 py-1 flex items-center gap-1 overflow-hidden">
        <Icon className={`w-3 h-3 flex-shrink-0 ${colors.text}`} />
        {width > 80 && (
          <span className="text-xs text-text-primary truncate font-medium">
            {record.title}
          </span>
        )}
        {hasAnomaly && (
          <AlertCircle className="w-3 h-3 flex-shrink-0 text-status-anomaly" />
        )}
      </div>

      {width > 120 && (
        <div className="absolute bottom-1 right-1 code-text text-text-muted text-[10px]">
          {formatTimeShort(record.duration)}
        </div>
      )}

      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-bg-primary border border-border-primary shadow-lg pointer-events-none animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <Icon className={`w-4 h-4 ${colors.text}`} />
            <span className="font-medium text-text-primary">{record.title}</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-text-muted">类型</span>
              <span className="text-text-secondary capitalize">
                {record.type === 'guest' ? '嘉宾' : record.type === 'clip' ? '剪辑点' : '广告'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">开始时间</span>
              <span className="text-text-secondary font-mono">{formatTime(record.startTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">时长</span>
              <span className="text-text-secondary font-mono">{formatTime(record.duration)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-muted">状态</span>
              <Badge variant={record.status} className="text-[10px]">
                {record.status === 'confirmed' ? '已确认' : record.status === 'pending' ? '待补' : '人工更正'}
              </Badge>
            </div>
            {record.meta?.speakerName && (
              <div className="flex justify-between">
                <span className="text-text-muted">嘉宾</span>
                <span className="text-text-secondary">{record.meta.speakerName}</span>
              </div>
            )}
            {record.meta?.adClient && (
              <div className="flex justify-between">
                <span className="text-text-muted">广告客户</span>
                <span className="text-text-secondary">{record.meta.adClient}</span>
              </div>
            )}
          </div>
          {record.description && (
            <div className="mt-2 pt-2 border-t border-border-primary text-xs text-text-secondary">
              {record.description}
            </div>
          )}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-bg-primary border-r border-b border-border-primary rotate-45" />
        </div>
      )}
    </div>
  );
}
