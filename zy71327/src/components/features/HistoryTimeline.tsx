import { useState } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronDown, ChevronUp, User, Clock } from 'lucide-react';
import type { HistoryRecord } from '@/types';
import { ACTION_LABELS } from '@/types';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface HistoryTimelineProps {
  records: HistoryRecord[];
}

export const HistoryTimeline = ({ records }: HistoryTimelineProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const typeLabels: Record<string, string> = {
    samplePack: '采样包',
    track: '曲目',
    credential: '曲目',
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>暂无历史记录</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
      
      <div className="space-y-4">
        {records.map((record, index) => (
          <div key={record.id} className="relative pl-10">
            <div
              className={cn(
                'absolute left-2 w-5 h-5 rounded-full border-4 border-white shadow-sm',
                record.action === 'create'
                  ? 'bg-[#4A7C59]'
                  : record.action === 'delete'
                  ? 'bg-[#B85450]'
                  : 'bg-[#6B8E9F]'
              )}
            />
            <Card className="overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpand(record.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-[#1A1A2E]">
                        {ACTION_LABELS[record.action]}
                        {typeLabels[record.entityType]}
                      </span>
                      {record.notes && (
                        <span className="text-sm text-gray-500">— {record.notes}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {record.operator}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(record.timestamp), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                      </span>
                    </div>
                  </div>
                  {record.beforeData && (
                    <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                      {expandedId === record.id ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  )}
                </div>

                {expandedId === record.id && record.beforeData && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    {record.beforeData && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">变更前</p>
                        <pre className="text-xs bg-gray-100 p-3 rounded-lg overflow-x-auto">
                          {JSON.stringify(record.beforeData, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">变更后</p>
                      <pre className="text-xs bg-gray-100 p-3 rounded-lg overflow-x-auto">
                        {JSON.stringify(record.afterData, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};
