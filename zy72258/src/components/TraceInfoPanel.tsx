import { X, Clock, User, Edit3, RefreshCw } from 'lucide-react';
import type { TraceInfo, ModificationRecord } from '../types';
import { formatTimestamp } from '../utils/checksum';

interface TraceInfoPanelProps {
  traceInfo: TraceInfo;
  originalLineNumber: number;
  onClose: () => void;
}

function ModificationRecordItem({ record }: { record: ModificationRecord }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-b-0">
      <Edit3 className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-700">{record.field}</span>
          <span className="text-xs text-gray-500">
            由 <span className="font-medium">{record.operator}</span> 操作
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs font-mono">
          <span className="text-red-600 bg-red-50 px-1.5 py-0.5">
            {record.oldValue !== null && record.oldValue !== undefined ? String(record.oldValue) : '空'}
          </span>
          <span className="text-gray-400">→</span>
          <span className="text-green-600 bg-green-50 px-1.5 py-0.5">
            {record.newValue !== null && record.newValue !== undefined ? String(record.newValue) : '空'}
          </span>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {formatTimestamp(record.timestamp)}
        </div>
      </div>
    </div>
  );
}

export function TraceInfoPanel({ traceInfo, originalLineNumber, onClose }: TraceInfoPanelProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white w-[600px] max-h-[80vh] shadow-xl border-2 border-gray-200 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b-2 border-gray-200 bg-gray-50">
          <div>
            <h3 className="font-bold text-gray-800">完整追溯链路</h3>
            <p className="text-sm text-gray-500">原始行号：{originalLineNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="card-industrial p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-primary-600" />
              <h4 className="font-semibold text-gray-700">导入时间</h4>
            </div>
            <p className="font-mono text-sm text-gray-900">
              {formatTimestamp(traceInfo.importTime)}
            </p>
          </div>

          {traceInfo.reviewRecord && (
            <div className="card-industrial p-4 border-warning-500">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-warning-500" />
                <h4 className="font-semibold text-gray-700">安全员复核</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">复核人：</span>
                  <span className="font-medium text-warning-600">{traceInfo.reviewRecord.reviewer}</span>
                </div>
                <div>
                  <span className="text-gray-500">复核时间：</span>
                  <span className="font-mono">{formatTimestamp(traceInfo.reviewRecord.time)}</span>
                </div>
                <div>
                  <span className="text-gray-500">复核意见：</span>
                  <span className="text-gray-700">{traceInfo.reviewRecord.comment}</span>
                </div>
              </div>
            </div>
          )}

          <div className="card-industrial p-4">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="w-4 h-4 text-success-500" />
              <h4 className="font-semibold text-gray-700">重算版本历史</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {traceInfo.recalculationVersions.map((v, i) => (
                <span
                  key={v}
                  className={`px-2 py-1 text-xs font-mono ${
                    i === traceInfo.recalculationVersions.length - 1
                      ? 'bg-success-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {v}
                </span>
              ))}
            </div>
          </div>

          <div className="card-industrial p-4">
            <div className="flex items-center gap-2 mb-4">
              <Edit3 className="w-4 h-4 text-primary-600" />
              <h4 className="font-semibold text-gray-700">修改记录 ({traceInfo.modificationRecords.length} 条)</h4>
            </div>
            <div className="space-y-1">
              {traceInfo.modificationRecords.map((record, i) => (
                <ModificationRecordItem key={i} record={record} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
