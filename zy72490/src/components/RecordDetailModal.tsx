import { X, Clock, FileText, AlertTriangle, Edit3, RotateCcw } from 'lucide-react';
import type { ScheduleRecord, HistoryVersion, ConflictItem } from '../types';
import { StatusBadge } from './StatusBadge';
import { useScheduleStore } from '../store/useScheduleStore';
import { complaintRecords } from '../data/mockData';

interface RecordDetailModalProps {
  record: ScheduleRecord;
  history: HistoryVersion[];
  conflicts: ConflictItem[];
  onClose: () => void;
}

const operationTypeLabels: Record<string, { label: string; color: string }> = {
  import: { label: '导入', color: 'bg-gray-100 text-gray-700' },
  update: { label: '更新', color: 'bg-blue-100 text-blue-700' },
  correct: { label: '人工修正', color: 'bg-supplement-100 text-supplement-700' },
  rerun: { label: '重跑', color: 'bg-primary-100 text-primary-700' },
  review: { label: '复核', color: 'bg-warning-100 text-warning-700' },
  supplement: { label: '补录', color: 'bg-amber-100 text-amber-700' },
  create: { label: '创建', color: 'bg-green-100 text-green-700' },
};

export function RecordDetailModal({ record, history, conflicts, onClose }: RecordDetailModalProps) {
  const complaintContent = complaintRecords.find((c) => c.complaintNo === record.complaintNo);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-serif font-bold text-gray-900">{record.pointName}</h2>
            <div className="flex items-center gap-3 mt-2">
              <StatusBadge status={record.status} />
              {record.hasManualCorrection && (
                <span className="inline-flex items-center gap-1 text-xs text-supplement-600 bg-supplement-50 px-2 py-1 rounded">
                  <Edit3 className="w-3 h-3" />
                  含人工修正
                </span>
              )}
              {record.hasRerun && (
                <span className="inline-flex items-center gap-1 text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded">
                  <RotateCcw className="w-3 h-3" />
                  已重跑
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">投诉编号</p>
              <p className="font-medium text-gray-900">{record.complaintNo || '无'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">补给时间</p>
              <p className="font-medium text-gray-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                {record.supplyTime}
              </p>
            </div>
          </div>

          {complaintContent && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary-600" />
                居民投诉内容
              </h3>
              <div className={`p-4 rounded-xl border ${
                complaintContent.summaryOnly
                  ? 'bg-warning-50 border-warning-200'
                  : 'bg-gray-50 border-gray-200'
              }`}>
                {complaintContent.summaryOnly && (
                  <div className="flex items-center gap-2 mb-2 text-warning-700">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-medium">仅汇总信息，无原文</span>
                  </div>
                )}
                <p className="text-sm text-gray-700">{complaintContent.content}</p>
                {complaintContent.oldCaliber && (
                  <div className="mt-2 pt-2 border-t border-warning-200">
                    <span className="text-xs font-medium text-warning-700">⚠️ 此记录为旧口径</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">备注</h3>
            <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-xl">{record.remarks}</p>
          </div>

          {conflicts.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">关联冲突项</h3>
              <div className="space-y-2">
                {conflicts.map((c) => (
                  <div
                    key={c.id}
                    className={`p-3 rounded-xl border ${
                      c.resolved
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-sm text-gray-700">{c.description}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        c.resolved
                          ? 'bg-green-200 text-green-800'
                          : 'bg-red-200 text-red-800'
                      }`}>
                        {c.resolved ? '已解决' : '未解决'}
                      </span>
                    </div>
                    {c.resolved && (
                      <p className="text-xs text-gray-500 mt-1">
                        {c.resolver} · {c.resolvedAt}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">历史版本记录</h3>
            <div className="relative">
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200"></div>
              <div className="space-y-4">
                {history.map((h) => {
                  const opConfig = operationTypeLabels[h.operationType] || operationTypeLabels.create;
                  return (
                    <div key={h.id} className="relative pl-10">
                      <div className={`absolute left-2 w-4 h-4 rounded-full ${opConfig.color} border-2 border-white shadow flex items-center justify-center`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${opConfig.color}`}>
                            {opConfig.label}
                          </span>
                          <span className="text-xs text-gray-500">v{h.version}</span>
                        </div>
                        <p className="text-sm text-gray-800">{h.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {h.operator} · {h.timestamp}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
