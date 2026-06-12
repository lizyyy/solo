import { useState } from 'react';
import {
  History as HistoryIcon,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertTriangle,
  X,
  Check,
  Filter,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatDate } from '../utils/boundaryRules';
import { getChangeTypeText, getFieldNameText } from '../utils/historyTracker';
import { EntityType } from '../types';
import DiffViewer from '../components/DiffViewer';

export default function History() {
  const history = useStore((state) => state.history);
  const rollbackHistory = useStore((state) => state.rollbackHistory);
  const currentUser = useStore((state) => state.currentUser);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | EntityType>('all');
  const [rollbackConfirm, setRollbackConfirm] = useState<string | null>(null);
  const [rollbackSuccess, setRollbackSuccess] = useState(false);

  const filteredHistory = history.filter((item) => {
    if (filterType === 'all') return true;
    return item.entityType === filterType;
  });

  const sortedHistory = [...filteredHistory].sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
  );

  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case 'create':
        return 'bg-success-100 text-success-700';
      case 'update':
        return 'bg-primary-100 text-primary-700';
      case 'delete':
        return 'bg-danger-100 text-danger-700';
      case 'rollback':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getEntityTypeText = (type: EntityType) => {
    const map: Record<EntityType, string> = {
      track_alias: '曲目别名',
      rehearsal_record: '排练记录',
      contract: '合同截图',
      review_task: '复核任务',
    };
    return map[type] || type;
  };

  const getEntityTypeColor = (type: EntityType) => {
    switch (type) {
      case 'track_alias':
        return 'bg-accent-100 text-accent-700';
      case 'rehearsal_record':
        return 'bg-primary-100 text-primary-700';
      case 'contract':
        return 'bg-blue-100 text-blue-700';
      case 'review_task':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const isRollbackable = (item: { changeType: string; entityType: string }) => {
    if (item.changeType === 'rollback') return false;
    if (item.entityType === 'review_task') return false;
    return true;
  };

  const handleRollback = (historyId: string) => {
    const success = rollbackHistory(historyId, currentUser.name);
    if (success) {
      setRollbackSuccess(true);
      setRollbackConfirm(null);
      setTimeout(() => setRollbackSuccess(false), 2000);
    }
  };

  const canRollback = (item: { changeType: string; entityType: string; fieldName: string }) => {
    if (!isRollbackable(item)) return false;
    if (item.entityType === 'review_task') return false;
    return true;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary-800">
            历史变更记录
          </h1>
          <p className="text-gray-600 mt-1">
            查看所有字段级别的变更历史，对比修改前后差异，支持回滚
          </p>
        </div>
        {rollbackSuccess && (
          <div className="flex items-center gap-2 px-4 py-2 bg-success-50 text-success-700 rounded-lg border border-success-200">
            <Check className="w-4 h-4" />
            <span className="text-sm font-medium">回滚成功</span>
          </div>
        )}
      </div>

      <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg flex items-start gap-3">
        <HistoryIcon className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-primary-800">历史追溯规则</p>
          <p className="text-xs text-primary-700 mt-0.5">
            所有字段修改均记录修改前值、修改后值、操作人和时间戳。支持按操作人、时间范围筛选。
            备注字段支持字符级 diff 对比。回滚操作会生成新的历史记录，不覆盖原有记录。
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-600">筛选：</span>
        {[
          { key: 'all', label: '全部' },
          { key: 'track_alias', label: '曲目别名' },
          { key: 'rehearsal_record', label: '排练记录' },
          { key: 'contract', label: '合同截图' },
          { key: 'review_task', label: '复核任务' },
        ].map((item) => (
          <button
            key={item.key}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filterType === item.key
                ? 'bg-primary-700 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
            onClick={() => setFilterType(item.key as typeof filterType)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="text-left px-4 py-3 w-10"></th>
                <th className="text-left px-4 py-3 w-20">类型</th>
                <th className="text-left px-4 py-3 w-20">操作</th>
                <th className="text-left px-4 py-3 w-28">字段</th>
                <th className="text-left px-4 py-3">变更摘要</th>
                <th className="text-left px-4 py-3 w-24">操作人</th>
                <th className="text-left px-4 py-3 w-40">操作时间</th>
                <th className="text-center px-4 py-3 w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              {sortedHistory.map((item) => {
                const isExpanded = expandedId === item.id;
                const isRemarkField = item.fieldName === 'remark' || item.fieldName === 'trackRemark';

                return (
                  <>
                    <tr key={item.id} className="table-row align-top">
                      <td className="px-4 py-3">
                        <button
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`tag ${getEntityTypeColor(item.entityType)}`}>
                          {getEntityTypeText(item.entityType)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`tag ${getChangeTypeColor(item.changeType)}`}>
                          {getChangeTypeText(item.changeType)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-primary-700 font-medium">
                        {getFieldNameText(item.fieldName)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-600 max-w-md truncate">
                          <span className="text-danger-600 line-through mr-2">
                            {item.oldValue || '（空）'}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-success-600 ml-2">
                            {item.newValue || '（空）'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          {item.changedBy}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(item.changedAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {canRollback(item) && (
                          <button
                            className="p-1.5 hover:bg-amber-50 rounded text-amber-600 transition-colors"
                            title="回滚此变更"
                            onClick={() => setRollbackConfirm(item.id)}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${item.id}-detail`} className="bg-gray-50">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="pl-8">
                            <DiffViewer
                              oldValue={item.oldValue}
                              newValue={item.newValue}
                              fieldName={getFieldNameText(item.fieldName)}
                            />
                            {isRemarkField && item.entityType === 'track_alias' && (
                              <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                回滚备注变更将同时影响关联排练记录的返工原因检测状态
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {rollbackConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <RotateCcw className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-primary-800">确认回滚</h3>
                    <p className="text-sm text-gray-500">此操作将撤销该变更</p>
                  </div>
                </div>
                <button
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  onClick={() => setRollbackConfirm(null)}
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>注意：</strong>回滚会生成新的历史记录，原始变更记录仍会保留。
                  如果回滚的是备注字段，可能会影响关联记录的返工原因检测状态。
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  className="btn-secondary"
                  onClick={() => setRollbackConfirm(null)}
                >
                  取消
                </button>
                <button
                  className="btn-primary bg-amber-600 hover:bg-amber-700"
                  onClick={() => handleRollback(rollbackConfirm)}
                >
                  确认回滚
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
