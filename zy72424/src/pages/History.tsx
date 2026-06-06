import { useState } from 'react';
import {
  History as HistoryIcon,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatDate } from '../utils/boundaryRules';
import { getChangeTypeText, getFieldNameText } from '../utils/historyTracker';
import DiffViewer from '../components/DiffViewer';

export default function History() {
  const history = useStore((state) => state.history);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sortedHistory = [...history].sort(
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-primary-800">
          历史变更记录
        </h1>
        <p className="text-gray-600 mt-1">
          查看所有字段级别的变更历史，对比修改前后差异
        </p>
      </div>

      <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg flex items-start gap-3">
        <HistoryIcon className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-primary-800">历史追溯规则</p>
          <p className="text-xs text-primary-700 mt-0.5">
            所有字段修改均记录修改前值、修改后值、操作人和时间戳。支持按操作人、时间范围筛选。
            备注字段支持字符级 diff 对比。
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="text-left px-4 py-3 w-10"></th>
                <th className="text-left px-4 py-3 w-24">操作类型</th>
                <th className="text-left px-4 py-3 w-32">字段</th>
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
                        {isRemarkField && item.changeType === 'update' && (
                          <button
                            className="p-1.5 hover:bg-amber-50 rounded text-amber-600 transition-colors"
                            title="回滚此变更"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${item.id}-detail`} className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="pl-8">
                            <DiffViewer
                              oldValue={item.oldValue}
                              newValue={item.newValue}
                              fieldName={getFieldNameText(item.fieldName)}
                            />
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
    </div>
  );
}
