import React from 'react';
import { Clock, CheckCircle, AlertCircle, Upload, RotateCcw, Gavel, User } from 'lucide-react';
import { ProcessingHistory } from '../types';
import { formatDateTime } from '../utils/format';

interface TimelineProps {
  histories: ProcessingHistory[];
}

const getIcon = (action: string) => {
  if (action.includes('导入')) return <Upload className="w-4 h-4" />;
  if (action.includes('匹配')) return <User className="w-4 h-4" />;
  if (action.includes('确认')) return <CheckCircle className="w-4 h-4" />;
  if (action.includes('申诉')) return <AlertCircle className="w-4 h-4" />;
  if (action.includes('处罚')) return <Gavel className="w-4 h-4" />;
  if (action.includes('回滚')) return <RotateCcw className="w-4 h-4" />;
  return <Clock className="w-4 h-4" />;
};

const getColor = (action: string) => {
  if (action.includes('导入')) return 'bg-gray-500';
  if (action.includes('匹配')) return 'bg-blue-500';
  if (action.includes('确认')) return 'bg-green-500';
  if (action.includes('申诉')) return 'bg-orange-500';
  if (action.includes('处罚')) return 'bg-red-500';
  if (action.includes('回滚')) return 'bg-purple-500';
  return 'bg-gray-500';
};

const Timeline: React.FC<TimelineProps> = ({ histories }) => {
  const sortedHistories = [...histories].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      {sortedHistories.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">暂无处理记录</p>
        </div>
      ) : (
        <div className="space-y-0">
          {sortedHistories.map((history) => (
            <div key={history.id} className="timeline-item relative pb-6">
              <div className="flex items-start">
                <div className={`w-8 h-8 rounded-full ${getColor(history.action)} flex items-center justify-center text-white flex-shrink-0 z-10`}>
                  {getIcon(history.action)}
                </div>
                <div className="ml-3 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900">{history.action}</h4>
                    <span className="text-xs text-gray-500">{formatDateTime(history.timestamp)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">操作人：{history.operator}</p>
                  {history.remarks && (
                    <p className="text-xs text-gray-600 mt-1 bg-white px-2 py-1 rounded border">
                      {history.remarks}
                    </p>
                  )}
                  {history.oldStatus && history.newStatus && (
                    <div className="flex items-center mt-2 text-xs">
                      <span className="text-gray-500">状态变更：</span>
                      <span className={`status-badge status-${history.oldStatus} mx-1`}>
                        {history.oldStatus}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className={`status-badge status-${history.newStatus} mx-1`}>
                        {history.newStatus}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Timeline;
