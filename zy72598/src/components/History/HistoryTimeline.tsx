import { HistoryRecord } from '@/types';
import { cn } from '@/lib/utils';
import { Clock, User, Cpu } from 'lucide-react';

interface HistoryTimelineProps {
  records: HistoryRecord[];
}

export const HistoryTimeline = ({ records }: HistoryTimelineProps) => {
  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>暂无历史记录</p>
      </div>
    );
  }

  const sortedRecords = [...records].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="relative">
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

      <div className="space-y-6">
        {sortedRecords.map((record, index) => {
          const isSystem = record.operator === '系统';
          return (
            <div key={record.id} className="relative flex gap-4">
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center z-10 flex-shrink-0',
                  isSystem ? 'bg-blue-100' : 'bg-amber-100'
                )}
              >
                {isSystem ? (
                  <Cpu className="w-5 h-5 text-blue-600" />
                ) : (
                  <User className="w-5 h-5 text-amber-600" />
                )}
              </div>
              <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{record.action}</h4>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(record.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      isSystem ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    )}
                  >
                    {record.operator}
                  </span>
                </div>
                {Object.keys(record.details).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {Object.entries(record.details).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <dt className="text-gray-500">{key}:</dt>
                          <dd className="font-medium text-gray-700">
                            {typeof value === 'boolean' ? (value ? '是' : '否') : String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
