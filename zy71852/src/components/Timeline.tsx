import type { TimelineItem } from '@/types';
import { SourceTag } from './SourceTag';
import { StepStatusBadge } from './StatusBadge';
import { formatDateTime } from '@/utils/date';
import { Clock } from 'lucide-react';

interface TimelineProps {
  items: TimelineItem[];
}

const sourceColors: Record<string, string> = {
  student: 'bg-blue-500',
  score_sheet: 'bg-green-500',
  manual: 'bg-gray-500',
  script_mod: 'bg-purple-500',
};

export function Timeline({ items }: TimelineProps) {
  if (items.length === 0) {
    return <div className="text-center py-8 text-neutral-500">暂无记录</div>;
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-neutral-200" />

      <div className="space-y-6">
        {items.map((item, index) => (
          <div key={item.id} className="relative pl-10">
            <div
              className={`absolute left-2.5 w-3 h-3 rounded-full border-2 border-white ${sourceColors[item.source]} ${
                item.status === 'skipped' ? 'ring-2 ring-red-200' : ''
              }`}
            />

            <div
              className={`p-4 border rounded-lg bg-white transition-colors ${
                item.status === 'skipped'
                  ? 'border-red-200 bg-red-50/30'
                  : item.isSupplementary
                  ? 'border-gray-200 bg-gray-50/50 italic'
                  : 'border-neutral-200 hover:border-primary/30'
              }`}
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-semibold text-primary text-sm">
                    步骤 {item.stepNumber}
                  </span>
                  <span className="text-neutral-900 font-medium">{item.stepName}</span>
                  <SourceTag
                    source={item.source}
                    isSupplementary={item.isSupplementary}
                  />
                </div>
                <StepStatusBadge
                  status={item.status}
                  skipReason={item.skipReason}
                  skipSource={item.skipSource}
                />
              </div>

              <p
                className={`text-sm text-neutral-700 mb-3 ${
                  item.status === 'skipped' ? 'line-through text-neutral-500' : ''
                } ${item.isSupplementary ? 'italic text-neutral-600' : ''}`}
              >
                {item.content}
              </p>

              <div className="flex items-center gap-4 text-xs text-neutral-500 flex-wrap">
                <div className="flex items-center gap-1">
                  <Clock size={12} />
                  <span>实际发生：{formatDateTime(item.actualOccurredAt)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock size={12} />
                  <span>记录时间：{formatDateTime(item.recordedAt)}</span>
                </div>
                {item.timeGap && item.timeGap !== '0分钟' && (
                  <div className="text-orange-600 font-medium">
                    记录延迟：{item.timeGap}
                  </div>
                )}
                {item.operator && (
                  <div className="text-neutral-600">操作人：{item.operator}</div>
                )}
              </div>

              {index < items.length - 1 && (
                <div className="absolute left-4 bottom-0 w-0.5 h-6 bg-neutral-200" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
