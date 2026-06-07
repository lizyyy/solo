import { useState } from 'react';
import { History as HistoryIcon, Clock, User, ChevronDown, ChevronUp, FileText, Edit3, RotateCcw, Check } from 'lucide-react';
import { useScheduleStore } from '../store/useScheduleStore';
import { StatusBadge } from '../components/StatusBadge';
import type { OperationType } from '../types';

const operationTypeConfig: Record<OperationType, { label: string; color: string; icon: any }> = {
  import: { label: '导入', color: 'bg-gray-100 text-gray-700', icon: FileText },
  update: { label: '更新', color: 'bg-blue-100 text-blue-700', icon: FileText },
  correct: { label: '人工修正', color: 'bg-supplement-100 text-supplement-700', icon: Edit3 },
  rerun: { label: '重跑', color: 'bg-primary-100 text-primary-700', icon: RotateCcw },
  review: { label: '复核', color: 'bg-warning-100 text-warning-700', icon: Check },
  supplement: { label: '补录', color: 'bg-amber-100 text-amber-700', icon: FileText },
  create: { label: '创建', color: 'bg-green-100 text-green-700', icon: FileText },
};

export function History() {
  const { records, historyVersions, getRecordById, getHistoryByRecordId } = useScheduleStore();
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  const recordsWithHistory = records.map((r) => ({
    record: r,
    history: getHistoryByRecordId(r.id),
  }));

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-serif font-bold text-gray-900 mb-2">历史记录</h1>
        <p className="text-gray-500">
          追踪所有排程记录的完整操作历史，包括人工修正和重跑痕迹，确保流程透明可追溯。
        </p>
      </div>

      <div className="space-y-4">
        {recordsWithHistory.map(({ record, history }) => {
          const isExpanded = expandedRecordId === record.id;
          return (
            <div
              key={record.id}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
            >
              <div
                className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                    <HistoryIcon className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{record.pointName}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <StatusBadge status={record.status} />
                      <span className="text-xs text-gray-500">
                        {history.length} 条历史版本
                      </span>
                      {record.hasManualCorrection && (
                        <span className="text-xs px-2 py-0.5 bg-supplement-100 text-supplement-700 rounded-full">
                          含人工修正
                        </span>
                      )}
                      {record.hasRerun && (
                        <span className="text-xs px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full">
                          已重跑
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 p-5 bg-gray-50/50">
                  <div className="relative">
                    <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-gray-200"></div>
                    <div className="space-y-5">
                      {history.map((h, index) => {
                        const opConfig = operationTypeConfig[h.operationType];
                        const Icon = opConfig.icon;
                        const isLast = index === history.length - 1;

                        return (
                          <div key={h.id} className="relative pl-12">
                            <div
                              className={`absolute left-3 w-4 h-4 rounded-full ${opConfig.color} border-2 border-white shadow flex items-center justify-center ${
                                isLast ? 'ring-4 ring-primary-100' : ''
                              }`}
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                            </div>
                            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${opConfig.color}`}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${opConfig.color}`}>
                                        {opConfig.label}
                                      </span>
                                      <span className="text-xs text-gray-500">版本 v{h.version}</span>
                                    </div>
                                    <p className="text-sm font-medium text-gray-900 mt-1">
                                      {h.description}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-gray-500 pt-3 border-t border-gray-100">
                                <span className="flex items-center gap-1">
                                  <User className="w-3.5 h-3.5" />
                                  {h.operator}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  {h.timestamp}
                                </span>
                              </div>

                              {h.snapshot && (
                                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                  <p className="text-xs font-medium text-gray-500 mb-2">当时快照</p>
                                  <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                      <span className="text-gray-500">状态：</span>
                                      <StatusBadge status={h.snapshot.status} />
                                    </div>
                                    <div>
                                      <span className="text-gray-500">补给时间：</span>
                                      <span className="text-gray-700">{h.snapshot.supplyTime}</span>
                                    </div>
                                    <div className="col-span-2">
                                      <span className="text-gray-500">备注：</span>
                                      <span className="text-gray-700">{h.snapshot.remarks}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-5 bg-primary-50 border border-primary-200 rounded-2xl">
        <h3 className="text-sm font-semibold text-primary-800 mb-2">历史记录说明</h3>
        <ul className="text-sm text-primary-700 space-y-1">
          <li>• 每一条排程记录的每一次变更都会被完整记录，包括操作人、时间和当时的数据快照</li>
          <li>• 人工修正和重跑操作会有特殊标记，便于追踪返工过程</li>
          <li>• 社区书记的复核操作也会记入历史，确保决策透明</li>
        </ul>
      </div>
    </div>
  );
}
