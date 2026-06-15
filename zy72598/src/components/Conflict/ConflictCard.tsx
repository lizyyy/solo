import { Conflict } from '@/types';
import { cn } from '@/lib/utils';
import { AlertTriangle, Check, X, FileText, BarChart3 } from 'lucide-react';
import {
  getConflictTypeLabel,
  getConflictTypeColor,
  getConflictStatusLabel,
  getConflictStatusColor,
} from '@/utils/conflictDetector';
import { useExperimentStore } from '@/store/useExperimentStore';

interface ConflictCardProps {
  conflict: Conflict;
}

export const ConflictCard = ({ conflict }: ConflictCardProps) => {
  const resolveConflict = useExperimentStore((s) => s.resolveConflict);
  const currentExperimentId = useExperimentStore((s) => s.currentExperimentId);

  const handleResolve = (status: 'confirmed' | 'rejected') => {
    if (currentExperimentId) {
      resolveConflict(currentExperimentId, conflict.id, status, '阿越');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">{conflict.description}</h4>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getConflictTypeColor(conflict.type))}>
                  {getConflictTypeLabel(conflict.type)}
                </span>
                <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getConflictStatusColor(conflict.status))}>
                  {getConflictStatusLabel(conflict.status)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-800">训练日志证据</span>
            </div>
            <p className="text-sm text-gray-700">{conflict.evidence.log}</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-semibold text-amber-800">调参笔记证据</span>
            </div>
            <p className="text-sm text-gray-700">{conflict.evidence.note}</p>
          </div>
        </div>

        {conflict.status === 'pending' && (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 flex-1">
              ⚠️ 请实验平台负责人阿越确认或驳回，不要自动拍板
            </p>
            <button
              onClick={() => handleResolve('confirmed')}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <Check className="w-4 h-4" />
              确认冲突
            </button>
            <button
              onClick={() => handleResolve('rejected')}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              <X className="w-4 h-4" />
              驳回冲突
            </button>
          </div>
        )}

        {conflict.status !== 'pending' && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              由 <span className="font-medium text-gray-700">{conflict.resolvedBy}</span> 于{' '}
              <span className="font-medium text-gray-700">
                {conflict.resolvedAt && new Date(conflict.resolvedAt).toLocaleString()}
              </span>{' '}
              {conflict.status === 'confirmed' ? '确认' : '驳回'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
