import type { ReviewRecord } from '../types';
import { getDecisionLabel, getDecisionColor, formatDate, getStatusLabel } from '../utils/format';

interface ReviewHistoryProps {
  history: ReviewRecord[];
  className?: string;
}

export default function ReviewHistory({ history, className = '' }: ReviewHistoryProps) {
  if (history.length === 0) {
    return (
      <div className={`p-6 text-center ${className}`}>
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-gray-500">暂无复核记录</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {history.map((record, idx) => (
        <div key={record.id} className="relative pl-8 pb-4">
          {idx < history.length - 1 && (
            <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-gray-200" />
          )}
          
          <div className="absolute left-0 top-1 w-6 h-6 bg-white border-2 border-gray-300 rounded-full flex items-center justify-center">
            <div className={`w-2 h-2 rounded-full ${
              record.decision === 'approve' ? 'bg-green-500' :
              record.decision === 'reject' ? 'bg-red-500' : 'bg-yellow-500'
            }`} />
          </div>

          <div className="card p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className={`font-medium ${getDecisionColor(record.decision)}`}>
                  {getDecisionLabel(record.decision)}
                </span>
                <span className="mx-2 text-gray-400">·</span>
                <span className="text-sm text-gray-600">{record.reviewer}</span>
              </div>
              <span className="text-xs text-gray-500">{formatDate(record.timestamp)}</span>
            </div>
            
            <div className="text-sm text-gray-600 mb-2">
              状态变更: 
              <span className="mx-1 text-gray-500">{getStatusLabel(record.previousStatus)}</span>
              <svg className="inline w-4 h-4 text-gray-400 mx-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span className="text-gray-700 font-medium">{getStatusLabel(record.newStatus)}</span>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">复核证据</p>
              <p className="text-sm text-gray-700">{record.evidence}</p>
            </div>

            {record.comments && (
              <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-600 mb-1">备注</p>
                <p className="text-sm text-blue-800">{record.comments}</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
