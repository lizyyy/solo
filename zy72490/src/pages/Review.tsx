import { FileWarning, Check, X, User } from 'lucide-react';
import { useScheduleStore } from '../store/useScheduleStore';
import type { ConflictType } from '../types';

const conflictTypeLabels: Record<ConflictType, { label: string; color: string; iconColor: string }> = {
  wrong_caliber: {
    label: '错口径',
    color: 'bg-red-100 text-red-700 border-red-200',
    iconColor: 'text-red-500',
  },
  supplement: {
    label: '补录',
    color: 'bg-supplement-100 text-supplement-700 border-supplement-200',
    iconColor: 'text-supplement-500',
  },
  pending_review: {
    label: '待复核',
    color: 'bg-warning-100 text-warning-700 border-warning-200',
    iconColor: 'text-warning-500',
  },
};

const filterOptions: { value: 'all' | ConflictType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'wrong_caliber', label: '错口径' },
  { value: 'supplement', label: '补录' },
  { value: 'pending_review', label: '待复核' },
];

export function Review() {
  const {
    conflictItems,
    conflictFilter,
    setConflictFilter,
    getRecordById,
    reviewPendingItem,
  } = useScheduleStore();

  const filteredConflicts = conflictFilter === 'all'
    ? conflictItems
    : conflictItems.filter((c) => c.type === conflictFilter);

  const pendingCount = conflictItems.filter((c) => c.type === 'pending_review' && !c.resolved).length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold text-gray-900 mb-2">冲突复核表</h1>
            <p className="text-gray-500">
              处理口径冲突、补录记录和待复核项，社区书记可对汇总类投诉进行复核。
            </p>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-warning-50 border border-warning-200 rounded-xl">
              <User className="w-5 h-5 text-warning-600" />
              <span className="text-sm font-medium text-warning-700">
                {pendingCount} 项待社区书记复核
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileWarning className="w-5 h-5 text-primary-600" />
              冲突与复核列表
            </h2>
            <div className="flex items-center gap-1">
              {filterOptions.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setConflictFilter(f.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    conflictFilter === f.value
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {f.label}
                  <span className="ml-1.5 text-xs opacity-70">
                    ({f.value === 'all'
                      ? conflictItems.length
                      : conflictItems.filter((c) => c.type === f.value).length})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredConflicts.map((conflict) => {
            const record = getRecordById(conflict.recordId);
            const typeConfig = conflictTypeLabels[conflict.type];

            return (
              <div
                key={conflict.id}
                className={`p-5 transition-colors ${
                  conflict.resolved ? 'bg-gray-50/50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${typeConfig.color}`}>
                        {typeConfig.label}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        conflict.resolved
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {conflict.resolved ? '已解决' : '未解决'}
                      </span>
                    </div>
                    <h3 className="font-medium text-gray-900 mb-1">
                      {record?.pointName || '未知采样点'}
                    </h3>
                    <p className="text-sm text-gray-600">{conflict.description}</p>
                    {conflict.resolved && conflict.resolver && (
                      <p className="text-xs text-gray-500 mt-2">
                        处理人：{conflict.resolver} · {conflict.resolvedAt}
                      </p>
                    )}
                  </div>

                  {conflict.type === 'pending_review' && !conflict.resolved && (
                    <div className="flex items-center gap-2 p-3 bg-warning-50 border border-warning-200 rounded-xl">
                      <span className="text-xs text-warning-700 font-medium mr-2">社区书记复核：</span>
                      <button
                        onClick={() => reviewPendingItem(conflict.id, true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        通过
                      </button>
                      <button
                        onClick={() => reviewPendingItem(conflict.id, false)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                        驳回
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredConflicts.length === 0 && (
          <div className="p-12 text-center">
            <FileWarning className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">暂无匹配的冲突记录</p>
          </div>
        )}

        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <p className="text-sm text-gray-500 text-center">
            共 {filteredConflicts.length} 条记录 · 未解决 {filteredConflicts.filter((c) => !c.resolved).length} 条
          </p>
        </div>
      </div>

      <div className="mt-6 p-5 bg-amber-50 border border-amber-200 rounded-2xl">
        <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
          <User className="w-4 h-4" />
          社区书记复核说明
        </h3>
        <ul className="text-sm text-amber-700 space-y-1">
          <li>• 标记为"待复核"的记录是因为居民意见只剩汇总没有原文</li>
          <li>• 请根据实际情况判断是否可以按汇总信息处理，或需退回补充材料</li>
          <li>• 复核操作会记入历史记录，所有变更透明可追溯</li>
        </ul>
      </div>
    </div>
  );
}
