import { AlertTriangle, Check, X, FileText, BookOpen, ArrowRight } from 'lucide-react';
import type { ConflictItem } from '../types';
import { cn } from '../lib/utils';

interface ConflictPanelProps {
  conflicts: ConflictItem[];
  onResolve: (conflictId: string, resolution: 'confirm' | 'reject') => void;
  disabled?: boolean;
}

export function ConflictPanel({ conflicts, onResolve, disabled = false }: ConflictPanelProps) {
  if (conflicts.length === 0) return null;

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border-2 border-red-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-800">检测到口径冲突</h3>
          <p className="text-sm text-gray-500">
            合同页截图与曲目别名表存在不一致，请巡演统筹阿梅确认处理
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {conflicts.map((conflict) => (
          <div
            key={conflict.id}
            className={cn(
              'rounded-lg border transition-all duration-300',
              conflict.resolved
                ? conflict.resolution === 'confirm'
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-gray-300 bg-gray-50'
                : 'border-red-200 bg-red-50/50'
            )}
          >
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-slate-600" />
                    <span className="text-xs font-medium text-slate-600">合同页截图</span>
                  </div>
                  <p className="text-sm text-gray-800">{conflict.contractContent}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-sky-600" />
                    <span className="text-xs font-medium text-sky-600">曲目别名表</span>
                  </div>
                  <p className="text-sm text-gray-800">{conflict.aliasContent}</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-800">
                  <span className="font-medium">差异说明：</span>
                  {conflict.difference}
                </p>
              </div>

              {!conflict.resolved ? (
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => onResolve(conflict.id, 'reject')}
                    disabled={disabled}
                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    驳回，维持合同原文
                  </button>
                  <button
                    onClick={() => onResolve(conflict.id, 'confirm')}
                    disabled={disabled}
                    className="px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    确认，采用别名表口径
                  </button>
                </div>
              ) : (
                <div>
                  {conflict.resolution === 'confirm' && conflict.changeDetail && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                      <p className="text-xs font-medium text-emerald-700 mb-3">变更记录</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-16 flex-shrink-0">改前</span>
                          <span className="text-sm text-red-600 line-through">{conflict.changeDetail.before}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ArrowRight className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-16 flex-shrink-0">改后</span>
                          <span className="text-sm text-emerald-700 font-medium">{conflict.changeDetail.after}</span>
                        </div>
                        <div className="mt-3 pt-3 border-t border-emerald-200">
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-gray-500 w-16 flex-shrink-0">变更原因</span>
                            <span className="text-sm text-emerald-800">{conflict.changeDetail.reason}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-end">
                    <span
                      className={cn(
                        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
                        conflict.resolution === 'confirm'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-200 text-gray-600'
                      )}
                    >
                      {conflict.resolution === 'confirm' ? (
                        <>
                          <Check className="w-4 h-4" />
                          已确认采用别名表口径
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4" />
                          已驳回，维持合同原文
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
