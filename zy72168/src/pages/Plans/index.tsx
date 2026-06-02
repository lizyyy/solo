import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, GitBranch, Clock, User, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/store';
import { planService } from '@/services/planService';
import { formatDateTime } from '@/utils/export';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import type { DiffResult, PlanVersion } from '@/types';

export default function PlanList() {
  const navigate = useNavigate();
  const { plans, loading, fetchPlans } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState<string | null>(null);
  const [diffResults, setDiffResults] = useState<Record<string, DiffResult[]>>({});

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const sortedPlans = [...plans].sort((a, b) =>
    a.version.localeCompare(b.version)
  );

  const handleExpand = async (plan: PlanVersion) => {
    if (expandedId === plan.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(plan.id);

    if (plan.previousVersionId && !diffResults[plan.id]) {
      setDiffLoading(plan.id);
      try {
        const diffs = await planService.compareVersions(plan.previousVersionId, plan.id);
        setDiffResults(prev => ({ ...prev, [plan.id]: diffs }));
      } catch (error) {
        console.error('对比版本失败:', error);
      } finally {
        setDiffLoading(null);
      }
    }
  };

  const getChangeTypeStyle = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'removed':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'modified':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-800';
    }
  };

  const getChangeTypeText = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return '新增';
      case 'removed':
        return '删除';
      case 'modified':
        return '修改';
      default:
        return changeType;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" text="加载中..." />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          <GitBranch className="w-7 h-7 text-blue-600" />
          方案版本管理
        </h1>
        <p className="text-slate-500 mt-2 ml-10">查看所有方案版本的迭代历史和变更记录</p>
      </div>

      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-slate-200" />

        {sortedPlans.map((plan, index) => (
          <div key={plan.id} className="relative pl-20 pb-8">
            <div className="absolute left-5 w-6 h-6 rounded-full bg-white border-4 border-blue-500 z-10" />

            {index < sortedPlans.length - 1 && (
              <div className="absolute left-[30px] top-8 w-4 h-0.5 bg-slate-300" />
            )}

            <div
              className={`bg-white rounded-xl shadow-sm border transition-all duration-200 cursor-pointer hover:shadow-md ${
                expandedId === plan.id ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'
              }`}
              onClick={() => handleExpand(plan)}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg font-semibold text-sm">
                      {plan.version}
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800">{plan.title}</h3>
                    {plan.isActive && (
                      <StatusBadge status="completed" showIcon={false} />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {expandedId === plan.id ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </div>

                <p className="text-slate-600 text-sm mb-4 pl-2 border-l-2 border-blue-200">
                  <span className="font-medium text-slate-700">变更原因：</span>
                  {plan.changeReason}
                </p>

                <div className="flex items-center gap-6 text-sm text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <User className="w-4 h-4" />
                    <span>{plan.createdBy}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>{formatDateTime(plan.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    <span>{plan.bypassRoutes.length} 条绕行路线</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <GitBranch className="w-4 h-4" />
                    <span>{plan.suggestions.length} 条业务建议</span>
                  </div>
                </div>

                {plan.previousVersionId && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                    <ArrowRight className="w-4 h-4" />
                    <span>基于上一版本迭代</span>
                  </div>
                )}
              </div>

              {expandedId === plan.id && (
                <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 rounded-b-xl">
                  {plan.previousVersionId ? (
                    diffLoading === plan.id ? (
                      <div className="flex justify-center py-4">
                        <LoadingSpinner size="sm" text="加载对比中..." />
                      </div>
                    ) : diffResults[plan.id] && diffResults[plan.id].length > 0 ? (
                      <div className="space-y-3">
                        <h4 className="font-medium text-slate-700 mb-3">变更对比</h4>
                        {diffResults[plan.id].map((diff, idx) => (
                          <div
                            key={idx}
                            className={`border rounded-lg p-3 ${getChangeTypeStyle(diff.changeType)}`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium px-2 py-0.5 rounded bg-white">
                                {getChangeTypeText(diff.changeType)}
                              </span>
                              <span className="font-medium">{diff.field}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <div className="text-xs opacity-70 mb-1">原值</div>
                                <div className="line-through">{diff.oldValue}</div>
                              </div>
                              <div>
                                <div className="text-xs opacity-70 mb-1">新值</div>
                                <div>{diff.newValue}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-4">暂无变更对比</p>
                    )
                  ) : (
                    <p className="text-slate-500 text-center py-4">初始版本，无变更对比</p>
                  )}

                  <div className="flex gap-3 mt-4 pt-4 border-t border-slate-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/plans/${plan.id}`);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      查看详情
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/plans/${plan.id}?compare=true`);
                      }}
                      className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
                    >
                      版本对比
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>暂无方案版本数据</p>
        </div>
      )}
    </div>
  );
}
