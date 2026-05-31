import { AuditLog, CHANGE_TYPE_LABELS } from '../types';
import { FileText, Upload, Edit, ArrowRightCircle, Tag } from 'lucide-react';

interface AuditLogListProps {
  logs: AuditLog[];
}

const actionIcons = {
  create: FileText,
  upload: Upload,
  update: Edit,
  status_change: ArrowRightCircle,
};

export default function AuditLogList({ logs }: AuditLogListProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const sortedLogs = [...logs].sort(
    (a, b) => b.timestamp.localeCompare(a.timestamp)
  );

  return (
    <div className="space-y-3">
      {sortedLogs.map((log) => {
        const Icon = actionIcons[log.actionType];
        const isConclusion = log.changeType === 'conclusion';

        return (
          <div
            key={log.id}
            className={`p-4 rounded-lg border ${
              isConclusion
                ? 'bg-orange-50 border-orange-200'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div
                  className={`p-2 rounded-lg ${
                    isConclusion ? 'bg-orange-200' : 'bg-gray-200'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isConclusion ? 'text-orange-700' : 'text-gray-600'
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        isConclusion
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {CHANGE_TYPE_LABELS[log.changeType]}
                    </span>
                    {isConclusion && (
                      <span className="text-xs text-orange-600 font-medium">
                        ⚠️ 实质修改
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {log.reason}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    操作人：{log.operator}
                  </p>
                  {log.oldValue && log.newValue && (
                    <div className="mt-2 p-2 bg-white rounded text-xs font-mono">
                      <span className="text-red-600 line-through">
                        {log.oldValue.substring(0, 50)}...
                      </span>
                      <span className="mx-2">→</span>
                      <span className="text-green-600">
                        {log.newValue.substring(0, 50)}...
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {formatDate(log.timestamp)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
