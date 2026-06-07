import { AlertTriangle, Check, X } from 'lucide-react';
import type { ConflictEvidence } from '@/types';

interface ConflictPanelProps {
  conflicts: ConflictEvidence[];
  onResolve: (conflictId: string, resolution: 'confirmed' | 'rejected') => void;
}

export function ConflictPanel({ conflicts, onResolve }: ConflictPanelProps) {
  const unresolvedConflicts = conflicts.filter((c) => c.resolution === null);
  const resolvedConflicts = conflicts.filter((c) => c.resolution !== null);

  if (conflicts.length === 0) {
    return null;
  }

  return (
    <div className="border-2 border-red-200 bg-red-50/50">
      <div className="bg-red-600 text-white px-4 py-3 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5" />
        <span className="font-semibold font-serif">检测到冲突</span>
        <span className="ml-auto text-sm">
          {unresolvedConflicts.length} 项待处理 / {conflicts.length} 项总计
        </span>
      </div>
      <div className="p-4 space-y-4">
        {conflicts.map((conflict) => (
          <div
            key={conflict.id}
            className={`border p-4 bg-white ${conflict.resolution ? 'border-slate-200 opacity-70' : 'border-red-200'}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-medium text-slate-900">{conflict.description}</p>
                <p className="text-xs text-slate-500 mt-1">冲突ID: {conflict.id}</p>
              </div>
              {conflict.resolution && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium ${conflict.resolution === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}
                >
                  {conflict.resolution === 'confirmed' ? (
                    <><Check className="w-3 h-3" /> 已确认</>
                  ) : (
                    <><X className="w-3 h-3" /> 已驳回</>
                  )}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-50 p-3 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 mb-2">训练日志证据</p>
                <p className="text-sm text-slate-700">{conflict.logEvidence}</p>
              </div>
              <div className="bg-amber-50 p-3 border border-amber-200">
                <p className="text-xs font-semibold text-amber-700 mb-2">阈值调参笔记证据</p>
                <p className="text-sm text-slate-700">{conflict.noteEvidence}</p>
              </div>
            </div>

            {!conflict.resolution && (
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <p className="text-sm text-slate-600">算法工程师小乔，请选择处理方式：</p>
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => onResolve(conflict.id, 'rejected')}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 border-2 border-red-700 hover:bg-red-700 transition-colors flex items-center gap-1"
                  >
                    <X className="w-4 h-4" /> 驳回
                  </button>
                  <button
                    onClick={() => onResolve(conflict.id, 'confirmed')}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 border-2 border-emerald-700 hover:bg-emerald-700 transition-colors flex items-center gap-1"
                  >
                    <Check className="w-4 h-4" /> 确认
                  </button>
                </div>
              </div>
            )}

            {conflict.resolution && (
              <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
                处理人: {conflict.resolvedBy} | 处理时间: {conflict.resolvedAt}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
