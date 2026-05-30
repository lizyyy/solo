import { AlertTriangle, CheckCircle, Edit3, Plus, User } from 'lucide-react';
import type { CornerData, HistoryType } from '../types';

interface HistoryTimelineProps {
  corner: CornerData | null;
}

const getHistoryIcon = (type: HistoryType) => {
  switch (type) {
    case 'correction':
      return <Edit3 className="w-4 h-4" />;
    case 'issue_mark':
      return <AlertTriangle className="w-4 h-4" />;
    case 'data_add':
      return <Plus className="w-4 h-4" />;
    case 'annotation':
      return <CheckCircle className="w-4 h-4" />;
    default:
      return <CheckCircle className="w-4 h-4" />;
  }
};

const getHistoryColor = (type: HistoryType) => {
  switch (type) {
    case 'correction':
      return 'bg-amber-500 text-amber-100';
    case 'issue_mark':
      return 'bg-red-500 text-red-100';
    case 'data_add':
      return 'bg-blue-500 text-blue-100';
    case 'annotation':
      return 'bg-emerald-500 text-emerald-100';
    default:
      return 'bg-slate-500 text-slate-100';
  }
};

const getHistoryTypeText = (type: HistoryType) => {
  switch (type) {
    case 'correction':
      return '数据修正';
    case 'issue_mark':
      return '问题标记';
    case 'data_add':
      return '数据补充';
    case 'annotation':
      return '备注';
    default:
      return '操作';
  }
};

const HistoryTimeline = ({ corner }: HistoryTimelineProps) => {
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      <h2 className="text-base font-semibold text-white mb-4">历史留痕</h2>

      {!corner ? (
        <div className="text-center py-6 text-slate-500 text-sm">
          选择弯道查看历史记录
        </div>
      ) : corner.history.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-sm">
          暂无历史记录
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-slate-700"></div>

          <div className="space-y-4">
            {corner.history.map((record) => (
              <div key={record.id} className="relative pl-12">
                <div
                  className={`absolute left-2 w-7 h-7 rounded-full flex items-center justify-center ${getHistoryColor(
                    record.type
                  )}`}
                >
                  {getHistoryIcon(record.type)}
                </div>

                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-300">
                      {getHistoryTypeText(record.type)}
                    </span>
                    <span className="text-xs text-slate-500">{record.timestamp}</span>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-slate-400 mb-2">
                    <User className="w-3 h-3" />
                    <span>{record.operator}</span>
                  </div>

                  <p className="text-sm text-slate-300 mb-2">{record.reason}</p>

                  {record.oldValue !== undefined && (
                    <div className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
                      字段: <span className="text-slate-300">{record.field}</span>
                      {record.oldValue !== undefined && (
                        <span className="ml-2">
                          原值: <span className="text-red-400">{String(record.oldValue)}</span>
                        </span>
                      )}
                      {record.newValue !== undefined && (
                        <span className="ml-2">
                          新值: <span className="text-emerald-400">{String(record.newValue)}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryTimeline;
