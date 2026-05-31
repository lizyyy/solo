import { AlertTriangle, CheckCircle, X, ChevronRight } from 'lucide-react';
import { useRecordsStore } from '../store/useRecordsStore';
import { StatusBadge } from './StatusBadge';
import { AnomalyIcon } from './TypeIcon';
import { ANOMALY_LABELS } from '../types';
import type { RecordStatus } from '../types';
import { formatTimestamp, truncateText } from '../utils/format';

export const AnomalyPanel = () => {
  const {
    showAnomalyPanel,
    toggleAnomalyPanel,
    getPendingRecords,
    selectRecord,
    updateStatus,
    selectedRecordId,
  } = useRecordsStore();

  const pendingRecords = getPendingRecords();

  if (!showAnomalyPanel) {
    return null;
  }

  const handleQuickConfirm = (id: string, status: RecordStatus) => {
    updateStatus(id, status, '快速批量确认', '李教练');
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 z-20 shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-medium text-slate-200">
            待确认记录 ({pendingRecords.length})
          </span>
        </div>
        <button
          onClick={toggleAnomalyPanel}
          className="p-1 hover:bg-slate-700 rounded transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {pendingRecords.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm">
            <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-500" />
            暂无待确认记录，所有数据已处理完毕
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {pendingRecords.map((record) => (
              <div
                key={record.id}
                className={`p-3 flex items-center gap-3 hover:bg-slate-700/30 transition-colors cursor-pointer ${
                  selectedRecordId === record.id ? 'bg-slate-700/50' : ''
                }`}
                onClick={() => selectRecord(record.id)}
              >
                {record.anomalyReason && (
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      record.anomalyReason.type === 'drift'
                        ? 'bg-red-900/50 text-red-400'
                        : record.anomalyReason.type === 'unit_mismatch'
                        ? 'bg-yellow-900/50 text-yellow-400'
                        : record.anomalyReason.type === 'constraint_override'
                        ? 'bg-purple-900/50 text-purple-400'
                        : record.anomalyReason.type === 'late_attachment'
                        ? 'bg-orange-900/50 text-orange-400'
                        : 'bg-blue-900/50 text-blue-400'
                    }`}
                  >
                    <AnomalyIcon type={record.anomalyReason.type} className="w-4 h-4" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-orange-400 font-medium">
                      {record.anomalyReason
                        ? ANOMALY_LABELS[record.anomalyReason.type]
                        : '待确认'}
                    </span>
                    <StatusBadge status={record.status} size="sm" />
                  </div>
                  <h4 className="text-sm text-slate-200 truncate">{record.title}</h4>
                  {record.anomalyReason && (
                    <p className="text-xs text-slate-400 truncate">
                      {truncateText(record.anomalyReason.description, 60)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickConfirm(record.id, 'normal');
                    }}
                    className="p-1.5 hover:bg-green-900/30 rounded transition-colors group"
                    title="标记为正常"
                  >
                    <CheckCircle className="w-4 h-4 text-slate-500 group-hover:text-green-400" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickConfirm(record.id, 'corrected');
                    }}
                    className="p-1.5 hover:bg-blue-900/30 rounded transition-colors group"
                    title="标记为已更正"
                  >
                    <CheckCircle className="w-4 h-4 text-slate-500 group-hover:text-blue-400" />
                  </button>
                  <div className="w-px h-4 bg-slate-700 mx-1" />
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500 font-mono">
                      {formatTimestamp(record.timestamp)}
                    </div>
                    <div className="text-[10px] text-slate-600">{record.author}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
