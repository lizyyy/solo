import { Check, X, AlertTriangle } from 'lucide-react';
import type { ConflictItem } from '../../types/claim';

interface ConflictTableProps {
  conflicts: ConflictItem[];
  onResolve: (conflictId: string, resolution: ConflictItem['resolution']) => void;
  onResolveAll: (resolution: ConflictItem['resolution']) => void;
}

export function ConflictTable({ conflicts, onResolve, onResolveAll }: ConflictTableProps) {
  const allResolved = conflicts.every((c) => c.resolution);

  return (
    <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
      <div className="bg-red-50 px-5 py-3 border-b border-red-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-red-600" size={18} />
            <h3 className="text-sm font-semibold text-red-800">冲突证据对比</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              {conflicts.length} 项差异
            </span>
          </div>
          {!allResolved && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">全部：</span>
              <button
                onClick={() => onResolveAll('confirm_manual')}
                className="px-2.5 py-1 text-xs font-medium rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              >
                以人工改判为准
              </button>
              <button
                onClick={() => onResolveAll('confirm_prompt')}
                className="px-2.5 py-1 text-xs font-medium rounded border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
              >
                以提示词版本为准
              </button>
              <button
                onClick={() => onResolveAll('reject_both')}
                className="px-2.5 py-1 text-xs font-medium rounded border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                全部驳回
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-5 py-3 font-medium text-gray-600 w-32">字段</th>
              <th className="text-left px-5 py-3 font-medium text-blue-700 w-72">
                人工改判表结论
              </th>
              <th className="text-left px-5 py-3 font-medium text-purple-700 w-72">
                提示词版本号结论
              </th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">选择确认</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {conflicts.map((conflict) => {
              const resolved = !!conflict.resolution;
              return (
                <tr
                  key={conflict.id}
                  className={`transition-colors ${resolved ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-5 py-4 font-medium text-gray-800">{conflict.field}</td>
                  <td className="px-5 py-4 text-gray-700">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${
                          conflict.resolution === 'confirm_manual'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        人工改判
                      </span>
                      {conflict.manualValue}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-700">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${
                          conflict.resolution === 'confirm_prompt'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-purple-50 text-purple-700'
                        }`}
                      >
                        提示词版本
                      </span>
                      {conflict.promptValue}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {!resolved ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onResolve(conflict.id, 'confirm_manual')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors"
                        >
                          <Check size={12} />
                          确认人工
                        </button>
                        <button
                          onClick={() => onResolve(conflict.id, 'confirm_prompt')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-purple-300 text-purple-700 hover:bg-purple-50 transition-colors"
                        >
                          <Check size={12} />
                          确认提示词
                        </button>
                        <button
                          onClick={() => onResolve(conflict.id, 'reject_both')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          <X size={12} />
                          驳回
                        </button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Check size={12} />
                        {conflict.resolution === 'confirm_manual'
                          ? '已确认人工改判'
                          : conflict.resolution === 'confirm_prompt'
                            ? '已确认提示词版本'
                            : '已驳回，需重审'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
