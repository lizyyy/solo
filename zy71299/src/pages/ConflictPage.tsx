import { useAppStore } from '@/store/appStore';
import { AlertTriangle, DollarSign, Users, AlertOctagon, ArrowRight, LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ConflictType } from '@/types';

export default function ConflictPage() {
  const navigate = useNavigate();
  const { swapSchemes, selectedSchemeId, passengers, companionGroups } = useAppStore();

  const selectedScheme = swapSchemes.find((s) => s.schemeId === selectedSchemeId);

  const conflictTypeConfig: Record<ConflictType, { icon: LucideIcon; label: string; color: string; bgColor: string }> = {
    paid_displaced: {
      icon: DollarSign,
      label: '付费座位变更',
      color: 'text-amber-700',
      bgColor: 'bg-amber-50 border-amber-200',
    },
    companion_split: {
      icon: Users,
      label: '同行拆分',
      color: 'text-orange-700',
      bgColor: 'bg-orange-50 border-orange-200',
    },
    overbooked_duplicate: {
      icon: AlertOctagon,
      label: '超售重复分配',
      color: 'text-red-700',
      bgColor: 'bg-red-50 border-red-200',
    },
  };

  const groupedConflicts: Record<ConflictType, typeof selectedScheme.conflicts> =
    (selectedScheme?.conflicts.reduce(
      (acc, c) => {
        if (!acc[c.conflictType]) {
          acc[c.conflictType] = [];
        }
        acc[c.conflictType].push(c);
        return acc;
      },
      {} as Record<ConflictType, typeof selectedScheme.conflicts>
    ) as Record<ConflictType, typeof selectedScheme.conflicts>) ||
    ({} as Record<ConflictType, typeof selectedScheme.conflicts>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display text-primary-800">冲突解释</h1>
          <p className="text-primary-600 mt-1">详细列出调座方案中产生的各类冲突及原因</p>
        </div>
        <button
          onClick={() => navigate('/report')}
          className="flex items-center gap-2 px-6 py-2 bg-accent-400 text-primary-800 rounded-lg hover:bg-accent-500 transition-colors font-medium shadow-md"
        >
          查看完整报告
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {!selectedScheme ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">尚未选择调座方案</h3>
          <p className="text-gray-500 mb-4">请先前往调座计算页面生成并选择一个方案</p>
          <button
            onClick={() => navigate('/compute')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            前往计算
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(conflictTypeConfig).map(([type, config]) => {
              const Icon = config.icon;
              const count = groupedConflicts[type as ConflictType]?.length || 0;
              return (
                <div key={type} className={cn('rounded-xl p-5 border', config.bgColor)}>
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', config.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{count}</div>
                      <div className={cn('text-sm', config.color)}>{config.label}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {Object.entries(groupedConflicts).map(([type, conflicts]) => {
            const config = conflictTypeConfig[type as ConflictType];
            const Icon = config.icon;

            return (
              <div key={type} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className={cn('px-6 py-4 border-b', config.bgColor)}>
                  <div className="flex items-center gap-3">
                    <Icon className={cn('w-5 h-5', config.color)} />
                    <h3 className={cn('font-semibold', config.color)}>{config.label}</h3>
                    <span className="px-2 py-0.5 bg-white rounded-full text-sm font-medium">
                      {conflicts.length} 个
                    </span>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {conflicts.map((conflict) => {
                    const passenger = passengers.find((p) => p.id === conflict.affectedPassengerId);
                    const group = conflict.affectedGroupId
                      ? companionGroups.find((g) => g.groupId === conflict.affectedGroupId)
                      : null;

                    return (
                      <div
                        key={conflict.entryId}
                        className={cn('border rounded-lg p-4', config.bgColor.replace('50', '100'))}
                      >
                        <div className="flex items-start gap-4">
                          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', config.bgColor.replace('50', '200'), config.color)}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-gray-800">
                                {passenger?.name || conflict.affectedPassengerId}
                              </span>
                              {group && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                  {group.groupId}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-700 text-sm mb-2">{conflict.description}</p>
                            <div className="bg-white bg-opacity-60 rounded-lg p-3">
                              <div className="text-xs font-medium text-gray-500 mb-1">原因分析</div>
                              <p className="text-sm text-gray-600">{conflict.reason}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {Object.keys(groupedConflicts).length === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">无冲突</h3>
              <p className="text-gray-500">该调座方案未产生任何冲突，是一个理想的方案</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
