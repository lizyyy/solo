import React from 'react';
import {
  Clock,
  User,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  ArrowRight,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { StateTransition, CaseStatus } from '../../shared/types';
import { STATUS_LABELS, STATUS_COLORS } from '../../shared/types';

type TimelineItemType = 'success' | 'warning' | 'danger' | 'info' | 'default';

interface TimelineItem {
  id: string;
  status?: CaseStatus;
  title?: string;
  timestamp: string;
  operator?: string;
  reason?: string;
  type?: TimelineItemType;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
}

interface StatusTimelineProps {
  items: (TimelineItem | StateTransition)[];
  className?: string;
  maxHeight?: string;
}

const typeColors: Record<TimelineItemType, string> = {
  success: 'bg-green-500 border-green-500',
  warning: 'bg-amber-500 border-amber-500',
  danger: 'bg-red-500 border-red-500',
  info: 'bg-blue-500 border-blue-500',
  default: 'bg-slate-400 border-slate-400',
};

const typeIcons: Record<TimelineItemType, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
  default: Info,
};

function getTimelineType(status?: CaseStatus): TimelineItemType {
  if (!status) return 'default';
  const successStatuses: CaseStatus[] = ['confirmed', 'normal_repayment', 'in_repayment', 'settled'];
  const warningStatuses: CaseStatus[] = ['pending_confirmation', 'overdue', 're_overdue'];
  const dangerStatuses: CaseStatus[] = ['confirmation_failed', 'legal_action', 'confirmation_withdrawn'];
  const infoStatuses: CaseStatus[] = ['in_collection', 'in_negotiation'];

  if (successStatuses.includes(status)) return 'success';
  if (warningStatuses.includes(status)) return 'warning';
  if (dangerStatuses.includes(status)) return 'danger';
  if (infoStatuses.includes(status)) return 'info';
  return 'default';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const StatusTimeline: React.FC<StatusTimelineProps> = ({
  items,
  className,
  maxHeight = '500px',
}) => {
  const getStatusColor = (status?: CaseStatus) => {
    if (!status) return '';
    const colorMap: Record<CaseStatus, string> = {
      pending_confirmation: 'bg-slate-500',
      confirmed: 'bg-green-500',
      confirmation_failed: 'bg-red-500',
      normal_repayment: 'bg-blue-500',
      overdue: 'bg-orange-500',
      in_collection: 'bg-amber-500',
      in_negotiation: 'bg-purple-500',
      legal_action: 'bg-red-600',
      in_repayment: 'bg-cyan-500',
      settled: 'bg-emerald-500',
      confirmation_withdrawn: 'bg-rose-500',
      re_overdue: 'bg-red-500',
    };
    return colorMap[status] || 'bg-slate-500';
  };

  return (
    <div className={cn('relative', className)}>
      <div
        className="overflow-y-auto"
        style={{ maxHeight }}
      >
        <div className="relative pl-8">
          {/* Vertical Line */}
          <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-slate-200" />

          {items.map((item, index) => {
            const isStateTransition = 'fromStatus' in item && 'toStatus' in item;
            
            let timelineItem: TimelineItem;
            if (isStateTransition) {
              const transition = item as StateTransition;
              timelineItem = {
                id: transition.id,
                status: transition.toStatus,
                timestamp: transition.timestamp,
                operator: transition.operatorName,
                reason: transition.reason,
                type: getTimelineType(transition.toStatus),
              };
            } else {
              timelineItem = item as TimelineItem;
            }

            const type = timelineItem.type || getTimelineType(timelineItem.status);
            const Icon = timelineItem.icon || typeIcons[type];
            const color = timelineItem.color || typeColors[type];
            const statusColor = timelineItem.status ? getStatusColor(timelineItem.status) : color;
            const isLast = index === items.length - 1;

            return (
              <div key={timelineItem.id} className="relative pb-8 last:pb-0">
                {/* Timeline Dot */}
                <div
                  className={cn(
                'absolute left-0 top-0 w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center z-10',
                color.split(' ')[1]
              )}
                >
                  <div className={cn('w-3 h-3 rounded-full', statusColor)} />
                </div>

                {/* Content */}
                <div className="ml-4">
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-2">
                    <div className="flex-1">
                      {isStateTransition ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium text-white',
                            STATUS_COLORS[(item as StateTransition).fromStatus]
                          )}>
                            {STATUS_LABELS[(item as StateTransition).fromStatus]}
                          </span>
                          <ArrowRight className="w-4 h-4 text-slate-400" />
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium text-white',
                            STATUS_COLORS[(item as StateTransition).toStatus]
                          )}>
                            {STATUS_LABELS[(item as StateTransition).toStatus]}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Icon className={cn('w-4 h-4', color.split(' ')[0].replace('bg-', 'text-'))} />
                          <span className="font-medium text-slate-800">
                            {timelineItem.title || (timelineItem.status && STATUS_LABELS[timelineItem.status])}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Meta Info */}
                  <div className="flex items-center gap-4 text-sm text-slate-500 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      <span>{formatDate(timelineItem.timestamp)}</span>
                    </div>
                    {timelineItem.operator && (
                      <div className="flex items-center gap-1.5">
                        <User className="w-4 h-4" />
                        <span>{timelineItem.operator}</span>
                      </div>
                    )}
                  </div>

                  {/* Reason */}
                  {timelineItem.reason && (
                    <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 border border-slate-100">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <span className="font-medium text-slate-500 mr-1">变更原因：</span>
                        <span>{timelineItem.reason}</span>
                      </div>
                    </div>
                  )}

                  {/* Transition Type Badge */}
                  {isStateTransition && (item as StateTransition).transitionType && (
                    <div className="mt-2">
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
                        (item as StateTransition).transitionType === 'normal'
                          ? 'bg-green-50 text-green-700'
                          : (item as StateTransition).transitionType === 'reverse'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                      )}>
                        {(item as StateTransition).transitionType === 'normal' && '正常流转'}
                        {(item as StateTransition).transitionType === 'reverse' && '逆向流转'}
                        {(item as StateTransition).transitionType === 'exception' && '异常流转'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Connector Line */}
                {!isLast && (
                  <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-slate-200" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StatusTimeline;
