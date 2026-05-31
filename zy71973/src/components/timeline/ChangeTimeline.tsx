import React from 'react';
import { Check, X, Clock, Copy, Edit3 } from 'lucide-react';
import { ChangeHistory, STATUS_LABELS, RecordStatus } from '@/types';
import { formatDate } from '@/utils/export';

interface ChangeTimelineProps {
  history: ChangeHistory[];
}

const getStatusIcon = (status: RecordStatus) => {
  switch (status) {
    case 'approved':
      return <Check className="w-4 h-4 text-green-600" />;
    case 'rejected':
      return <X className="w-4 h-4 text-red-600" />;
    case 'pending':
      return <Clock className="w-4 h-4 text-orange-600" />;
    case 'duplicate':
      return <Copy className="w-4 h-4 text-gray-600" />;
    case 'manual':
      return <Edit3 className="w-4 h-4 text-blue-600" />;
    default:
      return <Clock className="w-4 h-4 text-gray-600" />;
  }
};

const getStatusColor = (status: RecordStatus | null) => {
  switch (status) {
    case 'approved':
      return 'border-green-500 bg-green-50';
    case 'rejected':
      return 'border-red-500 bg-red-50';
    case 'pending':
      return 'border-orange-500 bg-orange-50';
    case 'duplicate':
      return 'border-gray-500 bg-gray-50';
    case 'manual':
      return 'border-blue-500 bg-blue-50';
    default:
      return 'border-gray-300 bg-gray-50';
  }
};

const ChangeTimeline: React.FC<ChangeTimelineProps> = ({ history }) => {
  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        暂无变更历史
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((item, index) => (
        <div key={item.id} className="relative pl-8">
          {index < history.length - 1 && (
            <div className="absolute left-[11px] top-6 w-0.5 h-full bg-gray-200" />
          )}
          <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center ${getStatusColor(item.toStatus)}`}>
            {getStatusIcon(item.toStatus)}
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {item.operatorName}
                </span>
                <span className="text-sm text-gray-500">
                  {item.fromStatus
                    ? `${STATUS_LABELS[item.fromStatus]} → ${STATUS_LABELS[item.toStatus]}`
                    : `新建 → ${STATUS_LABELS[item.toStatus]}`}
                </span>
              </div>
              <span className="text-xs text-gray-400">
                {formatDate(item.createdAt)}
              </span>
            </div>
            <p className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-2">
              {item.reason}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChangeTimeline;
