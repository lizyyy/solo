import { History, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { OperationLog, OperationTypeLabel, RecordStatusLabel } from '../../types';

interface OperationHistoryProps {
  logs: OperationLog[];
}

export default function OperationHistory({ logs }: OperationHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <History className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">操作历史</h3>
          <span className="text-sm text-gray-500">({logs.length} 条记录)</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {isExpanded && (
        <div className="border-t border-gray-200">
          <div className="divide-y divide-gray-100">
            {[...logs].reverse().map((log) => (
              <div key={log.id} className="px-6 py-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-primary-100 text-primary-700">
                      {OperationTypeLabel[log.type]}
                    </span>
                    <span className="text-sm text-gray-600">操作人: {log.operator}</span>
                  </div>
                  <span className="text-xs text-gray-400">{log.createdAt}</span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{log.diffNote}</p>
                {(log.oldStatus || log.newStatus) && (
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-gray-500">状态变更:</span>
                    {log.oldStatus && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {RecordStatusLabel[log.oldStatus]}
                      </span>
                    )}
                    <span className="text-gray-400">→</span>
                    {log.newStatus && (
                      <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded font-medium">
                        {RecordStatusLabel[log.newStatus]}
                      </span>
                    )}
                  </div>
                )}
                {(log.oldAmount !== undefined || log.newAmount !== undefined) && (
                  <div className="flex items-center space-x-2 text-xs mt-1">
                    <span className="text-gray-500">金额变更:</span>
                    {log.oldAmount !== undefined && (
                      <span className="text-gray-600">¥{log.oldAmount.toLocaleString()}</span>
                    )}
                    <span className="text-gray-400">→</span>
                    {log.newAmount !== undefined && (
                      <span className="text-primary-700 font-medium">¥{log.newAmount.toLocaleString()}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
