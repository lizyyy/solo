import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlanStore } from '../store/usePlanStore';
import { StatusBadge, JudgmentBadge } from '../components/StatusBadge';
import { RemarkModal, JudgmentModal, MaterialModal } from '../components/Modal';
import { formatDateShort } from '../utils/date';
import { api } from '../lib/api';
import type { Plan, PlanStatus } from '../../shared/types';
import { Search, Filter, MessageSquare, Gavel, Package, Download, Eye, AlertTriangle } from 'lucide-react';

export default function PlanList() {
  const navigate = useNavigate();
  const { plans, loading, error, filters, fetchPlans, setFilters, updateStatus } = usePlanStore();
  const [remarkModal, setRemarkModal] = useState<{ isOpen: boolean; plan: Plan | null }>({ isOpen: false, plan: null });
  const [judgmentModal, setJudgmentModal] = useState<{ isOpen: boolean; plan: Plan | null }>({ isOpen: false, plan: null });
  const [materialModal, setMaterialModal] = useState<{ isOpen: boolean; planId: string }>({ isOpen: false, planId: '' });

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans, filters]);

  const handleStatusToggle = async (plan: Plan) => {
    const newStatus: PlanStatus = plan.status === 'normal' ? 'abnormal' : 'normal';
    const operator = plan.status === 'normal' ? '现场工程师' : '系统自动';
    try {
      await updateStatus(plan.id, newStatus, operator);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleExport = (plan: Plan, format: 'json' | 'csv') => {
    api.exportPlan(plan.id, format);
  };

  const statusOptions: { value: PlanStatus | undefined; label: string }[] = [
    { value: undefined, label: '全部' },
    { value: 'normal', label: '正常' },
    { value: 'abnormal', label: '异常' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-industrial-dark text-white shadow-lg">
        <div className="container px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">施工变更方案比选管理系统</h1>
              <p className="text-sm text-slate-300 mt-1">全链路追踪 · 数据可追溯 · 变更可审计</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>异常记录：{plans.filter(p => p.status === 'abnormal').length}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-6">
          <div className="p-4 border-b border-slate-200">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                <Search className="w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索方案编号、项目名称、原始意见..."
                  value={filters.keyword}
                  onChange={(e) => setFilters({ keyword: e.target.value })}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-slate-400" />
                <select
                  value={filters.status || ''}
                  onChange={(e) => setFilters({ status: (e.target.value as PlanStatus) || undefined })}
                  className="px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value || 'all'} value={opt.value || ''}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <div className="animate-pulse">加载中...</div>
            </div>
          ) : error ? (
            <div className="p-12 text-center text-red-500">{error}</div>
          ) : plans.length === 0 ? (
            <div className="p-12 text-center text-slate-500">暂无数据</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">方案编号</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">项目名称</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">原始意见</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">当前备注</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">状态</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">判断</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">更新时间</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {plans.map((plan, index) => (
                    <tr
                      key={plan.id}
                      className={`hover:bg-slate-50 transition-colors animate-fade-in-up ${
                        plan.status === 'abnormal' ? 'bg-amber-50/30 border-l-4 border-l-abnormal' : ''
                      }`}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <td className="px-4 py-3 font-mono text-sm text-slate-800">{plan.planNo}</td>
                      <td className="px-4 py-3 text-sm text-slate-800 max-w-[200px] truncate" title={plan.projectName}>
                        {plan.projectName}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-[250px] truncate" title={plan.originalOpinion}>
                        <span className="text-xs text-slate-400 block mb-1">来源：{plan.originalSource}</span>
                        {plan.originalOpinion}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate" title={plan.currentRemark}>
                        {plan.currentRemark || <span className="text-slate-400">暂无备注</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleStatusToggle(plan)} title="点击切换状态">
                          <StatusBadge status={plan.status} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <JudgmentBadge judgment={plan.judgment} />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 font-mono text-xs">
                        {formatDateShort(plan.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => navigate(`/plan/${plan.id}`)}
                            className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                            title="查看详情"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setRemarkModal({ isOpen: true, plan })}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="修改备注"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setJudgmentModal({ isOpen: true, plan })}
                            className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                            title="调整判断"
                          >
                            <Gavel className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setMaterialModal({ isOpen: true, planId: plan.id })}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            title="补录材料"
                          >
                            <Package className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleExport(plan, 'json')}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                            title="导出 JSON"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {remarkModal.plan && (
        <RemarkModal
          isOpen={remarkModal.isOpen}
          onClose={() => setRemarkModal({ isOpen: false, plan: null })}
          planId={remarkModal.plan.id}
          currentRemark={remarkModal.plan.currentRemark}
        />
      )}

      {judgmentModal.plan && (
        <JudgmentModal
          isOpen={judgmentModal.isOpen}
          onClose={() => setJudgmentModal({ isOpen: false, plan: null })}
          planId={judgmentModal.plan.id}
          currentJudgment={judgmentModal.plan.judgment}
        />
      )}

      <MaterialModal
        isOpen={materialModal.isOpen}
        onClose={() => setMaterialModal({ isOpen: false, planId: '' })}
        planId={materialModal.planId}
      />
    </div>
  );
}
