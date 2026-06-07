import { ChangeHistory } from '@/types';
import { formatDate } from '@/utils/common';
import { User, Clock } from 'lucide-react';

interface ChangeHistoryItemProps {
  history: ChangeHistory;
}

export function ChangeHistoryItem({ history }: ChangeHistoryItemProps) {
  const isCreate = history.changeType === 'create';
  const isStatus = history.changeType === 'status_change';

  const formatValue = (val: string) => {
    if (!val) return '(空)';
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed === 'object') return '(对象)';
    } catch {}
    return val.length > 80 ? val.slice(0, 80) + '...' : val;
  };

  return (
    <div className="flex gap-4 py-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
          <User size={14} className="text-primary-600" />
        </div>
        <div className="w-px flex-1 bg-primary-100 mt-2" />
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-primary-800">{history.modifiedBy}</span>
          <span className="text-primary-400">修改了</span>
          <code className="px-1.5 py-0.5 bg-primary-50 text-primary-700 text-xs font-mono rounded">
            {history.fieldName}
          </code>
          {isStatus && (
            <span className="badge bg-yellow-50 text-yellow-700 border-yellow-200">状态变更</span>
          )}
          {isCreate && (
            <span className="badge bg-green-50 text-green-700 border-green-200">创建</span>
          )}
        </div>
        {!isCreate && (
          <div className="mt-2 space-y-1">
            {history.oldValue !== '' && (
              <div className="text-xs">
                <span className="text-primary-400">修改前：</span>
                <span className="diff-remove px-1.5 py-0.5 rounded text-primary-600">
                  {formatValue(history.oldValue)}
                </span>
              </div>
            )}
            <div className="text-xs">
              <span className="text-primary-400">修改后：</span>
              <span className="diff-add px-1.5 py-0.5 rounded text-primary-700">
                {formatValue(history.newValue)}
              </span>
            </div>
          </div>
        )}
        <div className="mt-2 flex items-center gap-1 text-xs text-primary-400">
          <Clock size={12} />
          {formatDate(history.modifiedAt)}
        </div>
      </div>
    </div>
  );
}
