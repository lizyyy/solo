import { useExperimentStore } from '@/store/useExperimentStore';
import { ConflictCard } from '@/components/Conflict/ConflictCard';
import { AlertTriangle, AlertCircle } from 'lucide-react';

export const ConflictsPage = () => {
  const { experiments, currentExperimentId, setCurrentExperiment, getCurrentConflicts } =
    useExperimentStore();

  const conflicts = getCurrentConflicts();
  const pendingCount = conflicts.filter((c) => c.status === 'pending').length;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-3"
            style={{ fontFamily: "'Source Serif Pro', serif" }}
          >
            <AlertTriangle className="w-7 h-7 text-red-500" />
            冲突中心
          </h1>
          <p className="text-gray-500">
            训练日志曲线与阈值调参笔记一致性检测，列出所有冲突证据
          </p>
        </div>
        <select
          value={currentExperimentId || ''}
          onChange={(e) => setCurrentExperiment(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {experiments.map((exp) => (
            <option key={exp.id} value={exp.id}>
              {exp.name}
            </option>
          ))}
        </select>
      </div>

      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">待处理冲突提醒</p>
            <p className="text-sm text-amber-700">
              当前有 {pendingCount} 个冲突待确认，请实验平台负责人阿越逐一确认或驳回，不要自动拍板。
            </p>
          </div>
        </div>
      )}

      {conflicts.length > 0 ? (
        <div className="space-y-4">
          {conflicts.map((conflict) => (
            <ConflictCard key={conflict.id} conflict={conflict} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">暂无冲突</h3>
          <p className="text-gray-500">该实验的训练日志与调参笔记一致</p>
        </div>
      )}
    </div>
  );
};
