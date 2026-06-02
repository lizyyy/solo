import React from 'react';
import { AlertTriangle, CheckCircle, ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import { useConflict } from '@/hooks/useConflict';
import { useShelter } from '@/hooks/useShelter';
import { ConflictTypeBadge } from '@/components/common/StatusBadge';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

export const ConflictList: React.FC = () => {
  const { conflicts, unresolvedConflicts, stats, resolveConflict, severityLabel, severityColor } = useConflict();
  const { openDetailPanel } = useUIStore();
  const { shelters, setSelectedShelter } = useShelter();

  const displayConflicts = unresolvedConflicts.length > 0 ? unresolvedConflicts : conflicts;

  return (
    <div className="h-full overflow-y-auto bg-gray-900 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">冲突处理中心</h2>
          <p className="mt-1 text-sm text-gray-400">
            系统自动检测居民反馈与官方数据的冲突，人工决策后更新系统记录
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
            <p className="text-xs text-gray-400">冲突总数</p>
            <p className="mt-1 text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
            <p className="text-xs text-orange-400">待处理</p>
            <p className="mt-1 text-2xl font-bold text-orange-400">{stats.unresolved}</p>
          </div>
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
            <p className="text-xs text-green-400">已解决</p>
            <p className="mt-1 text-2xl font-bold text-green-400">{stats.resolved}</p>
          </div>
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
            <p className="text-xs text-purple-400">多重冲突</p>
            <p className="mt-1 text-2xl font-bold text-purple-400">{stats.byType.mixed}</p>
          </div>
        </div>

        {displayConflicts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-700 bg-gray-800/50 py-16">
            <CheckCircle className="mb-4 h-16 w-16 text-green-500 opacity-50" />
            <p className="text-lg font-medium text-gray-300">暂无待处理冲突</p>
            <p className="mt-1 text-sm text-gray-500">所有数据冲突已处理完毕</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayConflicts.map((conflict) => {
              const shelter = shelters.find(s => s.id === conflict.shelterId);

              return (
                <div
                  key={conflict.id}
                  className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800/50 transition-all hover:border-gray-600"
                >
                  <div className="flex items-start justify-between border-b border-gray-700 p-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full',
                        severityColor(conflict.severity)
                      )}>
                        <AlertTriangle className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-white">{conflict.shelterName}</h3>
                          <ConflictTypeBadge type={conflict.type} size="sm" />
                          <span className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-medium text-white',
                            severityColor(conflict.severity)
                          )}>
                            {severityLabel(conflict.severity)}严重
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {conflict.type === 'capacity' && '容量标准不一致'}
                          {conflict.type === 'coordinate' && '坐标位置存在偏移'}
                          {conflict.type === 'time' && '时段统计冲突'}
                          {conflict.type === 'mixed' && '多重数据冲突'}
                        </p>
                      </div>
                    </div>

                    {shelter && (
                      <button
                        onClick={() => {
                          setSelectedShelter(shelter.id);
                          openDetailPanel(shelter.id);
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        查看点位详情 →
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
                    <div className="rounded-lg border border-gray-700 bg-gray-700/30 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <ArrowLeft className="h-4 w-4 text-orange-400" />
                        <p className="text-xs font-medium text-orange-400">居民反馈表</p>
                      </div>
                      <p className="text-sm leading-relaxed text-gray-300">{conflict.leftEvidence}</p>
                    </div>

                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-600 bg-gray-800/30 p-4">
                      <div className="mb-3 rounded-full bg-blue-500/20 p-2">
                        <AlertTriangle className="h-5 w-5 text-blue-400" />
                      </div>
                      <p className="mb-2 text-center text-xs font-medium text-gray-300">系统建议</p>
                      <p className="text-center text-xs text-gray-400">{conflict.suggestion}</p>

                      {!conflict.resolved && (
                        <div className="mt-4 flex flex-col gap-2">
                          <p className="text-[10px] text-gray-500">请人工决策采信哪方数据：</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => resolveConflict(conflict.id, 'left')}
                              className="rounded-md border border-orange-500/50 bg-orange-500/10 px-3 py-1.5 text-xs text-orange-400 transition-colors hover:bg-orange-500/20"
                            >
                              采信居民反馈
                            </button>
                            <button
                              onClick={() => resolveConflict(conflict.id, 'right')}
                              className="rounded-md border border-blue-500/50 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-400 transition-colors hover:bg-blue-500/20"
                            >
                              采信官方数据
                            </button>
                            <button
                              onClick={() => resolveConflict(conflict.id, 'pending')}
                              className="rounded-md border border-gray-600 bg-gray-700/50 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-gray-700"
                            >
                              <Clock className="mr-1 inline h-3 w-3" />
                              待核实
                            </button>
                          </div>
                        </div>
                      )}

                      {conflict.resolved && (
                        <div className="mt-4 flex items-center gap-2 rounded-full bg-green-500/20 px-3 py-1.5 text-xs text-green-400">
                          <CheckCircle className="h-3 w-3" />
                          {conflict.resolution === 'left' ? '已采信居民反馈' :
                           conflict.resolution === 'right' ? '已采信官方数据' : '标记为待核实'}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-gray-700 bg-gray-700/30 p-4">
                      <div className="mb-2 flex items-center justify-end gap-2">
                        <p className="text-xs font-medium text-blue-400">官方导入数据</p>
                        <ArrowRight className="h-4 w-4 text-blue-400" />
                      </div>
                      <p className="text-sm leading-relaxed text-gray-300">{conflict.rightEvidence}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
